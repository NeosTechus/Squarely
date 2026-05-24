"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { setImpersonatedMerchant } from "@/lib/impersonation";
import { setSuspended, changePlan, resetOwnerPassword, logImpersonation } from "./actions";
import { GatewayEditor } from "@/components/GatewayEditor";

type FeatureKey = "pos" | "kiosk" | "kds" | "admin";
const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "kiosk", label: "Kiosk" },
  { key: "kds", label: "KDS (chef)" },
  { key: "admin", label: "Admin" },
];

interface Plan {
  display_name: string;
  tier: string;
  monthly_price_cents: number;
}
interface Subscription {
  status: string;
  current_period_end: string | null;
  plans: Plan | Plan[] | null;
}
interface LocationRow {
  name: string;
  city: string | null;
  region: string | null;
}
interface Member {
  display_name: string | null;
  role: string;
}
interface MerchantRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  created_at: string;
  suspended: boolean;
  merchant_features: Record<FeatureKey, boolean> | null;
  subscription: Subscription | null;
  locations: LocationRow[];
  members: Member[];
}

const fmtMoney = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(0)}/mo`);
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default function ClientsPage() {
  const qc = useQueryClient();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mobile-only: whether the detail pane is showing instead of the list.
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  const { data: merchants = [], isLoading, error } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async (): Promise<MerchantRow[]> => {
      const { data, error } = await supabase
        .from("merchants")
        .select(
          "id, name, slug, email, phone, city, region, created_at, suspended, " +
            "merchant_features(pos, kiosk, kds, admin), " +
            "subscriptions(status, current_period_end, plans(display_name, tier, monthly_price_cents)), " +
            "locations(name, city, region), " +
            "merchant_members(display_name, role)",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        merchant_features: one<Record<FeatureKey, boolean>>(m.merchant_features),
        subscription: one<Subscription>(m.subscriptions),
        locations: m.locations ?? [],
        members: m.merchant_members ?? [],
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async (args: { merchantId: string; key: FeatureKey; value: boolean }) => {
      const { error } = await supabase
        .from("merchant_features")
        .update({ [args.key]: args.value, updated_at: new Date().toISOString() })
        .eq("merchant_id", args.merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.city ?? "").toLowerCase().includes(q),
    );
  }, [merchants, search]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0]!.id);
  }, [filtered, selectedId]);

  const selected = merchants.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* client list */}
      <div
        className={`${showDetailMobile ? "hidden" : "flex"} w-full flex-col border-r border-slate-200 bg-white md:flex md:w-72`}
      >
        <div className="space-y-2 border-b border-slate-100 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
          <a
            href="/admin/clients/new"
            className="block rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New client
          </a>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-slate-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No clients match.</p>
          ) : (
            filtered.map((m) => {
              const plan = one<Plan>(m.subscription?.plans ?? null);
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedId(m.id);
                    setShowDetailMobile(true);
                  }}
                  className={`flex w-full flex-col items-start border-b border-slate-50 px-4 py-3 text-left transition ${
                    active ? "bg-brand-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-sm font-medium ${active ? "text-brand-700" : "text-slate-800"}`}>
                    {m.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {plan ? plan.display_name : "No plan"} · {m.city ?? "—"}
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* detail */}
      <div
        className={`${showDetailMobile ? "block" : "hidden"} flex-1 overflow-y-auto p-6 md:block`}
      >
        <button
          type="button"
          onClick={() => setShowDetailMobile(false)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 md:hidden"
        >
          ← Back to list
        </button>
        {error ? (
          <p className="text-sm text-red-600">{(error as Error).message}</p>
        ) : !selected ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Select a client to view details.
          </div>
        ) : (
          <ClientDetail merchant={selected} onToggle={toggle.mutate} toggling={toggle.isPending} />
        )}
      </div>
    </div>
  );
}

