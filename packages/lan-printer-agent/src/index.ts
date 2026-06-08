#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";
import { pollOnce } from "./poll.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
    email: cfg.email,
    password: cfg.password,
  });
  if (signErr || !signIn.session) {
    throw new Error(`Sign-in failed: ${signErr?.message ?? "no session"}`);
  }

  const claims = signIn.session.user.app_metadata as Record<string, unknown>;
  if (!claims["active_merchant_id"]) {
    throw new Error(
      "Agent user has no active_merchant_id in app_metadata. " +
        "Stamp it on auth.users.raw_app_meta_data (see README) then re-sign-in.",
    );
  }
  console.log(
    `[print-agent] signed in as ${cfg.email}, merchant=${String(claims["active_merchant_id"])}, ` +
      `polling every ${cfg.pollIntervalMs}ms${
        cfg.printerIds ? ` (printers: ${cfg.printerIds.join(",")})` : ""
      }`,
  );

  let stopping = false;
  let inFlight = false;

  const tick = async (): Promise<void> => {
    if (stopping || inFlight) return;
    inFlight = true;
    try {
      const r = await pollOnce(sb, cfg.printerIds);
      if (r.processed > 0) {
        console.log(
          `[print-agent] processed=${r.processed} ok=${r.ok} failed=${r.failed}`,
        );
      }
    } catch (e) {
      console.error(
        "[print-agent] tick error:",
        e instanceof Error ? e.message : e,
      );
    } finally {
      inFlight = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, cfg.pollIntervalMs);

  // Kick off immediately so the first job doesn't have to wait a full interval.
  await tick();

  const shutdown = async (sig: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log(`[print-agent] ${sig} received, shutting down...`);
    clearInterval(interval);
    // Wait briefly for an in-flight tick to settle so we don't strand a claimed row.
    for (let i = 0; i < 50 && inFlight; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await sb.auth.signOut().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((e: unknown) => {
  console.error("[print-agent] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
