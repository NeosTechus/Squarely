# Cash Drawer

> Last updated: 2026-06-15 · Companion: `scales.md`, `customer-facing-display.md`

Squarely opens the cash drawer in two situations:
1. **Auto-kick on cash sales** — the moment a cash receipt prints, the
   drawer pops so the cashier can make change without an extra tap.
2. **Manual pop** — the cashier presses **Open drawer** in the dashboard
   (or, when shipped, in the mobile POS) to make change between sales or
   during shift close.

Both paths route through the **same** ePOS-XML pulse and the **same**
print-job queue, so a single LAN print agent (or cloud SDP push) handles
both with no extra hardware.

---

## Hardware setup

Cash drawers wire to the **DK port** (RJ-12 jack) on a receipt printer.
You do NOT plug the drawer directly into the tablet — it hangs off the
back of the printer.

| Drawer | Connector | Compatible printers |
|---|---|---|
| **APG VB320, Vasario series** | RJ-12 (6-pin) | Epson TM-T20II/III, TM-T88V/VI/VII, Star TSP100 |
| **MMF Advantage** | RJ-12 | Same |
| **Sparco / VFI / generic** | RJ-12 | Same |
| **Bluetooth drawers (rare)** | n/a | Not supported — needs native bridge |

Most drawers ship with 24V solenoid coils; almost every modern Epson
ESC-POS printer pulses at 24V on DK. If your drawer is 12V (uncommon),
check the printer's DIP switches.

### When you add the printer in Squarely
- Mark **Supports cash drawer** = ON if a drawer is plugged into the
  printer's DK port. Squarely reads this flag before queuing a pulse.
- If a printer is shared (one drawer for two registers), point both
  registers at the same printer; whichever rings cash kicks the drawer.

---

## How auto-kick works

When the mobile POS posts to `/api/printers/dispatch` after a sale:

1. Dispatch route reads `orders.payment_method`.
2. If `payment_method === 'cash'` **AND** the resolved printer has
   `supports_cash_drawer === true`, it passes `openCashDrawer: true`
   to `buildReceiptXml`.
3. `buildReceiptXml` appends `<pulse drawer="drawer_1" time="pulse_100"/>`
   to the ePOS XML.
4. The job lands in `print_jobs` with `kick_drawer = true` (for
   observability — the LAN agent doesn't need to read it because the
   pulse is already embedded in the payload).
5. LAN agent posts the XML to the printer. The printer pulses the
   drawer the moment it finishes cutting the receipt.

Net effect: **single cash sale = receipt cuts → drawer pops**, no extra
tap, no extra command.

---

## How manual pop works

Cashier presses **Open drawer** on a printer in
`/dashboard/devices` (or, in the mobile follow-up, on a "register
toolbar" button).

1. Browser POSTs `/api/printers/kick` with the printer id.
2. Server resolves the caller's active merchant, scopes the printer
   to that merchant, then writes a row to `print_jobs` with:
   - `job_type = 'drawer_pop'`
   - `order_id = NULL`
   - `payload = <ePOS XML containing only the pulse element>`
   - `kick_drawer = true`
3. LAN agent claims the row through the same conditional-UPDATE
   pattern as receipts, posts the pulse-only XML to the printer.
4. Drawer pops. No paper feeds, no cut.

### Permission model

Any active merchant member can manual-pop. Cashiers do this all shift;
restricting it to manager+ would mean handing over a badge for every
fiver of change.

### Rate limit

30 pops/min/user (in-process token bucket). This is for runaway-client
protection, not security — physically you can't hammer the drawer
faster than the solenoid recovery time anyway (~250ms).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Drawer doesn't pop on cash sale | "Supports cash drawer" was left OFF when adding the printer | Edit the printer, toggle ON. |
| Drawer pops on every receipt (incl. card) | `orders.payment_method` is being recorded as `cash` even for card transactions | Audit the POS payment flow — likely a test merchant with a hard-coded method. |
| Pulse is too short — drawer doesn't fully open | Solenoid needs a longer pulse | Edit `packages/printing/src/xml.ts` and bump `pulse_100` → `pulse_500`. The "100" is in ms; some older drawers need 200-300. |
| Drawer pops but then immediately slams shut | Drawer return spring is too strong / cash drawer is closing on its own weight | Mechanical issue with the drawer; nothing on our side. |
| No-printer error on **Open drawer** | The merchant has no LAN/cloud printer that's both `active=true` AND `supports_cash_drawer=true` | Add a printer and tick the drawer checkbox. |
| Drawer pops 30s late | LAN agent isn't running on the venue laptop, OR network is dropping packets to the printer | `systemctl status squarely-lan-printer-agent` (or the equivalent service mgr) on the venue laptop. |

---

## Schema reference

```sql
-- Printer carries the "drawer is wired" flag.
alter table printers add column supports_cash_drawer boolean not null default true;

-- print_jobs gets a discriminator + nullable order_id for drawer-only pops.
alter table print_jobs
  add column kick_drawer boolean not null default false,
  add column job_type text not null default 'receipt'
    check (job_type in ('receipt','drawer_pop')),
  alter column order_id drop not null;
```

`kick_drawer = true` is the LAN agent's hint that this job's payload
contains a drawer pulse — useful for the agent's dashboard / metrics
even though the pulse XML is already embedded.

---

## Future work

- Open-drawer audit log (who popped, when, no associated order) — write a
  row to `admin_audit` from `/api/printers/kick` so shift-close
  reconciliation can show "manual pops since last close."
- Per-cashier drawer assignment (one drawer per register in two-register
  shops) — already supported by passing an explicit `printerId`; surface
  in the UI.
- "Force open" recovery — when the solenoid jams, expose a low-level
  ESC-POS command (`0x1B 0x70 0x00 0xFF 0xFF`) to send the longest legal
  pulse.