function ClientDetail({
  merchant: m,
  onToggle,
  toggling,
}: {
  merchant: MerchantRow;
  onToggle: (a: { merchantId: string; key: FeatureKey; value: boolean }) => void;
  toggling: boolean;
}) {
  const qc = useQueryClient();
  const plan = one<Plan>(m.subscription?.plans ?? null);
  const loc = m.locations[0];
  const owner = m.members.find((x) => x.role === "owner");
  const renew = m.subscription?.current_period_end
    ? new Date(m.subscription.current_period_end).toLocaleDateString()
    : null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-merchants"] });

  const [planTier, setPlanTier] = useState(plan?.tier ?? "starter");
  const [pwd, setPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const suspendMut = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await setSuspended(m.id, next);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setErrMsg(null);
      refresh();
    },
    onError: (e) => setErrMsg((e as Error).message),
  });

  const planMut = useMutation({
    mutationFn: async (tier: string) => {
      const r = await changePlan(m.id, tier);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setErrMsg(null);
      refresh();
    },
    onError: (e) => setErrMsg((e as Error).message),
  });

  const pwdMut = useMutation({
    mutationFn: async (password: string) => {
      const r = await resetOwnerPassword(m.id, password);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setPwd("");
      setPwdMsg({ ok: true, text: "Password updated." });
      refresh();
    },
    onError: (e) => setPwdMsg({ ok: false, text: (e as Error).message }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{m.name}</h2>
        <OpenDashboardButton merchantId={m.id} />
        {plan ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            {plan.display_name} · {fmtMoney(plan.monthly_price_cents)}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">No plan</span>
        )}
        {m.subscription?.status ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${
              m.subscription.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {m.subscription.status}
          </span>
        ) : null}
        {m.suspended ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            Suspended
          </span>
        ) : null}
        <span className="text-sm text-slate-400">/{m.slug}</span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Account</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <Detail label="Owner" value={owner?.display_name ?? "—"} />
          <Detail label="Contact" value={m.email} />
          <Detail label="Phone" value={m.phone ?? "—"} />
          <Detail
            label="Primary location"
            value={loc ? `${loc.name}${loc.city ? ` · ${loc.city}` : ""}` : `${m.city ?? "—"}${m.region ? ", " + m.region : ""}`}
          />
          <Detail label="Locations" value={String(m.locations.length)} />
          <Detail label="Staff" value={String(m.members.length)} />
          <Detail label="Renews" value={renew ?? "—"} />
          <Detail label="Joined" value={new Date(m.created_at).toLocaleDateString()} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Enabled features</h3>
        <div className="flex flex-wrap items-center gap-6">
          {FEATURES.map((f) => {
            const on = m.merchant_features?.[f.key] ?? true;
            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{f.label}</span>
                <button
                  onClick={() => onToggle({ merchantId: m.id, key: f.key, value: !on })}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    on ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={`${f.label} ${on ? "on" : "off"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      on ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Payment gateways</h3>
        <p className="mb-3 text-xs text-slate-400">
          Connect this client&apos;s processors. The default card gateway is used at checkout.
        </p>
        <GatewayEditor merchantId={m.id} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Management</h3>
        {errMsg ? <p className="mb-3 text-sm text-red-600">{errMsg}</p> : null}

        <div className="space-y-5">
          {/* Suspend / reactivate */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-700">Account status</div>
              <div className="text-xs text-slate-400">
                {m.suspended ? "This client is suspended." : "This client is active."}
              </div>
            </div>
            <button
              onClick={() => suspendMut.mutate(!m.suspended)}
              disabled={suspendMut.isPending}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
                m.suspended
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {m.suspended ? "Reactivate" : "Suspend"}
            </button>
          </div>

          {/* Change plan */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-5">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Plan
              </label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <button
              onClick={() => planMut.mutate(planTier)}
              disabled={planMut.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Change plan
            </button>
          </div>

          {/* Reset owner password */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPwdMsg(null);
              pwdMut.mutate(pwd);
            }}
            className="border-t border-slate-100 pt-5"
          >
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
              Reset owner password
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={pwdMut.isPending || pwd.length < 8}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            {pwdMsg ? (
              <p className={`mt-2 text-sm ${pwdMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {pwdMsg.text}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </div>
  );
}

function OpenDashboardButton({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <button
      onClick={() => {
        // Fire-and-forget audit; never block navigation.
        void logImpersonation(merchantId).catch(() => {});
        setImpersonatedMerchant(merchantId);
        qc.clear();
        router.push("/dashboard");
        router.refresh();
      }}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
    >
      Open dashboard →
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-slate-700">{value}</div>
    </div>
  );
}
