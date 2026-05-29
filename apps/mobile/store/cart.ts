import { create } from "zustand";
import { subtotalCents as computeSubtotal } from "@squarely/types";

export interface CartLine {
  id: string;
  item_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  modifiers: Array<{ id: string; name: string; price_delta_cents: number; group_id?: string }>;
  notes?: string;
}

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  removeLine: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  subtotalCents: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  addLine: (line) => set((s) => ({ lines: [...s.lines, line] })),
  removeLine: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
  setQuantity: (id, quantity) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id ? { ...l, quantity } : l)),
    })),
  clear: () => set({ lines: [] }),
  subtotalCents: () => computeSubtotal(get().lines),
}));
