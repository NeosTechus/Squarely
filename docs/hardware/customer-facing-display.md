# Customer-Facing Display (CFD)

> Last updated: 2026-06-15 · Companion: `scales.md`, `cash-drawer.md`

A CFD is the second screen behind / next to your cash register that
shows the customer what's being rung up in real time — running cart,
running total, and a "thank you" once payment clears. Squarely ships
this as a public web page, not a native app, so any browser on any
device can serve as a CFD.

---

## What you see on the screen

```
+----------------------------------------------------------+
|  CORNER COFFEE                                           |
|  Your order                                              |
+----------------------------------------+-----------------+
|  2 × House Latte           $9.00       | Subtotal $9.00  |
|     oat milk, extra shot               | Tax      $0.72  |
|                                        |                 |
|  1 × Almond Croissant      $4.25       | TOTAL  $13.97   |
|                                        |                 |
+----------------------------------------+-----------------+
```

When payment clears the same screen flips to a thank-you panel for ~5
seconds before going idle, ready for the next customer.

---

## How to set it up

### 1. Pick a device
Anything with a browser. Common choices:
- An old Android tablet on a counter mount.
- A Chromecast / Fire TV / cheap mini-PC driving a small HDMI monitor.
- An iPad in Guided Access mode.

Cabling: HDMI for a fixed install, Wi-Fi only for a tablet.

### 2. Open the URL
```
https://app.squarely.com/cfd/<your-merchant-slug>
```
You can find your slug under **Dashboard → Settings → Store URL** (e.g.
if your dashboard URL is `app.squarely.com/m/corner-coffee`, the slug
is `corner-coffee`).

Optional: tie the screen to a specific cashier station by appending
`?device=<device-uuid>`. With no `device` param, the CFD mirrors a
single shared cart for the whole merchant (fine for one-register
shops).

### 3. Pin the tab full-screen
- On Chrome / Edge: `Ctrl+Shift+B` to hide the bookmarks bar, then
  `F11` to enter full-screen.
- On Android Chrome: install as a PWA from the menu, then "Add to home
  screen" → opens as a borderless app.
- On Fire TV: use the "Web Browser by Amazon" → save as bookmark on
  the home row.

---

## How it works (for the curious)

1. **Cashier rings an item** in POS / Register / Kiosk on the mobile app.
2. **Mobile pushes** the cart snapshot to `public.cfd_state` keyed by
   `(merchant_id, device_id)` — one row per cashier station, or the
   single null-device row for shared CFDs.
3. **CFD page** subscribes to that row over Supabase Realtime
   (`postgres_changes` on `cfd_state`).
4. **Receipt arrives in ~100ms.** No polling, no refresh.
5. When the order's `payment_status` flips to `paid`, mobile writes
   `{paid: true, payment_method: "card"}` into the same row. The CFD
   page flashes the thank-you panel.
6. After ~5s of idle (no updates), mobile resets the cart payload to
   `{items: []}`. The screen goes back to "Ready when you are."

---

## Security model

- The CFD URL is **public** — no authentication, anyone with the link
  can see it. This is by design (the screen lives in the customer's
  line of sight; pointing a friend at the URL just lets them watch a
  cart, not change it).
- The page reads `cfd_state` via the SECURITY DEFINER RPC `get_cfd_state(slug, device_id)`. The underlying table has RLS that
  blocks anon SELECT entirely.
- The merchant slug is the only thing in the URL. The merchant's UUID
  is never exposed. A scraper trying to enumerate slugs would still
  only see cart state for stores they could already discover via the
  marketing site.
- We render **only** item names, quantities, modifier descriptions,
  and totals. Customer name / phone / email are never on the CFD.
  Payment method ("card" / "cash") shows on the thank-you panel but
  the masked PAN does not.

---

## Hardware tips

- **Brightness**: keep it lower than the cashier screen. The customer
  is reading from 2-3 feet away.
- **Orientation**: portrait is fine for narrow counters; the layout
  reflows. We auto-pick a font size based on viewport width.
- **Burn-in (OLED)**: the layout includes a per-frame `updated_at`
  micro-tick at the bottom; for OLED CFDs, swap to an LCD or shift
  the layout every 10 min via a CSS animation (not yet shipped).
- **Idle dim**: configure the OS's screen-off after 10 min. The CFD
  page reconnects on visibility-change.

---

## Troubleshooting

- **"Connecting…" and never updates** → POS hasn't pushed cart state
  yet. Open a Register session and add an item; the CFD will jump to
  it within a second.
- **Screen shows another store's cart** → wrong slug in the URL.
- **Two CFDs are out of sync** → you probably opened both with no
  `?device=` param AND have two cashiers ringing concurrently. Bind
  each station to its own device id via `?device=<uuid>`. Find the
  uuid under **Dashboard → Devices**.
- **CFD page loads but realtime never connects** → check the network
  tab for blocked WebSocket frames (some corporate firewalls block
  Supabase Realtime). Squarely will fall back to a 10-second poll on
  the RPC in this case (planned, not yet shipped).

---

## Schema reference

```sql
create table public.cfd_state (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (merchant_id, device_id)
);
```

Expected `state` payload shape (POS writes; CFD reads):
```jsonc
{
  "items": [
    { "name": "House Latte", "quantity": 2, "unit_price_cents": 450,
      "modifier_summary": "oat milk, extra shot" }
  ],
  "subtotal_cents": 1325,
  "tax_cents": 72,
  "tip_cents": 0,
  "total_cents": 1397,
  "merchant_name": "Corner Coffee",
  "brand_color": "#4f46e5",
  "paid": false
}
```

---

## Mobile follow-up (not yet wired)

The CFD page is fully functional today; what's pending is the mobile
side **writing** `cfd_state` on every cart change. Until that lands, an
operator can demo the screen by manually inserting / updating a row in
the Supabase dashboard. Implementation sketch (1 helper):

```ts
// apps/mobile/lib/pushCfdState.ts
export async function pushCfdState(
  merchantId: string,
  deviceId: string | null,
  state: CartState,
) {
  await supabase.from("cfd_state").upsert({
    merchant_id: merchantId,
    device_id: deviceId,
    state,
    updated_at: new Date().toISOString(),
  }, { onConflict: "merchant_id,device_id" });
}
```
Call this from the cart store on every `addItem` / `removeItem` /
`updateQuantity` / `applyDiscount` / payment-success. Throttle to 1
write per 200ms with `setTimeout` to avoid hammering Postgres on a
typing barcode-scanner ring.

Will be picked up in the next mobile build.
