import { cookies } from "next/headers";
import { createServerClient } from "@squarely/db/server";
import { createBrowserClient } from "@squarely/db/browser";
import { createServiceRoleClient } from "@squarely/db/service";

export async function getServerSupabase() {
  const store = await cookies();
  return createServerClient({
    get: (name) => store.get(name),
    set: ({ name, value, ...opts }) => store.set({ name, value, ...opts }),
  });
}

export { createBrowserClient as getBrowserSupabase };
export { createServiceRoleClient as getServiceSupabase };
