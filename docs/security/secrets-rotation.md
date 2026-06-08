# Secrets Rotation Runbook

## Conventions
- Standard cadence: 90 days for human-issued keys; immediately on incident or staff offboarding.
- All Vercel env changes happen in Project Settings -> Environment Variables on the web-admin project (and any other affected project), scoped to Production, Preview, Development as appropriate.
- All DB-stored secrets live in `public.merchant_payment_gateways.config` and are written only via the platform-admin server action `saveMerchantGateway` (service_role); after this change a new `config_version` / `config_rotated_at` pair tracks rotation per merchant gateway.
- After every rotation: tail Vercel function logs for 15 minutes, then update the row in the rotation log (a private Notion/Linear ticket) with old key ID, new key ID, rotator, timestamp.

## 1. SUPABASE_SERVICE_ROLE_KEY
- Lives in: Vercel env (web-admin) and any other server that calls `@squarely/db` `createServiceRoleClient` (read in `packages/db/src/service.ts`).
- Cadence: 180 days; immediately on staff offboarding or suspected leak. This key bypasses RLS and is the highest-impact secret in the system.
- Procedure:
  1. Supabase Dashboard -> Project Settings -> API -> Reset service_role key. Note: Supabase only stores one service_role JWT at a time, so this rotation is NOT zero-downtime.
  2. Copy the new key to a password manager (1Password "squarely / supabase / service_role").
  3. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel for Production + Preview + Development.
  4. Trigger a redeploy of web-admin (Deployments -> Redeploy latest, or `vercel --prod`). All server actions and /api routes that use service_role must redeploy because Next runtime caches `process.env` at boot.
  5. Verify: hit /admin (platform admin login), open a client, confirm GatewayEditor loads (`listMerchantGateways` succeeds), and confirm `onboardMerchant` on a sandbox tenant still works.
  6. Revoke: the old key is automatically revoked by Supabase on reset; no extra step.
- What breaks during rotation: a ~30-90s window between Supabase reset and Vercel redeploy where ALL server actions calling service_role fail (401). To minimize: stage the new key in Vercel as a *new* var name (e.g. `SUPABASE_SERVICE_ROLE_KEY_NEXT`), redeploy a version that prefers `_NEXT` then falls back to the old name, then perform the Supabase reset, then promote `_NEXT` to `SUPABASE_SERVICE_ROLE_KEY` and redeploy again.

## 2. NEXT_PUBLIC_SUPABASE_ANON_KEY (+ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL)
- Lives in: Vercel env (web-admin, mobile EAS). Public — embedded in client bundle.
- Cadence: 365 days, or immediately if the project is migrated. Low impact on its own (anon role is RLS-bound) but rotating invalidates all currently-authenticated sessions for browser clients that cache the JWT.
- Procedure: Supabase Dashboard -> API -> Generate new anon key -> update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and in apps/mobile EAS env -> redeploy web-admin -> publish a new EAS update for mobile (`eas update`).
- What breaks: in-flight browser sessions stay valid until their JWT expires, but any new sign-in attempt with the old anon key in a stale bundle fails. Zero-downtime: not possible because the anon key is bundled; mitigate by publishing the mobile OTA update first, then the web redeploy.

## 3. RESEND_API_KEY
- Lives in: Vercel env (web-admin). Read in `apps/web-admin/lib/email.ts` via `sendEmail()`; if unset, `sendEmail` is a no-op.
- Cadence: 90 days.
- Procedure:
  1. Resend Dashboard -> API Keys -> Create API Key (name: `squarely-web-admin-<YYYYMMDD>`, scope: Sending access only).
  2. Update `RESEND_API_KEY` in Vercel (Production + Preview + Development) -> redeploy.
  3. Verify: trigger an announcement email or any /api path that calls `sendEmail`; confirm Resend Logs shows a 200 against the new key id.
  4. Revoke old key in Resend Dashboard.
- Zero-downtime: yes. Resend supports many concurrent live keys; new key is valid before old key is revoked, so there is no gap.

