import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SignOutButton } from "@/components/SignOutButton";
import { HeaderInfo } from "@/components/HeaderInfo";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";

// These are per-user, auth-gated pages that read live data in the browser —
// never prerender them. (Static prerender would run createBrowserClient at
// build time, which throws without the NEXT_PUBLIC Supabase env present.)
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <ImpersonationBanner />
        <AnnouncementBanner />
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav />
              <div className="min-w-0 flex-1">
                <HeaderInfo />
              </div>
            </div>
            <div className="shrink-0">
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
