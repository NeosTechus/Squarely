# Scales (weighing items)

> Last updated: 2026-06-15 · Companion: `customer-facing-display.md`, `cash-drawer.md`

Squarely supports sold-by-weight items end-to-end at the data layer
(`items.sold_by_weight`, line-level unit weight on `order_items`). The
remaining piece is the physical scale → cashier-screen integration. This
doc explains the two paths we support today and the native-bridge path we
defer.

---

## TL;DR

- **Recommended hardware**: any scale that exposes itself as a USB HID
  keyboard (a "keyboard-wedge" scale). It types the weight into the
  focused text field — no driver, no native module, no permission.
- **Recommended UI**: in POS, tap a `sold_by_weight` item → the weight
  input is auto-focused → cashier presses **PRINT** on the scale →
  digits + newline arrive as keystrokes → POS calculates `price = unit_price * weight`.
- Wired-serial scales (RS-232) and Bluetooth SPP scales need a native
  module. Out of scope for v1 — see "Future" section.

---

## Path A: HID-wedge scale (works today, no code change)

The same pattern as a USB barcode scanner. The scale ships with (or is
configured for) **HID keyboard** output mode. It enumerates as a generic
keyboard on Android, ChromeOS, Windows, macOS, iPadOS — every platform
Squarely runs on.

### Known-good models
| Model | Vendor | Interface | Notes |
|---|---|---|---|
| **Brecknell 6710U** | Brecknell | USB-HID | Standard NTEP-certified bench scale. Default mode is HID-keyboard. |
| **Brecknell CCB** | Brecknell | USB-HID | Counting scale; same wedge output. |
| **CAS PD-II** | CAS | USB-HID | Price-computing scale; can be set to weight-only HID. |
| **Avery Berkel 6710** | Avery Berkel | USB-HID | Spec-equivalent to Brecknell 6710U. |
| **A&D EK-Series** | A&D | USB-HID (mode-switchable) | Hold "Mode" 3s to flip from RS-232 to HID. |

Anything else marketed as "POS scale" or "USB scale" is overwhelmingly
HID-keyboard out of the box.

### Cashier flow
1. Cashier taps a sold-by-weight item (e.g. "Bananas — $0.69/lb").
2. POS opens the modal; the weight input is auto-focused.
3. Cashier puts the produce on the scale; presses **PRINT** (or **TARE → PRINT** to subtract tare).
4. Scale types e.g. `1.420\n` into the field.
5. POS reads, computes `price_cents = round(unit_price_cents * weight)`, adds the line.

### Setup checklist
- [ ] Plug scale into the tablet's USB-OTG hub.
- [ ] Confirm Android shows it as "USB Keyboard" in *Settings → Connected devices*.
- [ ] In POS, open a sold-by-weight item; tap weight field; press **PRINT** on the scale; confirm digits appear.
- [ ] If the scale appends a trailing letter (e.g. `1.420lb\n`) → flip the scale's "unit suffix" option off, or strip non-digit chars in the input handler (already done in `apps/mobile/components/WeightInput.tsx`).

### Troubleshooting
- **Nothing arrives** → the scale is in RS-232 mode. Switch with the menu / DIP switch (model-dependent).
- **Digits land in the wrong field** → the weight input lost focus (e.g. a notification took focus). The modal pins focus on mount; bug-report if it slips.
- **Spurious newlines** → the scale is sending CR+LF; the input handler treats either as "submit weight."
- **Leading zero (`001.420`)** → harmless; the parser strips it.

---

## Path B: Native scale module (deferred)

A "real" scale integration would:
1. Open the USB-CDC / RS-232 / Bluetooth-SPP socket.
2. Stream continuous weight readings.
3. Show live weight on the cashier screen (the bouncing-decimal effect).
4. Auto-capture when the scale signals stable (NTEP **MOTION** = false).

This requires:
- A native module bridging `react-native-usb-serialport` / `react-native-ble-plx` to a JS interface.
- Permission strings in `app.config.ts` (`android.permissions` += BLUETOOTH_CONNECT, BLUETOOTH_SCAN, or USB host-mode).
- A scale-protocol parser per family (Mettler MT-SICS, Avery, NCI 9090, CAS S2000, …).
- An Android `USB_DEVICE_ATTACHED` intent filter so the OS routes the device to our app rather than holding it for the system keyboard driver.

Concrete next step when we pick this up: pin a single scale model
(probably the Brecknell 6710U in RS-232 mode via USB-to-RS232 adapter)
and ship a minimal CDC bridge that reads continuous weight. The Path A
HID-wedge remains the production default; Path B becomes the "live weight
preview" upgrade.

---

## Schema reference

```sql
items.sold_by_weight    boolean     -- when true, ringing requires a weight
items.unit_label        text        -- "lb" / "kg" / "oz" — display only
order_items.quantity    int         -- for sold_by_weight, this is weight × 1000
                                    -- (i.e. milli-units) so it's always an integer
order_items.unit_price_cents int    -- price per unit_label (per lb / per kg)
```

The `quantity × 1000` trick avoids floating-point cents in the totals
ledger. `WeightInput.tsx` does the conversion at write time.

---

## Future work

- Live weight preview (Path B).
- Calibration-day reminder (NTEP scales need annual cert).
- Auto-detect connected scale via WebHID on the kiosk web build (when we
  ship a browser-based kiosk).
- Multi-scale support (e.g. one for produce, one for bulk goods) — pick
  by item category.
