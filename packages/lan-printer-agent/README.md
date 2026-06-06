# @squarely/lan-printer-agent

Long-running Node CLI that runs on a merchant's LAN, polls `public.print_jobs`
every 5 seconds, and POSTs queued Epson ePOS XML to printers over HTTP. Stays
alive across receipts and restarts cheaply.

## Why a dedicated user (not service-role)

RLS on `print_jobs` requires the JWT to carry `app_metadata.active_merchant_id`
and the user to be `owner` or `admin` of that merchant. We sign in as a real
user — never the service-role key — so even if the agent's credentials leak,
the blast radius is one merchant's print queue.

## One-time setup

1. **Create the auth user.** In the Supabase dashboard (Authentication → Users →
   Add user) or via the admin API, create a user with email
   `print-agent+<merchant-slug>@<your-domain>` and a strong random password.
   Store the credentials in your team password manager.

2. **Grant admin membership on the target merchant.**

   ```sql
   insert into public.merchant_members (merchant_id, user_id, role, active)
   values ('<merchant-uuid>', '<agent-user-uuid>', 'admin', true);
   ```

   Use `admin`, not `owner` — the agent never needs ownership semantics.

3. **Stamp `active_merchant_id` onto the user's `app_metadata`.** This claim is
   only refreshed on a fresh sign-in, so do it before the agent starts:

   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('active_merchant_id', '<merchant-uuid>')
    where email = 'print-agent+...@...';
   ```

   (Equivalent flow: sign in once, call the `set_active_merchant` RPC, then sign
   in again so the new JWT carries the claim.)

4. **(Optional) Restrict to specific printers** by setting `PRINTER_IDS` (see
   below). Useful when one merchant has multiple LAN print agents, each on a
   separate subnet.

## Environment variables

| Var                 | Required | Notes                                                                       |
| ------------------- | -------- | --------------------------------------------------------------------------- |
| `SUPABASE_URL`      | yes      | Project URL.                                                                |
| `SUPABASE_ANON_KEY` | yes      | Anon key — **never** the service-role key.                                  |
| `AGENT_EMAIL`       | yes      | The printer-agent user from step 1.                                         |
| `AGENT_PASSWORD`    | yes      | "                                                                           |
| `PRINTER_IDS`       | no       | Comma-separated UUIDs. Defaults to every LAN printer the user can read.     |
| `POLL_INTERVAL_MS`  | no       | Poll cadence. Default `5000`. Minimum `250`.                                |

See `.env.example` in this directory.

## Build & run

```bash
pnpm install
pnpm --filter @squarely/lan-printer-agent build
node packages/lan-printer-agent/dist/index.js

# Or, once the bin is linked into PATH:
squarely-print-agent
```

For local development without a build step:

```bash
pnpm --filter @squarely/lan-printer-agent dev
```

## Running as a service

The agent must be co-located on the merchant's LAN with the printers it
dispatches to. Two common deployment shapes:

### systemd (Linux)

```ini
# /etc/systemd/system/squarely-print-agent.service
[Unit]
Description=Squarely LAN Print Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/squarely/print-agent.env
ExecStart=/usr/bin/node /opt/squarely/lan-printer-agent/dist/index.js
Restart=always
RestartSec=5
User=squarely

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now squarely-print-agent
sudo journalctl -u squarely-print-agent -f
```

### launchd (macOS)

A `~/Library/LaunchAgents/com.squarely.print-agent.plist` with `KeepAlive=true`
and `EnvironmentVariables` populated from your secret store works the same way.

## Failure modes

- **Sign-in failure** or **missing `active_merchant_id` claim** — the process
  exits 1 with a clear error. Re-check the user-setup steps.
- **Printer offline / wrong IP / non-ePOS device** — the job moves to
  `status='failed'`, `attempts` increments, `last_error` is truncated to 500
  chars. The agent does **not** auto-retry — a separate operator action or
  requeue mechanism must flip the row back to `queued`.
- **Concurrent agents** — the conditional `update ... where status='queued'`
  ensures only one worker wins each row. Safe to run multiple agents on the
  same merchant for redundancy.

## What's intentionally out of scope

- Cloud/Star/Bluetooth printer paths — this package only handles `kind='lan'`.
- Receipt XML construction — payloads must already be built by the producer
  (the mobile app or an Edge Function). The agent will SOAP-wrap raw ePOS XML
  if the payload doesn't already include `<s:Envelope ...>`.
