# Mobile certificate pinning

Operator runbook for the TLS certificate pinning shipped with Squarely's
production Android builds.

## Why we pin

Cashiers run Squarely on tablets and phones over whatever Wi-Fi the venue
gives them — coffee-shop hotspots, conference networks, mall infrastructure.
A bad actor on the same network with a forged certificate (e.g. via a
malicious captive portal, a rogue CA installed on the device, or a corporate
TLS-inspecting middlebox) can otherwise transparently MITM the app's traffic
to Supabase and the admin host, reading auth tokens and inventory data.

Pinning the server's SPKI (Subject Public Key Info) SHA-256 hash means the
app only trusts a cert chain whose key matches a known-good fingerprint
baked into the binary — even if the device trusts an attacker's CA, the
TLS handshake to Supabase will fail.

## Scope

| Platform | Pinned? | Mechanism                                                          |
|----------|---------|--------------------------------------------------------------------|
| Android  | Yes     | `network_security_config.xml` via `expo-build-properties`          |
| iOS      | **No**  | Gap — ATS does not support SPKI pinning. TrustKit follow-up below. |

Preview channel iOS does not pin. Production iOS does not pin yet.

## Extracting the live SPKI SHA-256 hash

Run this one-liner per pinned domain. The base64 output is what goes inside
the `<pin digest="SHA-256">...</pin>` element.

```bash
# Repeat for each: squarely-admin.vercel.app, sdrvbavgematnhzsvhjd.supabase.co
HOST=squarely-admin.vercel.app
openssl s_client -servername "$HOST" -connect "$HOST:443" </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
```

Drop each value into one of the `REPLACE_WITH_LIVE_HASH` placeholders in
`apps/mobile/cert-pinning/network_security_config.xml`. Each `<pin-set>`
needs TWO pins — Android refuses to enforce a single-pin set.

## Generating the backup pin (REQUIRED)

If we only pin the current leaf key and that key is ever lost, compromised,
or rotated unexpectedly by Vercel/Supabase, every installed app stops
working with no path to recover. The backup pin prevents that.

Two ways to produce one:

1. **Intermediate CA pin** — re-run the openssl pipeline above against the
   second cert in the chain (the intermediate). Most practical option for
   third-party-hosted services because we don't control their key rotation
   schedule. Slight trust expansion: anyone the intermediate signs is
   trusted, not just our exact leaf key.
2. **Staged next-key pin** — only viable if we control the key. Not
   applicable to Vercel or Supabase.

Use option 1 for both pinned hosts.

## Rotation procedure

`network_security_config.xml` is baked into the APK, so rotation requires a
native build (`eas build`), not an OTA. The flow is staged to avoid
bricking the installed base:

1. **N-7 days before old pin retires.** Extract the *new* SPKI hash and add
   it as an additional `<pin>` in the relevant `<pin-set>`. Leave the old
   pin in place. The set now contains old + new + backup (yes, 3 pins; the
   parser is fine with that).
2. **Ship a production build via `eas build`.** Distribute through Play
   Store. Wait until adoption of the new build is >=95% (Play Console
   release dashboard).
3. **Remove the old pin.** Ship another production build.
4. **Update `expiration`** on the `<pin-set>` to push the safety net out
   another ~12 months.

Note: subsequent JS-only fixes in between can still ride OTA — the pin
config only ships in native builds, JS bundles never break it.

## iOS gap (follow-up)

ATS in `Info.plist` controls TLS minimums (version, cipher suites) but does
not expose SPKI pinning. Closing the gap requires a native library; the
recommended path is:

1. Add `react-native-trustkit` (or wrap TrustKit directly via a small
   custom Expo config plugin under `apps/mobile/plugins/`).
2. Configure the same two hosts and the same SPKI hashes from the XML in
   TrustKit's plist block.
3. Update the scope table in this doc to flip iOS to "Yes".

Until then, iOS production traffic is protected only by standard CA trust
and ATS minimums.

## Files

- `apps/mobile/cert-pinning/network_security_config.xml` — the pin set.
- `apps/mobile/app.config.ts` — wires the XML into the Android build via
  `expo-build-properties.android.networkSecurityConfig`.
- `docs/security/mobile-cert-pinning.md` — this runbook.
