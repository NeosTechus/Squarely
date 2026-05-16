import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client — SERVER ONLY. Bypasses RLS. Never expose to browsers.
 * Use inside Edge Functions, Next.js Route Handlers / Server Actions, and trusted backend jobs.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for service-role client",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
