import type { ReactNode } from "react";
import { MARKETING_URL } from "@/lib/marketingUrl";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Back-to-marketing header */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4">
        <a
          href={MARKETING_URL}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
            S
          </span>
          Squarely
        </a>
        <a
          href={MARKETING_URL}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to site
        </a>
      </header>
      {children}
    </div>
  );
}
