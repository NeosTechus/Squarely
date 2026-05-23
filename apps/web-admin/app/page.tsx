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

  if (isAdmin) redirect("/admin");

  // Owners whose merchant has been suspended by an admin are blocked.
  const activeMerchant = (user.app_metadata as Record<string, unknown> | undefined)
    ?.active_merchant_id;
  if (typeof activeMerchant === "string" && activeMerchant) {
    const { data: m } = await (supabase as any)
      .from("merchants")
      .select("suspended")
      .eq("id", activeMerchant)
      .maybeSingle();
    if (m?.suspended) redirect("/suspended");
  }

  redirect("/dashboard");
}