## 4. TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
- Lives in: Vercel env (web-admin). Read in `/api/receipts/sms`; if any is unset the route 503s.
- Cadence: 90 days for `AUTH_TOKEN`. `SID` and `FROM_NUMBER` rotate only on account migration.
- Procedure (AUTH_TOKEN only):
  1. Twilio Console -> Account -> API keys & tokens -> Auth Token -> "View primary" -> click "Request a secondary Auth Token" (this gives you a second valid token alongside the primary so rotation is zero-downtime).
  2. Update `TWILIO_AUTH_TOKEN` in Vercel to the secondary value -> redeploy.
  3. Verify: send a test SMS receipt via the admin sandbox.
  4. Promote secondary to primary in Twilio Console (this revokes the old primary).
- What breaks: nothing if the secondary-token flow is used. Without it, any SMS sent between the Twilio rotation and the Vercel redeploy returns 503.

## 5. STRIPE_WEBHOOK_SECRET
- Lives in: Vercel env (web-admin). Read in `apps/web-admin/app/api/stripe-webhook/route.ts` to verify Stripe-Signature.
- Cadence: 90 days, or on any webhook endpoint URL change.
- Procedure:
  1. Stripe Dashboard -> Developers -> Webhooks -> select endpoint -> "Roll signing secret" -> Stripe gives you a 24-hour grace window where BOTH old and new secrets verify.
  2. Update `STRIPE_WEBHOOK_SECRET` in Vercel to the new secret -> redeploy.
  3. Verify: trigger a test event from the Stripe Dashboard and confirm `/api/stripe-webhook` returns 200 in Vercel logs.
  4. After verifying, the old secret auto-expires at the end of the 24-hour window.
- Zero-downtime: yes, via Stripe's 24-hour dual-secret window.

## 6. Merchant-side processor keys (per-merchant, in DB)
- Lives in: `public.merchant_payment_gateways.config` (jsonb). Per-provider fields:
  - stripe: `secretKey` (+ non-secret `readerId`)
  - square: `accessToken` (+ non-secret `locationId`/`deviceId`/`environment`)
  - paypal: `clientSecret` (+ non-secret `clientId`/`environment`)
  - adyen: `apiKey` (+ non-secret `merchantAccount`/`poiId`/`environment`)
  - authorizenet: `transactionKey` (+ non-secret `apiLoginId`)
  - clover: `apiToken` (+ non-secret `merchantId`/`deviceId`/`environment`)
  - valor: `apiKey` (+ non-secret `apiBase`/`epi`)
  - upi: no secrets (`vpa`, `payeeName`, `qrImageUrl` are public)
- Cadence: 90 days per merchant. Track via the new `config_version` / `config_rotated_at` columns (see migration `20260606080000`). GatewayEditor surfaces "Last rotated: X days ago"; flag any gateway > 90 days for follow-up.
- Procedure (example: Stripe):
  1. Merchant rolls their restricted/secret key in the Stripe Dashboard (or platform staff coordinates with the merchant). Stripe restricted keys support overlapping validity windows.
  2. Platform admin opens `/admin/clients/<merchant>`, expands the gateway in GatewayEditor, pastes the new secret, clicks Save. `saveMerchantGateway` detects the secret field changed and bumps `config_version` + sets `config_rotated_at = now()`.
  3. Verify: run a test charge through the terminal adapter (`/api/payments/start` in sandbox mode).
  4. Revoke the old key in the processor dashboard.
- What breaks: any in-flight transaction holding the old key. To minimize, do the save during low-traffic hours and verify with a test charge before revoking the old key. UPI rotation is non-secret (just VPA) and never bumps `config_version` unless the VPA is among the `public_config` keys.

## 7. EMAIL_FROM and NEXT_PUBLIC_MARKETING_URL
- Non-secret. Rotate freely when the brand or marketing host changes. No procedure required beyond a Vercel env update + redeploy.

## Incident response (any of the above leaks)
1. Page the on-call platform admin via the rotation chat.
2. Rotate the affected secret using the procedure above, treating the cadence as "now".
3. For `SUPABASE_SERVICE_ROLE_KEY`, additionally: audit `admin_audit` (`SELECT * from public.admin_audit where created_at > <leak time>`) and rotate every merchant gateway secret on top tenants whose data could have been exfiltrated.
4. File an incident ticket with: secret name, leak surface, blast radius, evidence-of-misuse search, customer disclosure decision.
