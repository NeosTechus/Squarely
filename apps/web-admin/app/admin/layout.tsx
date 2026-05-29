import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSupabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only platform admins may access the console.
  const { data: isAdmin } = await (supabase as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="text-sm text-slate-500">Platform console</div>
          <SignOutButton />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
