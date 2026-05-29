"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

export function HeaderInfo() {
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any; auth: any };

  const { data } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["header-info", merchantId],
    queryFn: async () => {
      const [{ data: m }, { data: u }] = await Promise.all([
        supabase.from("merchants").select("name").eq("id", merchantId).single(),
        supabase.auth.getUser(),
      ]);
      return {
        merchant: (m as { name?: string } | null)?.name ?? "Your store",
        email: u?.user?.email ?? "",
      };
    },
  });

  return (
    <div className="min-w-0">
      <div className="truncate text-base font-semibold text-slate-900">
        {data?.merchant ?? "Squarely"}
      </div>
      {data?.email ? (
        <div className="truncate text-xs text-slate-500">{data.email}</div>
      ) : null}
    </div>
  );
}
