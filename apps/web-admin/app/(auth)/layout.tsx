import type { ReactNode } from "react";
import { MARKETING_URL } from "@/lib/marketingUrl";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Centered brand mark, above the card */}
      <header className="flex justify-center pt-12 pb-2">
        <a href={MARKETING_URL} className="inline-flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white hover:opacity-90">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black shadow-lg">
            S
          </span>
          Squarely
        </a>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-8">
        {children}
      </main>

      <footer className="flex justify-center pb-8">
        <a
          href="https://neostechus.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/neostech-logo.png" alt="NeosTech LLC" width={16} height={16} className="rounded-[3px]" />
          Powered by NeosTech LLC
        </a>
      </footer>
    </div>
  );
}
