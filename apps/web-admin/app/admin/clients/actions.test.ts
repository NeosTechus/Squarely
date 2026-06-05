/**
 * Privilege-escalation tests for the platform-admin server actions.
 *
 * Every action in ./actions.ts funnels through requirePlatformAdmin(), which
 *   1) calls getServerSupabase().auth.getUser() to require a session, then
 *   2) checks platform_admins for that user_id.
 *
 * These tests drive the guard into each of its three branches (signed-out,
 * authenticated-but-not-admin "cashier", and platform admin) and assert that
 *   a) the right literal error string is returned, AND
 *   b) the destructive write (merchants.update, merchant_payment_gateways.upsert,
 *      auth.admin.updateUserById, admin_audit.insert) is ONLY invoked on the
 *      platform-admin branch.  This is what proves the guard short-circuits
 *      rather than running the mutation and then formatting an error.
 *
 * We mock @/lib/supabase wholesale — there is no Supabase test harness in this
 * repo (vitest.config.ts only globs *.test.ts under packages/** and apps/**).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Spies for the actual write operations.  Each privilege-denied case asserts
// that the matching spy was NEVER invoked; the platform-admin happy path
// asserts it WAS invoked with the expected arguments.
const merchantsUpdateSpy = vi.fn();
const gatewaysUpsertSpy = vi.fn();
const gatewaysUpdateSpy = vi.fn();
const auditInsertSpy = vi.fn();
const updateUserByIdSpy = vi.fn();

// State the mocked client reads when answering queries.  Each test resets and
// then mutates these to simulate the role under test.
const state: {
  user: { id: string } | null;
  isPlatformAdmin: boolean;
  ownerUserId: string | null;
} = {
  user: null,
  isPlatformAdmin: false,
  ownerUserId: "owner-uid",
};

vi.mock("@/lib/supabase", () => {
  // Server-side session client used only by getUser().
  const getServerSupabase = async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
  });

  // Build a chainable query builder.  Every intermediate `.select()/.eq()/
  // .update()/.upsert()` returns the same builder; the terminal value is
  // produced by the `terminal()` function based on the table + op.  `then`
  // makes the builder thenable so `await svc.from(...).update(...).eq(...)`
  // resolves directly (some actions don't end with .maybeSingle()).
  function buildClient() {
    type Op = "select" | "update" | "insert" | "upsert";
    let table = "";
    let op: Op = "select";

    function terminal(): { data: unknown; error: unknown } {
      // Read paths
      if (op === "select" && table === "platform_admins") {
        return {
          data: state.isPlatformAdmin && state.user
            ? { user_id: state.user.id }
            : null,
          error: null,
        };
      }
      if (op === "select" && table === "merchant_members") {
        return {
          data: state.ownerUserId ? { user_id: state.ownerUserId } : null,
          error: null,
        };
      }
      // Write paths — record into the appropriate spy.
      if (table === "merchants" && op === "update") {
        merchantsUpdateSpy();
        return { data: null, error: null };
      }
      if (table === "merchant_payment_gateways" && op === "upsert") {
        gatewaysUpsertSpy();
        return { data: null, error: null };
      }
      if (table === "merchant_payment_gateways" && op === "update") {
        gatewaysUpdateSpy();
        return { data: null, error: null };
      }
      if (table === "admin_audit" && op === "insert") {
        auditInsertSpy();
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }

    const builder: any = {
      select: (..._a: unknown[]) => builder,
      eq: (..._a: unknown[]) => builder,
      order: (..._a: unknown[]) => builder,
      limit: (..._a: unknown[]) => builder,
      maybeSingle: () => Promise.resolve(terminal()),
      single: () => Promise.resolve(terminal()),
      update: (..._a: unknown[]) => {
        op = "update";
        return builder;
      },
      insert: (..._a: unknown[]) => {
        op = "insert";
        // For inserts that aren't awaited terminally (admin_audit), the
        // terminal still has to fire to record into auditInsertSpy.  We
        // call it eagerly and stash the result; the thenable handler will
        // resolve to it if anyone awaits.
        const result = terminal();
        return Object.assign(builder, {
          then: (resolve: (v: unknown) => unknown) => resolve(result),
        });
      },
      upsert: (..._a: unknown[]) => {
        op = "upsert";
        const result = terminal();
        return Object.assign(builder, {
          then: (resolve: (v: unknown) => unknown) => resolve(result),
        });
      },
      // Default thenable for `await svc.from(...).update(...).eq(...)` form.
      then: (resolve: (v: unknown) => unknown) => resolve(terminal()),
    };

    const svc: any = {
      from: (t: string) => {
        table = t;
        op = "select";
        // Reset the thenable on each new .from() so a fresh chain resolves
        // through `terminal()` rather than a stale cached result.
        builder.then = (resolve: (v: unknown) => unknown) =>
          resolve(terminal());
        return builder;
      },
      auth: {
        admin: {
          updateUserById: async (id: string, attrs: { password?: string }) => {
            updateUserByIdSpy(id, attrs);
            return { data: { user: { id } }, error: null };
          },
        },
      },
    };
    return svc;
  }

  const svc = buildClient();
  const getServiceSupabase = () => svc;
  return { getServerSupabase, getServiceSupabase };
});

// IMPORTANT: import the actions AFTER vi.mock is declared above.  Vitest
// hoists vi.mock calls but we still want it visually obvious that the
// mock is bound before the SUT is loaded.
import {
  setSuspended,
  saveMerchantGateway,
  resetOwnerPassword,
} from "./actions";

beforeEach(() => {
  state.user = null;
  state.isPlatformAdmin = false;
  state.ownerUserId = "owner-uid";
  merchantsUpdateSpy.mockClear();
  gatewaysUpsertSpy.mockClear();
  gatewaysUpdateSpy.mockClear();
  auditInsertSpy.mockClear();
  updateUserByIdSpy.mockClear();
});

// ---------------------------------------------------------------------------
// setSuspended
// ---------------------------------------------------------------------------

describe("setSuspended privilege check", () => {
  it("signed-out caller returns 'Not authenticated.' and never updates merchants", async () => {
    state.user = null;

    const r = await setSuspended("merchant-A", true);

    expect(r).toEqual({ ok: false, error: "Not authenticated." });
    expect(merchantsUpdateSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("authenticated cashier (not in platform_admins) returns 'Not authorized.' and never updates merchants", async () => {
    state.user = { id: "cashier-uid" };
    state.isPlatformAdmin = false;

    const r = await setSuspended("merchant-A", true);

    expect(r).toEqual({ ok: false, error: "Not authorized." });
    expect(merchantsUpdateSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("platform admin returns ok:true and the merchants.update fires exactly once", async () => {
    state.user = { id: "admin-uid" };
    state.isPlatformAdmin = true;

    const r = await setSuspended("merchant-A", true);

    expect(r).toEqual({ ok: true });
    expect(merchantsUpdateSpy).toHaveBeenCalledTimes(1);
    expect(auditInsertSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// saveMerchantGateway
// ---------------------------------------------------------------------------

describe("saveMerchantGateway privilege check", () => {
  const input = {
    merchantId: "merchant-A",
    provider: "stripe",
    enabled: true,
    isDefault: false,
    config: { secretKey: "sk_live_redacted", readerId: "rdr_1" },
  };

  it("signed-out caller returns 'Not authenticated.' and never upserts a gateway (secrets stay out of the table)", async () => {
    state.user = null;

    const r = await saveMerchantGateway(input);

    expect(r).toEqual({ ok: false, error: "Not authenticated." });
    expect(gatewaysUpsertSpy).not.toHaveBeenCalled();
    expect(gatewaysUpdateSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("cashier (signed-in non-admin) returns 'Not authorized.' and secrets never reach merchant_payment_gateways", async () => {
    state.user = { id: "cashier-uid" };
    state.isPlatformAdmin = false;

    const r = await saveMerchantGateway(input);

    expect(r).toEqual({ ok: false, error: "Not authorized." });
    expect(gatewaysUpsertSpy).not.toHaveBeenCalled();
    expect(gatewaysUpdateSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("platform admin returns ok:true and merchant_payment_gateways.upsert fires exactly once", async () => {
    state.user = { id: "admin-uid" };
    state.isPlatformAdmin = true;

    const r = await saveMerchantGateway(input);

    expect(r).toEqual({ ok: true });
    expect(gatewaysUpsertSpy).toHaveBeenCalledTimes(1);
    expect(auditInsertSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// resetOwnerPassword
// ---------------------------------------------------------------------------

describe("resetOwnerPassword privilege check", () => {
  it("rejects short password BEFORE the auth check (no auth.admin.updateUserById even for a cashier)", async () => {
    // This pins the ordering: input validation must come before auth, so a
    // cashier who guesses a merchant id still can't probe auth state through
    // the response shape.
    state.user = { id: "cashier-uid" };
    state.isPlatformAdmin = false;

    const r = await resetOwnerPassword("merchant-A", "short");

    expect(r).toEqual({
      ok: false,
      error: "Password must be at least 8 characters.",
    });
    expect(updateUserByIdSpy).not.toHaveBeenCalled();
  });

  it("signed-out caller returns 'Not authenticated.' and never mutates the owner's password", async () => {
    state.user = null;

    const r = await resetOwnerPassword("merchant-A", "longenoughpw");

    expect(r).toEqual({ ok: false, error: "Not authenticated." });
    expect(updateUserByIdSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("cashier returns 'Not authorized.' and never mutates the owner's password (cannot escalate by guessing merchant id)", async () => {
    state.user = { id: "cashier-uid" };
    state.isPlatformAdmin = false;

    const r = await resetOwnerPassword("merchant-A", "longenoughpw");

    expect(r).toEqual({ ok: false, error: "Not authorized." });
    expect(updateUserByIdSpy).not.toHaveBeenCalled();
    expect(auditInsertSpy).not.toHaveBeenCalled();
  });

  it("platform admin returns ok:true and auth.admin.updateUserById is called exactly once with the resolved owner id + new password", async () => {
    state.user = { id: "admin-uid" };
    state.isPlatformAdmin = true;
    state.ownerUserId = "owner-uid";

    const r = await resetOwnerPassword("merchant-A", "longenoughpw");

    expect(r).toEqual({ ok: true });
    expect(updateUserByIdSpy).toHaveBeenCalledTimes(1);
    expect(updateUserByIdSpy).toHaveBeenCalledWith("owner-uid", {
      password: "longenoughpw",
    });
    expect(auditInsertSpy).toHaveBeenCalledTimes(1);
  });
});
