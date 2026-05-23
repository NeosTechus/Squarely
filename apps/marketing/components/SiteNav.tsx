"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@squarely/ui-web";
import { APP_LOGIN_URL, APP_SIGNUP_URL } from "@/lib/appUrl";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/30 bg-white/40 px-3 py-2.5 shadow-lg shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/40">
        {/* logo */}
        <Link href="/" className="flex items-center gap-2 pl-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-black text-white shadow-sm">
            S
          </span>
          Squarely
        </Link>

        {/* center links (active = white pill) */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5">
          <a
            href={APP_LOGIN_URL}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/60 hover:text-slate-900"
          >
            Log in
          </a>
          <a href={APP_SIGNUP_URL}>
            <Button size="sm" className="rounded-full px-5 shadow-sm">
              Start free
            </Button>
          </a>
        </div>
      </nav>
    </header>
  );
}
