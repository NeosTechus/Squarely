import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export default async function Index() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Platform admins land on the super-admin console.
  const { data: isAdmin } = await (supabase as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  redirect(isAdmin ? "/admin" : "/dashboard");
}
