# Deploying Squarely to Vercel

This is a **pnpm + Turborepo** monorepo. We deploy two apps as **two separate
Vercel projects** from the same Git repository:

| App                | Path             | Domain                          |
| ------------------ | ---------------- | ------------------------------- |
| Admin (Next.js 16) | `apps/web-admin` | `app.squarely.com`              |
| Marketing          | `apps/marketing` | `squarely.com` / `www.squarely.com` |

Vercel has first-class Turborepo monorepo support: you import the repo once per
app and point each project at its subdirectory via the **Root Directory**
setting. Vercel installs workspace dependencies from the repo root automatically
and detects `pnpm` from the root `packageManager` field (`pnpm@10.4.1`).

---

## 1. Admin app — `apps/web-admin`

### Import the project

1. In the Vercel dashboard: **Add New… → Project** and import this Git repo.
2. **Root Directory:** set to `apps/web-admin`.
   - Leave **"Include source files outside of the Root Directory"** enabled
     (the default for monorepos). This lets the build access the root
     `pnpm-lock.yaml`, `turbo.json`, and the `@squarely/*` workspace packages.
3. **Framework Preset:** Next.js (auto-detected).

### Build & install settings

Vercel detects everything from the repo; the defaults are correct:

- **Install Command:** `pnpm install` (auto, from `packageManager`).
- **Build Command:** `pnpm build` (or leave as Vercel's Next.js default
  `next build` — both work; the app's own `build` script is `next build`).
- **Output:** handled automatically by the Next.js preset.

No `vercel.json` is required — the dashboard **Root Directory** setting is the
recommended approach for Turborepo monorepos and avoids brittle config.

### Environment variables

In **Project Settings → Environment Variables**, add these (see
`apps/web-admin/.env.example`):

| Variable                        | Notes                                            |
| ------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public Supabase URL (exposed to browser).        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (exposed to browser).            |
| `SUPABASE_URL`                  | Supabase URL for server-side code.               |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-only secret.** Never expose; no `NEXT_PUBLIC_` prefix. Mark as Sensitive in Vercel. |

Apply them to the **Production** (and Preview, if desired) environments.

### Custom domain

1. **Project Settings → Domains → Add** `app.squarely.com`.
2. At your DNS registrar, add the record Vercel shows:
   - **CNAME** `app` → `cname.vercel-dns.com`
   - (Or the **A** record Vercel displays if a CNAME at that host isn't
     possible — follow whichever Vercel instructs.)
3. Wait for DNS to propagate; Vercel issues the TLS certificate automatically.

---

## 2. Marketing app — `apps/marketing`

Repeat the import as a **second Vercel project** from the same repo:

1. **Add New… → Project**, import the same repo again.
2. **Root Directory:** `apps/marketing`.
3. **Environment Variables** (see `apps/marketing/.env.example`):
   - `NEXT_PUBLIC_APP_URL = https://app.squarely.com`
4. **Domains:** add the apex `squarely.com` and `www.squarely.com`.
   - Apex `squarely.com`: add the **A** record Vercel shows (e.g.
     `76.76.21.21`) or an ALIAS/ANAME if your registrar supports it.
   - `www`: **CNAME** `www` → `cname.vercel-dns.com`.

---

## 3. Supabase & Google OAuth (production)

- The Supabase project **already exists** — no database setup or migrations are
  needed for deployment. Just reuse its URL and keys in the env vars above.
- Add the production redirect URLs so OAuth works on the live domain:
  - **Supabase → Authentication → URL Configuration:** add
    `https://app.squarely.com` to **Site URL** / **Redirect URLs**, including
    the callback path the app uses (e.g.
    `https://app.squarely.com/auth/callback`).
  - **Google Cloud Console → Credentials → OAuth client:** add the same
    callback URL (and the Supabase
    `https://<project-ref>.supabase.co/auth/v1/callback`) to **Authorized
    redirect URIs**.

---

## 4. CLI alternative (instead of the dashboard)

```bash
npm i -g vercel

# from the admin app directory
cd apps/web-admin
vercel link        # link this directory to a Vercel project (set Root Directory = apps/web-admin when prompted)
vercel --prod      # build and deploy to production
```

Set env vars via the dashboard or `vercel env add <NAME> production`. Repeat
from `apps/marketing` for the marketing project.
Deploy test: 2026-05-23 13:09
