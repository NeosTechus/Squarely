import { useMemo } from "react";
import { View } from "react-native";
import qrcode from "qrcode-generator";

/** Renders a QR code as a grid of Views (no native deps). */
export function UpiQr({ value, size = 220 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const grid: boolean[][] = [];
    for (let r = 0; r < count; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
      grid.push(row);
    }
    return grid;
  }, [value]);

  const cell = cells.length ? size / cells.length : 0;
  return (
    <View style={{ width: size, height: size, backgroundColor: "#fff" }}>
      {cells.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark ? "#000000" : "#ffffff" }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Build a UPI deep-link / QR payload for a dynamic amount (INR). */
export function buildUpiUri(opts: { vpa: string; payeeName: string; amountCents: number; note?: string }): string {
  // Build manually with encodeURIComponent so spaces become %20, not "+"
  // (URLSearchParams uses form-encoding; some UPI apps render the "+" literally).
  const pairs: [string, string][] = [
    ["pa", opts.vpa],
    ["pn", opts.payeeName],
    ["am", (opts.amountCents / 100).toFixed(2)],
    ["cu", "INR"],
  ];
  if (opts.note) pairs.push(["tn", opts.note]);
  const query = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `upi://pay?${query}`;
}
