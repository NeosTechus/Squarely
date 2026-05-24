// One-off: create a super-admin + an owner. Run from apps/web-admin.
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
globalThis.WebSocket = globalThis.WebSocket || ws;

// minimal .env.local loader
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE key");
const svc = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const ADMIN_EMAIL = "harshakolla18@gmail.com";
const OWNER_EMAIL = "harshakolla90@gmail.com";
const TEMP_PASSWORD = process.env.SEED_PASSWORD || "Squarely2026!";

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = (data?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
    if (u) return u;
    if ((data?.users ?? []).length < 1000) return null;
    page += 1;
  }
}

async function ensureUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await svc.auth.admin.updateUserById(existing.id, { password: TEMP_PASSWORD, email_confirm: true });
    return { id: existing.id, created: false };
  }
  const { data, error } = await svc.auth.admin.createUser({ email, password: TEMP_PASSWORD, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function makeAdmin() {
  const { id, created } = await ensureUser(ADMIN_EMAIL);
  const { error } = await svc.from("platform_admins").upsert({ user_id: id }, { onConflict: "user_id" });
  if (error) throw error;
  console.log(`✓ platform admin: ${ADMIN_EMAIL} (${created ? "new user" : "existing"}) id=${id}`);
}

async function makeOwner() {
  const { id, created } = await ensureUser(OWNER_EMAIL);

  // already a member?
  const { data: member } = await svc
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", id)
    .eq("active", true)
    .maybeSingle();

  let merchantId = member?.merchant_id;
  if (!merchantId) {
    const businessName = "Harsha's Store";
    const slug = `harshas-store-${id.slice(0, 6)}`;
    const { data: merchant, error: mErr } = await svc
      .from("merchants")
      .insert({ name: businessName, slug, email: OWNER_EMAIL })
      .select("id")
      .single();
    if (mErr) throw mErr;
    merchantId = merchant.id;

    const { error: memErr } = await svc.from("merchant_members").insert({
      merchant_id: merchantId,
      user_id: id,
      role: "owner",
      display_name: "Owner",
      active: true,
    });
    if (memErr) throw memErr;
  }

  await svc.auth.admin.updateUserById(id, { app_metadata: { active_merchant_id: merchantId } });
  console.log(`✓ owner: ${OWNER_EMAIL} (${created ? "new user" : "existing"}) merchant=${merchantId}`);
}

await makeAdmin();
await makeOwner();
console.log(`\nTemp password for both: ${TEMP_PASSWORD}`);
