import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PaymentProvider } from "./provider";
import { SquareProvider } from "./square";
import { AdyenProvider } from "./adyen";
import { StripeProvider } from "./stripe";
import { CloverProvider } from "./clover";
import { ValorProvider } from "./valor";
import { PayPalProvider } from "./paypal";
import { AuthorizeNetProvider } from "./authorizenet";

// Cross-adapter refund contract tests. These pin the type-level invariant
// added when PaymentProvider.refund's `currency` parameter became required:
//
//   refund(paymentId: string, amountCents: number, currency: string)
//
// Every adapter must accept the new shape; adapters that put currency on the
// wire must transmit it; adapters that derive it upstream must not.

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("PaymentProvider.refund — currency is required at the type level", () => {
  it("all adapters satisfy the (id, cents, currency) signature", () => {
    // If any adapter's refund signature drifts out of sync with the interface,
    // this assignment fails at compile time — locking the contract.
    const adapters: PaymentProvider[] = [
      new SquareProvider({ accessToken: "t", environment: "sandbox" }),
      new AdyenProvider({ apiKey: "k", environment: "test" }),
      new StripeProvider({ secretKey: "sk_test_x" }),
      new CloverProvider({ merchantId: "m", apiToken: "t", environment: "sandbox" }),
      new ValorProvider({ apiKey: "k" }),
      new PayPalProvider({ clientId: "c", clientSecret: "s", environment: "sandbox" }),
      new AuthorizeNetProvider({ apiLoginId: "l", transactionKey: "k", environment: "sandbox" }),
    ];
    expect(adapters.length).toBe(7);
    for (const a of adapters) {
      expect(typeof a.refund).toBe("function");
    }
  });

  // Calling .refund without `currency` must NOT compile. Each `@ts-expect-error`
  // below would itself trip if the signature was ever loosened back to optional.
  // Wrapped in a never-invoked function: we only need TypeScript to check the
  // expressions, not actually invoke them (calling without a currency would
  // hit the network with an undefined currency value at runtime).
  it("rejects refund() calls missing currency at the type level", () => {
    const _typecheck = () => {
      const sq = new SquareProvider({ accessToken: "t", environment: "sandbox" });
      const ad = new AdyenProvider({ apiKey: "k", environment: "test" });
      const st = new StripeProvider({ secretKey: "sk_test_x" });
      const cl = new CloverProvider({ merchantId: "m", apiToken: "t", environment: "sandbox" });
      const va = new ValorProvider({ apiKey: "k" });
      const pp = new PayPalProvider({ clientId: "c", clientSecret: "s", environment: "sandbox" });
      const an = new AuthorizeNetProvider({ apiLoginId: "l", transactionKey: "k", environment: "sandbox" });
      return [
        // @ts-expect-error currency is required
        sq.refund("p", 100),
        // @ts-expect-error currency is required
        ad.refund("p", 100),
        // @ts-expect-error currency is required
        st.refund("p", 100),
        // @ts-expect-error currency is required
        cl.refund("p", 100),
        // @ts-expect-error currency is required
        va.refund("p", 100),
        // @ts-expect-error currency is required
        pp.refund("p", 100),
        // @ts-expect-error currency is required
        an.refund("p", 100),
      ];
    };
    expect(typeof _typecheck).toBe("function");
  });
});

describe("ValorProvider.refund", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always puts currency on the wire (no conditional spread)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ refund_id: "r_1" }));
    const p = new ValorProvider({ apiKey: "k" });
    const result = await p.refund("tx_1", 1234, "EUR");
    expect(result.ok).toBe(true);
    expect(result.refund_id).toBe("r_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ transaction_id: "tx_1", amount: "12.34", currency: "EUR" });
  });
});

describe("StripeProvider.refund — currency not on the wire", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts currency to honor the contract but does not include it in the form body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "re_1" }));
    const p = new StripeProvider({ secretKey: "sk_test_x" });
    const result = await p.refund("pi_1", 500, "USD");
    expect(result.ok).toBe(true);
    expect(result.refund_id).toBe("re_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = (init as RequestInit).body as string;
    // form-encoded body: payment_intent=pi_1&amount=500 — no currency=
    expect(body).not.toMatch(/currency/i);
    expect(body).toMatch(/payment_intent=pi_1/);
    expect(body).toMatch(/amount=500/);
  });
});

describe("CloverProvider.refund — currency derived from merchant account", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts currency to honor the contract but does not include it in the JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "ref_1" }));
    const p = new CloverProvider({ merchantId: "m", apiToken: "t", environment: "sandbox" });
    const result = await p.refund("pay_1", 750, "USD");
    expect(result.ok).toBe(true);
    expect(result.refund_id).toBe("ref_1");
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.currency).toBeUndefined();
    expect(body.amount).toBe(750);
  });
});

describe("PayPalProvider.refund — unimplemented, contract accepts currency", () => {
  it("returns ok:false without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const p = new PayPalProvider({ clientId: "c", clientSecret: "s", environment: "sandbox" });
      const result = await p.refund("ord_1", 100, "USD");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not implemented/i);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("AuthorizeNetProvider.refund — unimplemented, contract accepts currency", () => {
  it("returns ok:false without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const p = new AuthorizeNetProvider({ apiLoginId: "l", transactionKey: "k", environment: "sandbox" });
      const result = await p.refund("tx_1", 100, "USD");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not implemented/i);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
