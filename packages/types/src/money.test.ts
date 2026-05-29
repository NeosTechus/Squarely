import { describe, it, expect } from "vitest";
import {
  modifierDeltaCents,
  lineTotalCents,
  subtotalCents,
  taxCents,
  grandTotalCents,
  tipFromPercent,
  splitCardCents,
  isValidSplit,
} from "./money";

describe("modifierDeltaCents", () => {
  it("sums deltas, handles null/empty", () => {
    expect(modifierDeltaCents(null)).toBe(0);
    expect(modifierDeltaCents([])).toBe(0);
    expect(modifierDeltaCents([{ price_delta_cents: 50 }, { price_delta_cents: 60 }])).toBe(110);
    expect(modifierDeltaCents([{ price_delta_cents: -25 }])).toBe(-25);
  });
});

describe("lineTotalCents", () => {
  it("applies modifiers and quantity", () => {
    expect(lineTotalCents({ unit_price_cents: 300, quantity: 2 })).toBe(600);
    expect(lineTotalCents({ unit_price_cents: 300, quantity: 2, modifiers: [{ price_delta_cents: 50 }] })).toBe(700);
  });
});

describe("subtotalCents", () => {
  it("sums lines including modifiers", () => {
    expect(
      subtotalCents([
        { unit_price_cents: 300, quantity: 1, modifiers: [{ price_delta_cents: 100 }] }, // 400
        { unit_price_cents: 250, quantity: 2 }, // 500
      ]),
    ).toBe(900);
    expect(subtotalCents([])).toBe(0);
  });
});

describe("taxCents", () => {
  it("rounds tax from basis points", () => {
    expect(taxCents(1000, 825)).toBe(83); // 8.25% of $10 = $0.825 → 83¢
    expect(taxCents(900, 950)).toBe(86); // 9.5% of $9 = 85.5 → 86¢
    expect(taxCents(1000, 0)).toBe(0);
  });
});

describe("grandTotalCents", () => {
  it("adds subtotal, tax, tip", () => {
    expect(grandTotalCents(900, 86, 100)).toBe(1086);
  });
});

describe("tipFromPercent", () => {
  it("computes a percentage tip", () => {
    expect(tipFromPercent(1000, 15)).toBe(150);
    expect(tipFromPercent(999, 20)).toBe(200); // 199.8 → 200
    expect(tipFromPercent(1000, 0)).toBe(0);
  });
});

describe("split payment", () => {
  it("card portion is total minus cash, never negative", () => {
    expect(splitCardCents(1000, 400)).toBe(600);
    expect(splitCardCents(1000, 1200)).toBe(0);
  });
  it("valid only when cash is between 0 and total", () => {
    expect(isValidSplit(1000, 400)).toBe(true);
    expect(isValidSplit(1000, 0)).toBe(false);
    expect(isValidSplit(1000, 1000)).toBe(false);
    expect(isValidSplit(1000, 1500)).toBe(false);
  });
});
