/**
 * Cross-tenant read fuzz test.
 *
 * Hypothesis: a regular member of merchant A targeting a merchant B-owned
 * resource (order / printer) MUST NOT
 *   a) leak any data from merchant B back to the caller, nor
 *   b) trigger any external side effect (Resend email send, Twilio SMS send,
 *      gateway refund, print job enqueue).
 *
 * The four POST routes under test all share a common shape:
 *   1. Bearer JWT -> svc.auth.getUser
 *   2. Load the order (or printer) by id WITHOUT a merchant filter
 *   3. THEN check merchant_members + platform_admins
 * Step 2 is what makes a fuzz harness valuable: the merchB row is actually
 * loaded into memory; the membership guard is what stops the leak. A test
 * that only checks "route returns 403" without confirming the side effect
 * did NOT fire would miss any future regression where the guard moves AFTER
 * the side effect.
 *
 * For each of the four routes we run two cases:
 *   - merchA member  -> 403/404, NO side effect (cross-tenant blocked)
 *   - platform admin -> 200,     side effect fires once (positive control,
 *     keeps cross-tenant admin tooling green)
 *
 * The platform-admin positive control is the most valuable assertion in the
 * file: it prevents the regression where a future hardening adds
 * `.eq('merchant_id', userMerchantId)` to the order query and accidentally
 * locks platform admins out.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// -----------------------------------------------------------------------------
// 1. Env stubs MUST be in place before the route modules import — receipts/email
//    and receipts/sms early-return 503 if their secrets are missing, which
//    would mask the auth path entirely and produce false-positive "denial"
//    results.
// -----------------------------------------------------------------------------
process.env.RESEND_API_KEY = "test-resend-key";
process.env.EMAIL_FROM = "test@example.com";
process.env.TWILIO_ACCOUNT_SID = "AC_test";
process.env.TWILIO_AUTH_TOKEN = "tw_test_token";
process.env.TWILIO_FROM_NUMBER = "+15555550100";

// -----------------------------------------------------------------------------
// 2. Identifiers + caller state. The store + state are declared up top so the
//    vi.mock factory below can close over them.
// -----------------------------------------------------------------------------
const MERCH_A = "00000000-0000-0000-0000-00000000aaaa";
const MERCH_B = "00000000-0000-0000-0000-00000000bbbb";
const ORDER_A = "order-aaaa";
const ORDER_B = "order-bbbb"; // owned by merchB — the cross-tenant target
const PRINTER_A = "printer-aaaa";
const PRINTER_B = "printer-bbbb"; // owned by merchB

const state: { currentUserId: string | null; nextUserSalt: number } = {
  currentUserId: null,
  nextUserSalt: 0,
};

// Unique-per-test user ids keep the in-process token-bucket rate limiter in
// lib/rateLimit.ts from leaking state across cases (the bucket key is
// `${route}:${userId}`).
function freshMemberA(): string {
  state.nextUserSalt += 1;
  return `user-member-a-${state.nextUserSalt}`;
}
function freshPlatformAdmin(): string {
  state.nextUserSalt += 1;
  return `user-platform-admin-${state.nextUserSalt}`;
}

type Row = Record<string, unknown>;
const store = new Map<string, Row[]>();

function seedStore(): void {
  store.clear();
  store.set("merchants", [
    {
      id: MERCH_A,
      name: "A",
      email: "a@x",
      phone: null,
      city: null,
      region: null,
      brand_color: null,
      currency: "USD",
    },
    {
      id: MERCH_B,
      name: "B",
      email: "b@x",
      phone: null,
      city: null,
      region: null,
      brand_color: null,
      currency: "USD",
    },
  ]);
  store.set("orders", [
    {
      id: ORDER_A,
      merchant_id: MERCH_A,
      number: 1,
      status: "open",
      subtotal_cents: 100,
      tax_cents: 0,
      tip_cents: 0,
      total_cents: 100,
      payment_method: "card",
      payment_status: "paid",
      created_at: "2026-01-01T00:00:00Z",
      order_type: "dine_in",
      source: "pos",
      customer_name: null,
      discount_cents: 0,
      surcharge_cents: 0,
      gateway_payment_id: "pi_A",
      gateway_provider: "stripe",
      order_items: [
        {
          name_snapshot: "Coffee",
          quantity: 1,
          unit_price_cents: 100,
          notes: null,
          order_item_modifiers: [],
        },
      ],
    },
    {
      id: ORDER_B,
      merchant_id: MERCH_B,
      number: 1,
      status: "open",
      subtotal_cents: 200,
      tax_cents: 0,
      tip_cents: 0,
      total_cents: 200,
      payment_method: "card",
      payment_status: "paid",
      created_at: "2026-01-01T00:00:00Z",
      order_type: "dine_in",
      source: "pos",
      customer_name: null,
      discount_cents: 0,
      surcharge_cents: 0,
      gateway_payment_id: "pi_B",
      gateway_provider: "stripe",
      order_items: [
        {
          name_snapshot: "Tea",
          quantity: 1,
          unit_price_cents: 200,
          notes: null,
          order_item_modifiers: [],
        },
      ],
    },
  ]);
  store.set("printers", [
    {
      id: PRINTER_A,
      merchant_id: MERCH_A,
      kind: "lan",
      label: "Kitchen A",
      active: true,
      is_default: true,
    },
    {
      id: PRINTER_B,
      merchant_id: MERCH_B,
      kind: "lan",
      label: "Kitchen B",
      active: true,
      is_default: true,
    },
  ]);
  // Membership of the *current* user is wired per-test by also pushing rows
  // into merchant_members / platform_admins based on state.currentUserId.
  // We start them empty here.
  store.set("merchant_members", []);
  store.set("platform_admins", []);
  store.set("merchant_payment_gateways", [
    {
      merchant_id: MERCH_A,
      provider: "stripe",
      enabled: true,
      is_default: true,
      config: {},
    },
    {
      merchant_id: MERCH_B,
      provider: "stripe",
      enabled: true,
      is_default: true,
      config: {},
    },
  ]);
  store.set("print_jobs", []);
  store.set("admin_audit", []);
}

// Convenience helpers used by each test to wire identity.
function makeMemberA(userId: string): void {
  store.get("merchant_members")!.push({
    merchant_id: MERCH_A,
    user_id: userId,
    role: "owner",
    active: true,
  });
}
function makePlatformAdmin(userId: string): void {
  store.get("platform_admins")!.push({ user_id: userId });
}

// -----------------------------------------------------------------------------
// 3. Spy mechanisms for the three downstream side-effect vectors.
// -----------------------------------------------------------------------------
const refundSpy = vi.fn(async () => ({ ok: true, refund_id: "rf_mock" }));

// -----------------------------------------------------------------------------
// 4. Mocks. vi.mock is hoisted to the top of the file; the factories close over
//    `store`, `state`, and `refundSpy` (legal because they're module-level
//    `const`s reassigned via mutation, not redeclared).
// -----------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => {
  // A query builder that captures `.eq()` filters and applies them as AND
  // equality against the in-memory store. Supports the subset of supabase-js
  // v2 that the four routes actually use:
  //   .select(cols).eq(col, val)[.eq(...)...].maybeSingle()
  //   .select(cols).eq(...).order(...).limit(N).maybeSingle()
  //   .update({...}).eq('id', x)               (thenable)
  //   .insert({...}).select('id').single()
  //   .insert({...})                           (thenable)
  //   await svc.from(t).select(...).eq(...)    (multi-row read, thenable)
  function makeBuilder(table: string) {
    type Op = "select" | "update" | "insert";
    let op: Op = "select";
    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Row | null = null;
    let pendingInsert: Row | null = null;

    function rowsMatchingFilters(): Row[] {
      const rows = store.get(table) ?? [];
      return rows.filter((r) =>
        filters.every(([col, val]) => r[col] === val),
      );
    }

    function terminalRead(): { data: unknown; error: unknown } {
      // For select reads we return matching rows.
      return { data: rowsMatchingFilters(), error: null };
    }

    function applyUpdate(): { data: unknown; error: unknown } {
      const rows = store.get(table) ?? [];
      for (const r of rows) {
        if (filters.every(([col, val]) => r[col] === val)) {
          Object.assign(r, pendingUpdate ?? {});
        }
      }
      return { data: null, error: null };
    }

    function applyInsert(): { data: unknown; error: unknown } {
      const arr = store.get(table) ?? [];
      const row = pendingInsert ?? {};
      // Synthesize an id if one is needed (print_jobs insert -> .select('id'))
      if (!("id" in row)) row.id = `${table}-${arr.length + 1}`;
      arr.push(row);
      store.set(table, arr);
      return { data: row, error: null };
    }

    function terminal(): { data: unknown; error: unknown } {
      if (op === "select") {
        // Multi-row read (e.g. merchant_payment_gateways list).
        return terminalRead();
      }
      if (op === "update") return applyUpdate();
      if (op === "insert") return applyInsert();
      return { data: null, error: null };
    }

    const builder: any = {
      select: (_cols?: string) => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      order: (_col: string, _opts?: unknown) => builder,
      limit: (_n: number) => builder,
      maybeSingle: async () => {
        const rows = rowsMatchingFilters();
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        if (op === "insert") {
          const ins = applyInsert();
          return { data: ins.data, error: null };
        }
        const rows = rowsMatchingFilters();
        return { data: rows[0] ?? null, error: rows[0] ? null : new Error("not found") };
      },
      update: (patch: Row) => {
        op = "update";
        pendingUpdate = patch;
        return builder;
      },
      insert: (row: Row) => {
        op = "insert";
        pendingInsert = row;
        return builder;
      },
      // Thenable: lets `await svc.from(t).select(...).eq(...)` resolve
      // (multi-row read) AND `await svc.from(t).update(...).eq(...)` resolve
      // (write with no terminal call).
      then: (resolve: (v: unknown) => unknown) => resolve(terminal()),
    };

    return builder;
  }

  const svc: any = {
    auth: {
      getUser: async (_token: string) =>
        state.currentUserId
          ? { data: { user: { id: state.currentUserId } }, error: null }
          : { data: { user: null }, error: null },
    },
    from: (table: string) => makeBuilder(table),
  };

  return {
    getServiceSupabase: () => svc,
    getServerSupabase: async () => svc,
  };
});

vi.mock("@squarely/payments", () => ({
  getTerminalProvider: (_provider: string, _config: Record<string, unknown>) => ({
    refund: refundSpy,
  }),
}));

vi.mock("@squarely/printing", () => ({
  buildReceiptXml: () => "<xml>mock-receipt</xml>",
}));

// Bypass the in-process rate limiter so unique-userId rotation isn't strictly
// required (defense-in-depth — we also rotate the user id per test).
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true }),
}));

// -----------------------------------------------------------------------------
// 5. Import route modules AFTER vi.mock declarations. Vitest hoists vi.mock,
//    but keeping the imports below the mocks is the convention from
//    actions.test.ts.
// -----------------------------------------------------------------------------
import { POST as POST_email } from "./receipts/email/route";
import { POST as POST_sms } from "./receipts/sms/route";
import { POST as POST_refunds } from "./refunds/route";
import { POST as POST_dispatch } from "./printers/dispatch/route";

// -----------------------------------------------------------------------------
// 6. Per-test setup: reset store, identity, spies, and stub global.fetch so
//    no test actually reaches Resend / Twilio over the network.
// -----------------------------------------------------------------------------
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  seedStore();
  state.currentUserId = null;
  refundSpy.mockClear();
  fetchSpy = vi.fn(
    async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: "mock-side-effect" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helpers ---------------------------------------------------------------------

function makeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

function fetchHostsHit(): string[] {
  return fetchSpy.mock.calls.map(([u]) => {
    try {
      return new URL(String(u)).host;
    } catch {
      return String(u);
    }
  });
}

// The fuzz contract from the work item: denial must be 403 OR 404. NEVER 200,
// never 500. 200 would mean the side effect fired; 500 would mean the route
// crashed before the side-effect-not-called assertion could be trusted.
function assertDenied(res: Response): void {
  expect([403, 404]).toContain(res.status);
  expect(res.status).not.toBe(200);
  expect(res.status).not.toBe(500);
}

// =============================================================================
// Tests: 4 routes × 2 cases (member-of-A vs platform-admin) = 8 tests total
// =============================================================================

describe("cross-tenant: POST /api/receipts/email", () => {
  it("merchA member targeting merchB-owned order is denied and Resend is never called", async () => {
    const uid = freshMemberA();
    makeMemberA(uid);
    state.currentUserId = uid;

    const res = await POST_email(
      makeRequest("http://test/api/receipts/email", {
        orderId: ORDER_B,
        email: "attacker@example.com",
      }) as any,
    );

    assertDenied(res);
    expect(fetchHostsHit()).not.toContain("api.resend.com");
  });

  it("platform admin targeting merchB-owned order succeeds and Resend is called exactly once (positive control)", async () => {
    const uid = freshPlatformAdmin();
    makePlatformAdmin(uid);
    state.currentUserId = uid;

    const res = await POST_email(
      makeRequest("http://test/api/receipts/email", {
        orderId: ORDER_B,
        email: "owner@b.example",
      }) as any,
    );

    expect(res.status).toBe(200);
    const resendCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).startsWith("https://api.resend.com"),
    );
    expect(resendCalls).toHaveLength(1);
  });
});

describe("cross-tenant: POST /api/receipts/sms", () => {
  it("merchA member targeting merchB-owned order is denied and Twilio is never called", async () => {
    const uid = freshMemberA();
    makeMemberA(uid);
    state.currentUserId = uid;

    const res = await POST_sms(
      makeRequest("http://test/api/receipts/sms", {
        orderId: ORDER_B,
        phone: "+15555550123",
      }) as any,
    );

    assertDenied(res);
    expect(fetchHostsHit()).not.toContain("api.twilio.com");
  });

  it("platform admin targeting merchB-owned order succeeds and Twilio is called exactly once (positive control)", async () => {
    const uid = freshPlatformAdmin();
    makePlatformAdmin(uid);
    state.currentUserId = uid;

    const res = await POST_sms(
      makeRequest("http://test/api/receipts/sms", {
        orderId: ORDER_B,
        phone: "+15555550123",
      }) as any,
    );

    expect(res.status).toBe(200);
    const twilioCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).startsWith("https://api.twilio.com"),
    );
    expect(twilioCalls).toHaveLength(1);
  });
});

describe("cross-tenant: POST /api/refunds", () => {
  it("merchA owner targeting merchB-owned order is denied, the gateway adapter is never called, and admin_audit stays empty", async () => {
    const uid = freshMemberA();
    makeMemberA(uid); // role: 'owner' on merchA — denial here is purely tenant-isolation
    state.currentUserId = uid;

    const res = await POST_refunds(
      makeRequest("http://test/api/refunds", { orderId: ORDER_B }) as any,
    );

    assertDenied(res);
    expect(refundSpy).not.toHaveBeenCalled();
    expect(store.get("admin_audit")).toHaveLength(0);
    // Defense in depth: the merchB order's payment_status was not mutated.
    const orderB = store.get("orders")!.find((o) => o.id === ORDER_B)!;
    expect(orderB.payment_status).toBe("paid");
  });

  it("platform admin targeting merchB-owned order succeeds, gateway adapter fires once, admin_audit row is written against merchB (positive control)", async () => {
    const uid = freshPlatformAdmin();
    makePlatformAdmin(uid);
    state.currentUserId = uid;

    const res = await POST_refunds(
      makeRequest("http://test/api/refunds", { orderId: ORDER_B }) as any,
    );

    expect(res.status).toBe(200);
    expect(refundSpy).toHaveBeenCalledTimes(1);
    const audit = store.get("admin_audit")!;
    expect(audit).toHaveLength(1);
    expect(audit[0]!.merchant_id).toBe(MERCH_B);
  });
});

describe("cross-tenant: POST /api/printers/dispatch", () => {
  it("merchA member targeting merchB-owned order is denied and no print_jobs row is created", async () => {
    const uid = freshMemberA();
    makeMemberA(uid);
    state.currentUserId = uid;

    const res = await POST_dispatch(
      makeRequest("http://test/api/printers/dispatch", { orderId: ORDER_B }) as any,
    );

    assertDenied(res);
    expect(store.get("print_jobs")).toHaveLength(0);
  });

  it("platform admin targeting merchB-owned order succeeds and exactly one print_jobs row is created on merchB (positive control)", async () => {
    const uid = freshPlatformAdmin();
    makePlatformAdmin(uid);
    state.currentUserId = uid;

    const res = await POST_dispatch(
      makeRequest("http://test/api/printers/dispatch", { orderId: ORDER_B }) as any,
    );

    expect(res.status).toBe(200);
    const jobs = store.get("print_jobs")!;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.merchant_id).toBe(MERCH_B);
    expect(jobs[0]!.printer_id).toBe(PRINTER_B);
  });
});

// -----------------------------------------------------------------------------
// Optional extra coverage: merchA member supplies orderId=ORDER_A but
// printerId=PRINTER_B. The printer-by-id lookup at dispatch/route.ts:138
// scopes by .eq('merchant_id', order.merchant_id), so PRINTER_B is filtered
// out and the route falls back to merchA's default printer (PRINTER_A).
// Asserting jobs[0].printer_id === PRINTER_A proves the printer-hijack
// vector is closed.
// -----------------------------------------------------------------------------
describe("cross-tenant: POST /api/printers/dispatch (printer-hijack guard)", () => {
  it("merchA member supplying a foreign printerId is silently routed to their own merchant's printer", async () => {
    const uid = freshMemberA();
    makeMemberA(uid);
    state.currentUserId = uid;

    const res = await POST_dispatch(
      makeRequest("http://test/api/printers/dispatch", {
        orderId: ORDER_A, // their own order
        printerId: PRINTER_B, // attempt to steal merchB's printer
      }) as any,
    );

    expect(res.status).toBe(200);
    const jobs = store.get("print_jobs")!;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.merchant_id).toBe(MERCH_A);
    expect(jobs[0]!.printer_id).toBe(PRINTER_A);
  });
});
