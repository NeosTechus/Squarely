"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";

// Per-client onboarding progress, computed live from the client's data so the
// super admin can see at a glance what's left before a store can go live.

interface Step {
  key: string;
  label: string;
  hint: string;
  done: boolean;
}

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export function OnboardingChecklist({ merchantId }: { merchantId: string }) {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", merchantId],
    enabled: Boolean(merchantId),
    queryFn: async () => {
      const [m, items, gateways] = await Promise.all([
        supabase
          .from("merchants")
          .select("kiosk_image_url, merchant_features(pos,kiosk,kds,admin), subscriptions(status)")
          .eq("id", merchantId)
          .single(),
        supabase.from("items").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
        supabase.from("merchant_payment_gateways").select("provider, enabled").eq("merchant_id", merchantId).eq("enabled", true),
      ]);
      const merchant = (m.data ?? {}) as any;
      const feats = one<Record<string, boolean>>(merchant.merchant_features) ?? {};
      const sub = one<{ status: string }>(merchant.subscriptions);
      const gws = (gateways.data ?? []) as { provider: string }[];
      return {
        kioskImage: !!merchant.kiosk_image_url,
        kioskEnabled: feats.kiosk ?? false,
        anyFeature: Object.values(feats).some(Boolean),
        planActive: sub?.status === "active",
        itemCount: items.count ?? 0,
        hasGateway: gws.some((g) => g.provider !== "cash"),
        anyGateway: gws.length > 0,
      };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  const steps: Step[] = [
    { key: "account", label: "Owner account & store created", hint: "Created at onboarding", done: true },
    { key: "plan", label: "Subscription active", hint: "Set or change the plan below", done: data.planActive },
    { key: "features", label: "Apps enabled (POS / Kiosk / KDS / Admin)", hint: "Toggle in Enabled features", done: data.anyFeature },
    { key: "menu", label: "Menu items added", hint: "Owner adds items in their dashboard", done: data.itemCount > 0 },
    { key: "gateway", label: "Payment gateway connected", hint: "Connect a card processor below", done: data.hasGateway || data.anyGateway },
    ...(data.kioskEnabled
      ? [{ key: "kiosk", label: "Kiosk welcome image set", hint: "Optional — set in Settings", done: data.kioskImage }]
      : []),
  ];

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-semibold text-slate-600">{done}/{steps.length}</span>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                s.done ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"
              }`}
            >
              ✓
            </span>
            <div>
              <div className={`text-sm font-medium ${s.done ? "text-slate-800" : "text-slate-700"}`}>{s.label}</div>
              {!s.done ? <div className="text-xs text-slate-400">{s.hint}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
