import type { Order } from "@squarely/types";

export interface ReceiptHeader {
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  logoUrl?: string | null;
}

export interface ReceiptPaymentInfo {
  method: "card" | "cash" | "split" | "other";
  amountCents: number;
  tipCents?: number;
  maskedPan?: string | null;
  cardBrand?: string | null;
  authCode?: string | null;
  rrn?: string | null;
}

export interface ReceiptJob {
  header: ReceiptHeader;
  order: Order;
  payment?: ReceiptPaymentInfo;
  /** When true, append cash-drawer kick pulse to the ePOS XML. */
  openCashDrawer?: boolean;
  /** Print copies — 1 = customer, 2 = customer + kitchen, etc. */
  copies?: number;
}

export interface PrintResult {
  ok: boolean;
  via: "lan" | "cloud" | "none";
  error?: string;
}
