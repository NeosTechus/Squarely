import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AdyenProvider } from "./adyen";

// Build a Response-shaped object for the global fetch stub. The adapter only
// touches `ok`, `status`, and `json()`, so we don't need a full Response.
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

// Construct the nested SaleToPOIResponse Adyen returns for TransactionStatus.
function tsr(opts: {
  innerResult?: "Success" | "Failure";
  innerErrorCondition?: string;
  outerResult?: "Success" | "Failure";
  outerErrorCondition?: string;
  paymentResult?: Record<string, unknown>;
  omitPaymentResponse?: boolean;
}) {
  const payResp = opts.omitPaymentResponse
    ? undefined
    : {
        Response: {
          Result: opts.innerResult,
          ErrorCondition: opts.innerErrorCondition,
        },
        PaymentResult: opts.paymentResult,
      };
  return {
    SaleToPOIResponse: {
      TransactionStatusResponse: {
        Response: {
          Result: opts.outerResult,
          ErrorCondition: opts.outerErrorCondition,
        },
        RepeatedMessageResponse: payResp
          ? { RepeatedResponseMessageBody: { PaymentResponse: payResp } }
          : {},
      },
    },
  };
}

const baseCfg = { apiKey: "k", merchantAccount: "m", poiId: "V400m-1", environment: "test" } as const;

describe("AdyenProvider.checkStatus", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps inner Success to succeeded", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        tsr({
          innerResult: "Success",
          paymentResult: {
            AmountsResp: { AuthorizedAmount: 12.34 },
            PaymentInstrumentData: { CardData: { MaskedPan: "411111******1111", PaymentBrand: "visa" } },
            PaymentAcquirerData: { ApprovalCode: "OK1234" },
          },
        }),
      ),
    );
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("svc-1");
    expect(result.status).toBe("succeeded");
    expect(result.amount_cents).toBe(1234);
    expect(result.masked_pan).toBe("411111******1111");
    expect(result.card_brand).toBe("visa");
    expect(result.auth_code).toBe("OK1234");
  });

  it("maps inner Failure + Cancel condition to cancelled", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(tsr({ innerResult: "Failure", innerErrorCondition: "Cancel" })),
    );
    const p = new AdyenProvider(baseCfg);
    expect((await p.checkStatus("svc-1")).status).toBe("cancelled");
  });

  it("maps inner Failure + Aborted condition to cancelled", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(tsr({ innerResult: "Failure", innerErrorCondition: "Aborted" })),
    );
    const p = new AdyenProvider(baseCfg);
    expect((await p.checkStatus("svc-1")).status).toBe("cancelled");
  });

  it("maps inner Failure + other condition to failed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(tsr({ innerResult: "Failure", innerErrorCondition: "Refusal" })),
    );
    const p = new AdyenProvider(baseCfg);
    expect((await p.checkStatus("svc-1")).status).toBe("failed");
  });

  it("returns pending when PaymentResponse missing from RepeatedMessageResponse", async () => {
    const body = tsr({ omitPaymentResponse: true });
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("svc-1");
    expect(result.status).toBe("pending");
    expect(result.raw).toEqual(body);
  });

  it("returns pending when outer Failure + InProgress", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        tsr({ omitPaymentResponse: true, outerResult: "Failure", outerErrorCondition: "InProgress" }),
      ),
    );
    const p = new AdyenProvider(baseCfg);
    expect((await p.checkStatus("svc-1")).status).toBe("pending");
  });

  it("never promotes outer Failure (non-InProgress) to succeeded — stays pending", async () => {
    // Definitive: status-read failure with no inner PaymentResponse must NOT be succeeded.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        tsr({ omitPaymentResponse: true, outerResult: "Failure", outerErrorCondition: "DeviceOut" }),
      ),
    );
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("svc-1");
    expect(result.status).toBe("pending");
    expect(result.status).not.toBe("succeeded");
  });

  it("returns empty pending on fetch network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("svc-1");
    expect(result).toEqual({
      status: "pending",
      amount_cents: null,
      masked_pan: null,
      card_brand: null,
      auth_code: null,
      rrn: null,
      raw: null,
    });
  });

  it("returns pending with raw on non-ok HTTP", async () => {
    const errBody = { error: "boom" };
    fetchMock.mockResolvedValueOnce(jsonResponse(errBody, { ok: false, status: 500 }));
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("svc-1");
    expect(result.status).toBe("pending");
    expect(result.raw).toEqual(errBody);
  });

  it("returns pending immediately when poiId missing and does NOT call fetch", async () => {
    const p = new AdyenProvider({ apiKey: "k", environment: "test" });
    const result = await p.checkStatus("svc-1");
    expect(result.status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns pending immediately when pollToken empty and does NOT call fetch", async () => {
    const p = new AdyenProvider(baseCfg);
    const result = await p.checkStatus("");
    expect(result.status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AdyenProvider.refund", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refund without currency is a compile-time error (type-level invariant)", () => {
    // The PaymentProvider.refund contract requires `currency`. This call must
    // not compile — `@ts-expect-error` locks the type-level guarantee so a
    // future regression that re-loosens the signature trips the test build.
    // We never execute the call (would fault at runtime with no currency),
    // we just need the expression to be type-checked.
    const _typecheck = () => {
      const p = new AdyenProvider(baseCfg);
      // @ts-expect-error currency is required at the type level
      return p.refund("psp_1", 500);
    };
    expect(typeof _typecheck).toBe("function");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with currency calls refund endpoint with amount.currency on the wire", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ pspReference: "ref_1" }));
    const p = new AdyenProvider(baseCfg);
    const result = await p.refund("psp_1", 500, "EUR");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.amount).toEqual({ currency: "EUR", value: 500 });
  });
});
