import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuthorizeNetProvider } from "./authorizenet";

// Note: Authorize.Net refund is intentionally unimplemented in the adapter
// (the API derives currency from the original transaction), so this file does
// NOT assert refund behaviour — see adyen.test.ts / square.test.ts for the
// refund-currency-guard regression coverage.

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

function txnBody(transactionStatus: string | undefined, extra: Record<string, unknown> = {}) {
  return { transaction: { transactionStatus, ...extra } };
}

const cfg = { apiLoginId: "a", transactionKey: "k", environment: "sandbox" } as const;

describe("AuthorizeNetProvider.checkStatus", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("settledSuccessfully maps to succeeded and surfaces card + auth code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        txnBody("settledSuccessfully", {
          authAmount: 12.34,
          authCode: "AUTH1",
          payment: { creditCard: { cardNumber: "XXXX1111", cardType: "Visa" } },
        }),
      ),
    );
    const p = new AuthorizeNetProvider(cfg);
    const result = await p.checkStatus("tx_1");
    expect(result.status).toBe("succeeded");
    expect(result.amount_cents).toBe(1234);
    expect(result.auth_code).toBe("AUTH1");
    expect(result.masked_pan).toBe("XXXX1111");
    expect(result.card_brand).toBe("Visa");
  });

  it("capturedPendingSettlement maps to succeeded", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(txnBody("capturedPendingSettlement")));
    const p = new AuthorizeNetProvider(cfg);
    expect((await p.checkStatus("tx_1")).status).toBe("succeeded");
  });

  it("voided maps to cancelled", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(txnBody("voided")));
    const p = new AuthorizeNetProvider(cfg);
    expect((await p.checkStatus("tx_1")).status).toBe("cancelled");
  });

  it("declined maps to failed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(txnBody("declined")));
    const p = new AuthorizeNetProvider(cfg);
    expect((await p.checkStatus("tx_1")).status).toBe("failed");
  });

  it("generalError maps to failed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(txnBody("generalError")));
    const p = new AuthorizeNetProvider(cfg);
    expect((await p.checkStatus("tx_1")).status).toBe("failed");
  });

  it("FDSPendingReview maps to pending (never succeeded)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(txnBody("FDSPendingReview")));
    const p = new AuthorizeNetProvider(cfg);
    const result = await p.checkStatus("tx_1");
    expect(result.status).toBe("pending");
    expect(result.status).not.toBe("succeeded");
  });

  it("missing transactionStatus maps to pending", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ transaction: {} }));
    const p = new AuthorizeNetProvider(cfg);
    expect((await p.checkStatus("tx_1")).status).toBe("pending");
  });

  it("returns empty pending on fetch network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const p = new AuthorizeNetProvider(cfg);
    const result = await p.checkStatus("tx_1");
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
    const p = new AuthorizeNetProvider(cfg);
    const result = await p.checkStatus("tx_1");
    expect(result.status).toBe("pending");
    expect(result.raw).toEqual(errBody);
  });

  it("empty pollToken returns pending immediately and does NOT call fetch", async () => {
    const p = new AuthorizeNetProvider(cfg);
    const result = await p.checkStatus("");
    expect(result.status).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
