/**
 * Tests for the shared webhook signature harness.
 *
 * Strategy:
 *   - Stripe: mock the @squarely/billing boundary so we exercise
 *     verifyWebhook's contract (header presence, secret presence, error->ok
 *     mapping) WITHOUT pulling in the real Stripe SDK or a network round-trip.
 *   - HMAC-SHA256 and HMAC-SHA1: genuine end-to-end. We compute the expected
 *     MAC with node:crypto and feed it through verifyWebhook, which proves
 *     the constant-time comparator and the scheme-prefix stripping behave
 *     correctly. A mock-only test for these would prove nothing useful.
 *
 * Picked up automatically by the repo's vitest.config.ts (include glob
 * `apps/**\/*.test.ts`); no extra wiring needed.
 */
import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Stripe SDK boundary so tests don't need STRIPE_SECRET_KEY and the
// real `stripe` constructor never runs in CI.
const constructEvent = vi.fn();
vi.mock("@squarely/billing", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

// SUT is imported AFTER vi.mock so the mocked module is what verifyWebhook
// resolves against. (vi.mock is hoisted, but keeping the import below makes
// the dependency order visually obvious.)
import { verifyWebhook } from "./webhookSignature";

function makeReq(
  body: string,
  headers: Record<string, string> = {},
  url = "https://x.test/hook",
) {
  return new Request(url, { method: "POST", body, headers });
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

describe("verifyWebhook — stripe", () => {
  beforeEach(() => constructEvent.mockReset());

  it("returns ok with the parsed event when the signature is valid", async () => {
    const event = { id: "evt_1", type: "customer.subscription.updated" };
    constructEvent.mockReturnValueOnce(event);

    const r = await verifyWebhook(
      makeReq('{"x":1}', { "stripe-signature": "t=1,v1=abc" }),
      { kind: "stripe", secret: "whsec_test" },
    );

    expect(r).toEqual({ ok: true, payload: event, raw: '{"x":1}' });
    expect(constructEvent).toHaveBeenCalledWith('{"x":1}', "t=1,v1=abc", "whsec_test");
  });

  it("returns invalid-signature when the SDK throws", async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error("bad sig");
    });

    const r = await verifyWebhook(
      makeReq("{}", { "stripe-signature": "t=1,v1=zzz" }),
      { kind: "stripe", secret: "whsec_test" },
    );

    expect(r).toEqual({ ok: false, error: "invalid-signature" });
  });

  it("returns missing-signature when the stripe-signature header is absent", async () => {
    const r = await verifyWebhook(makeReq("{}"), {
      kind: "stripe",
      secret: "whsec_test",
    });

    expect(r).toEqual({ ok: false, error: "missing-signature" });
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("returns missing-secret when STRIPE_WEBHOOK_SECRET is blank", async () => {
    const r = await verifyWebhook(
      makeReq("{}", { "stripe-signature": "t=1,v1=abc" }),
      { kind: "stripe", secret: "" },
    );

    expect(r).toEqual({ ok: false, error: "missing-secret" });
    expect(constructEvent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// HMAC-SHA256 (generic)
// ---------------------------------------------------------------------------

describe("verifyWebhook — hmacSha256", () => {
  const secret = "shhh";
  const body = JSON.stringify({ hello: "world" });
  const mac = crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a correctly computed MAC and parses JSON", async () => {
    const r = await verifyWebhook<{ hello: string }>(
      makeReq(body, { "x-sig": mac }),
      { kind: "hmacSha256", secret, header: "x-sig" },
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).toEqual({ hello: "world" });
      expect(r.raw).toBe(body);
    }
  });

  it("accepts a scheme-prefixed MAC like `sha256=<hex>` (GitHub-style)", async () => {
    const r = await verifyWebhook(
      makeReq(body, { "x-sig": `sha256=${mac}` }),
      { kind: "hmacSha256", secret, header: "x-sig" },
    );

    expect(r.ok).toBe(true);
  });

  it("rejects a tampered MAC as invalid-signature", async () => {
    const tampered = mac.replace(/.$/, mac.endsWith("0") ? "1" : "0");
    const r = await verifyWebhook(
      makeReq(body, { "x-sig": tampered }),
      { kind: "hmacSha256", secret, header: "x-sig" },
    );

    expect(r).toEqual({ ok: false, error: "invalid-signature" });
  });

  it("returns missing-signature when the configured header is absent", async () => {
    const r = await verifyWebhook(makeReq(body), {
      kind: "hmacSha256",
      secret,
      header: "x-sig",
    });

    expect(r).toEqual({ ok: false, error: "missing-signature" });
  });
});

// ---------------------------------------------------------------------------
// HMAC-SHA1 (generic)
// ---------------------------------------------------------------------------

describe("verifyWebhook — hmacSha1", () => {
  const secret = "topsecret";
  const body = "ping=pong&n=1";
  const mac = crypto.createHmac("sha1", secret).update(body).digest("hex");

  it("accepts a correctly computed MAC", async () => {
    const r = await verifyWebhook(
      makeReq(body, { "x-sig": mac }),
      { kind: "hmacSha1", secret, header: "x-sig" },
    );

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.raw).toBe(body);
  });

  it("rejects a tampered MAC as invalid-signature", async () => {
    const tampered = mac.replace(/.$/, mac.endsWith("0") ? "1" : "0");
    const r = await verifyWebhook(
      makeReq(body, { "x-sig": tampered }),
      { kind: "hmacSha1", secret, header: "x-sig" },
    );

    expect(r).toEqual({ ok: false, error: "invalid-signature" });
  });
});
