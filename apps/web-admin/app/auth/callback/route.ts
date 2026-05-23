import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { ensureMerchantForCurrentUser } from "@/app/(auth)/actions";

/**
 * OAuth (Google) redirect target. Exchanges the auth code for a session,
 * makes sure the user has a merchant, then sends them into the app.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await ensureMerchantForCurrentUser();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
