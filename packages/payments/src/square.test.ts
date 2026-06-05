import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SquareProvider } from "./square";

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

const cfg = { accessToken: "t", locationId: "L", environment: "sandbox" } as const;

describe("SquareProvider.refund — currency safety", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("without currency returns ok:false and does NOT call fetch (no silent USD)", async () => {
    const p = new SquareProvider(cfg);
    const result = await p.refund("pay_123", 500);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/currency/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with currency posts /v2/refunds with amount_money.currency on the wire", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ refund: { id: "r_1" } }));
    const p = new SquareProvider(cfg);
    const result = await p.refund("pay_123", 500, "USD");
    expect(result.ok).toBe(true);
    expect(result.refund_id).toBe("r_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/v2\/refunds$/);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.amount_money).toEqual({ amount: 500, currency: "USD" });
    expect(body.payment_id).toBe("pay_123");
  });
});
