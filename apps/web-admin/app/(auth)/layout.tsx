import type { ReactNode } from "react";
import { MARKETING_URL } from "@/lib/marketingUrl";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Premium gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-brand-900 to-slate-900" />
      {/* Soft brand glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 -z-10 h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-3xl" />
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Logo (also the way back to marketing) */}
      <header className="absolute inset-x-0 top-0 z-10 px-6 py-5">
        <a
          href={MARKETING_URL}
          className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white hover:opacity-90"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-sm backdrop-blur">
            S
          </span>
          Squarely
        </a>
      </header>

      {children}

      {/* Powered by NeosTechus */}
      <footer className="absolute inset-x-0 bottom-0 z-10 px-6 py-5 text-center">
        <a
          href="https://neostechus.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/60 hover:text-white/90"
        >
          Powered by NeosTechus · AI-native engineering &amp; IT services
        </a>
      </footer>
    </div>
  );
}
