import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(opts: { name: string; value: string; [k: string]: unknown }): void;
}

export function createServerClient(cookies: CookieStore) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createSupabaseServerClient<Database>(url, anonKey, {
    cookies: {
      get(name) {
        return cookies.get(name)?.value;
      },
      set(name, value, options) {
        cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        cookies.set({ name, value: "", ...options });
      },
    },
  });
}
