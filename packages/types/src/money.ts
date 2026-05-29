// Pure money math shared by POS, Kiosk, and web. All amounts are integer cents.

export interface PricedModifier {
  price_delta_cents: number;
}
export interface PricedLine {
  unit_price_cents: number;
  quantity: number;
  modifiers?: PricedModifier[];
}

/** Sum of a line's modifier price deltas. */
export function modifierDeltaCents(mods?: PricedModifier[] | null): number {
  return (mods ?? []).reduce((s, m) => s + m.price_delta_cents, 0);
}

/** A single line total: (base + modifier deltas) × quantity. */
export function lineTotalCents(line: PricedLine): number {
  return (line.unit_price_cents + modifierDeltaCents(line.modifiers)) * line.quantity;
}

/** Cart subtotal across lines. */
export function subtotalCents(lines: PricedLine[]): number {
  return lines.reduce((s, l) => s + lineTotalCents(l), 0);
}

/** Tax on a subtotal given a rate in basis points (825 = 8.25%). */
export function taxCents(subtotalCents: number, bps: number): number {
  return Math.round((subtotalCents * bps) / 10000);
}

/** Grand total = subtotal + tax + tip. */
export function grandTotalCents(subtotal: number, tax: number, tip: number): number {
  return subtotal + tax + tip;
}

/** Tip amount from a whole-number percentage of the subtotal. */
export function tipFromPercent(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}

/** For a split payment, the card portion = total − cash (never negative). */
export function splitCardCents(totalCents: number, cashCents: number): number {
  return Math.max(0, totalCents - cashCents);
}

/** A split is valid only when the cash part is > 0 and < total. */
export function isValidSplit(totalCents: number, cashCents: number): boolean {
  return cashCents > 0 && cashCents < totalCents;
}
