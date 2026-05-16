import type { PublishSaleInput } from "@squarely/types";
import type {
  PaymentProvider,
  PaymentStatus,
  PublishSaleResult,
} from "./provider";

export interface ValorConfig {
  apiKey: string;
  apiBase?: string;
}

export class ValorProvider implements PaymentProvider {
  readonly name = "valor" as const;

  constructor(private cfg: ValorConfig) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  private base() {
    return this.cfg.apiBase ?? "https://api.valorpaytech.com";
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    const res = await fetch(`${this.base()}/transactions/sale`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        epi: input.terminal_id,
        order_id: input.order_id,
        amount: (input.amount_cents / 100).toFixed(2),
        tip: (input.tip_cents / 100).toFixed(2),
        currency: input.currency,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        provider_payment_id: null,
        poll_token: null,
        error: `Valor publish failed: HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as { order_id?: string; transaction_id?: string };
    return {
      ok: true,
      provider_payment_id: json.transaction_id ?? null,
      poll_token: json.order_id ?? input.order_id,
    };
  }

  async checkStatus(
    pollToken: string,
    opts?: { merchantId: string; terminalId: string },
  ): Promise<PaymentStatus> {
    const params = new URLSearchParams({ order_id: pollToken });
    if (opts?.terminalId) params.set("epi", opts.terminalId);
    const res = await fetch(`${this.base()}/transactions/status?${params}`, {
      headers: this.headers(),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const status = String(json.status ?? "pending");
    return {
      status:
        status === "approved" || status === "succeeded"
          ? "succeeded"
          : status === "declined" || status === "failed"
            ? "failed"
            : status === "cancelled"
              ? "cancelled"
              : "pending",
      amount_cents: typeof json.amount === "number" ? Math.round(json.amount * 100) : null,
      masked_pan: (json.masked_pan as string) ?? null,
      card_brand: (json.card_brand as string) ?? null,
      auth_code: (json.auth_code as string) ?? null,
      rrn: (json.rrn as string) ?? null,
      raw: json,
    };
  }

  async cancel(
    pollToken: string,
    opts?: { merchantId: string; terminalId: string },
  ): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.base()}/transactions/cancel`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ order_id: pollToken, epi: opts?.terminalId }),
    });
    return { ok: res.ok };
  }

  async refund(paymentId: string, amountCents: number) {
    const res = await fetch(`${this.base()}/transactions/refund`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        transaction_id: paymentId,
        amount: (amountCents / 100).toFixed(2),
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { refund_id?: string };
    return { ok: true, refund_id: json.refund_id };
  }
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
