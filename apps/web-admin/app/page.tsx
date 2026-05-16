import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export default async function Index() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
