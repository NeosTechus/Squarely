"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { getImpersonatedMerchant, clearImpersonatedMerchant } from "@/lib/impersonation";

export function ImpersonationBanner() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const id = getImpersonatedMerchant();
    if (!id) return;
    const supabase = createBrowserClient() as unknown as { from: (t: string) => any };
    supabase
      .from("merchants")
      .select("name")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: { name?: string } | null }) =>
        setName(data?.name ?? "client"),
      );
  }, []);

  if (!getImpersonatedMerchant()) return null;

  function exit() {
    clearImpersonatedMerchant();
    qc.clear();
    router.push("/admin/clients");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between bg-amber-500 px-6 py-2 text-sm text-white">
      <span>
        Viewing <strong>{name ?? "…"}</strong> as platform admin
      </span>
      <button onClick={exit} className="rounded-md bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
        Exit to admin
      </button>
    </div>
  );
}
