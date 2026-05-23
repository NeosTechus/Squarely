import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { APP_LOGIN_URL, APP_SIGNUP_URL } from "@/lib/appUrl";

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-black text-white shadow-sm">
            S
          </span>
          Squarely
        </Link>
        <div className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/features" className="transition hover:text-slate-900">Features</Link>
          <Link href="/pricing" className="transition hover:text-slate-900">Pricing</Link>
          <Link href="/download" className="transition hover:text-slate-900">Download</Link>
        </div>
        <div className="flex items-center gap-3">
          <a href={APP_LOGIN_URL} className="text-sm font-medium text-slate-700 transition hover:text-slate-900">
            Log in
          </a>
          <a href={APP_SIGNUP_URL}>
            <Button size="sm">Start free</Button>
          </a>
        </div>
      </div>
    </nav>
  );
}
