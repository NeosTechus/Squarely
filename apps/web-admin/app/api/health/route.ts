import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, app: "web-admin", ts: new Date().toISOString() });
}
