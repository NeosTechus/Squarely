"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";
import Link from "next/link";
import {
  Check,
  UtensilsCrossed,
  Percent,
  Monitor,
  Receipt,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface OrderRow {
  total_cents: number;
  status: string;
  created_at: string;
  number: number;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function Dashboard() {
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data, isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["dashboard-stats", merchantId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_cents, status, created_at, number")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (orders ?? []) as OrderRow[];
    },
  });

  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["dashboard-onboarding", merchantId],
    queryFn: async (): Promise<OnboardingState> => {
      const [itemsRes, ordersRes, merchantRes] = await Promise.all([
        supabase
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", merchantId),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", merchantId),
        supabase
          .from("merchants")
          .select("region, tax_rate_bps, kiosk_image_url")
          .eq("id", merchantId)
          .maybeSingle(),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (merchantRes.error) throw merchantRes.error;

      const merchant = (merchantRes.data ?? {}) as {
        region: string | null;
        tax_rate_bps: number | null;
        kiosk_image_url: string | null;
      };

      return {
        hasItems: (itemsRes.count ?? 0) > 0,
        hasTax: Boolean(merchant.region) || (merchant.tax_rate_bps ?? 0) > 0,
        hasKiosk: Boolean(merchant.kiosk_image_url),
        hasOrders: (ordersRes.count ?? 0) > 0,
      };
    },
  });

  const orders = data ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todays = orders.filter(
    (o) => new Date(o.created_at) >= startOfDay && o.status !== "cancelled",
  );
  const revenue = todays.reduce((s, o) => s + o.total_cents, 0);
  const orderCount = todays.length;
  const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
  const openTickets = orders.filter((o) =>
    ["pending", "received", "preparing", "ready"].includes(o.status),
  ).length;

  const steps: OnboardingStep[] = [
    {
      icon: UtensilsCrossed,
      title: "Add your menu items",
      description: "Build the menu your customers will order from.",
      href: "/dashboard/items",
      done: onboarding?.hasItems ?? false,
    },
    {
      icon: Percent,
      title: "Set your sales tax",
      description: "Pick your region or enter a tax rate so totals are correct.",
      href: "/dashboard/settings",
      done: onboarding?.hasTax ?? false,
    },
    {
      icon: Monitor,
      title: "Customize your kiosk",
      description: "Upload an image to brand your self-serve kiosk.",
      href: "/dashboard/settings",
      done: onboarding?.hasKiosk ?? false,
    },
    {
      icon: Receipt,
      title: "Take your first order",
      description: "Ring up a sale on the POS or kiosk to go live.",
      href: "/dashboard/orders",
      done: onboarding?.hasOrders ?? false,
    },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Overview
      </Reveal>

      {error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : null}

      {onboardingLoading ? (
        <Reveal className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Loading getting-started checklist…</p>
        </Reveal>
      ) : allDone ? (
        <Reveal className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 transition hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">
                You&apos;re all set 🎉
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Your menu, tax, kiosk, and first order are ready. Nice work!
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Getting started</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Complete these steps to get your store ready.
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              {completedCount} of {steps.length} complete
            </span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <ol className="mt-5 space-y-2">
            {steps.map((step) => (
              <OnboardingRow key={step.title} step={step} />
            ))}
          </ol>
        </Reveal>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Today's revenue", value: isLoading ? "…" : fmt(revenue) },
          { label: "Orders", value: isLoading ? "…" : String(orderCount) },
          { label: "Avg ticket", value: isLoading ? "…" : fmt(avgTicket) },
          { label: "Open tickets", value: isLoading ? "…" : String(openTickets) },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 70}>
            <Stat label={s.label} value={s.value} />
          </Reveal>
        ))}
      </div>

      <Reveal className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No orders yet. Ring up a sale on the POS app and it will appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.slice(0, 10).map((o) => (
              <li
                key={o.number}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50"
              >
                <span className="font-medium">Order #{o.number}</span>
                <span className="text-slate-500">{o.status}</span>
                <span className="font-semibold">{fmt(o.total_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

interface OnboardingState {
  hasItems: boolean;
  hasTax: boolean;
  hasKiosk: boolean;
  hasOrders: boolean;
}

interface OnboardingStep {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

function OnboardingRow({ step }: { step: OnboardingStep }) {
  const Icon = step.icon;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
        step.done
          ? "border-brand-100 bg-brand-50/50"
          : "border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          step.done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {step.done ? (
          <Check className="h-5 w-5" strokeWidth={3} />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            step.done ? "text-slate-500 line-through" : "text-slate-900"
          }`}
        >
          {step.title}
        </p>
        <p className="truncate text-xs text-slate-500">{step.description}</p>
      </div>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          step.done
            ? "bg-brand-600 text-white"
            : "border-2 border-slate-300 text-transparent"
        }`}
        aria-label={step.done ? "Complete" : "Incomplete"}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>

      <Link
        href={step.href}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          step.done
            ? "text-slate-500 hover:bg-slate-100"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {step.done ? "View" : "Start"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}
