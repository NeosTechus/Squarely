import Link from "next/link";
import { Button } from "@squarely/ui-web";

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Squarely
        </Link>
        <div className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/features" className="hover:text-slate-900">Features</Link>
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/download" className="hover:text-slate-900">Download</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
