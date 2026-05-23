"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, TrendingUp, DollarSign, Megaphone, ShieldCheck, Menu, X } from "lucide-react";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/admin/revenue", label: "Revenue & health", icon: DollarSign },
  { href: "/admin/plans", label: "Plans", icon: Package },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/admins", label: "Platform admins", icon: ShieldCheck },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-base font-bold tracking-tight">Squarely</div>
          <div className="text-xs text-slate-500">Platform Admin</div>
        </div>
        <nav className="flex-1 p-3">
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50"
        >
          <Menu size={22} />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold tracking-tight">Squarely</div>
          <div className="text-[11px] leading-none text-slate-500">Platform Admin</div>
        </div>
        <span className="w-9" aria-hidden />
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-base font-bold tracking-tight">Squarely</div>
                <div className="text-xs text-slate-500">Platform Admin</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
