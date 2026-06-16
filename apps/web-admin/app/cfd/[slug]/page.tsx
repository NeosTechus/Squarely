import CfdView from "./CfdView";

// Customer-Facing Display.
//
// Public URL pattern (no auth — meant to be opened on a counter-mounted
// second screen pointing at the customer):
//
//   /cfd/<merchant-slug>
//   /cfd/<merchant-slug>?device=<device-uuid>
//
// The page reads the latest cart snapshot via the public get_cfd_state RPC
// (which resolves slug → merchant_id internally so the merchant uuid is not
// exposed in the URL) and then subscribes to Supabase Realtime for live
// updates as the cashier rings items.
//
// IMPORTANT: this page is intentionally NOT under /dashboard and therefore
// is not gated by the role middleware. Anyone with the URL can see the cart
// state for that merchant — that is the desired behavior (it's pointed at
// the customer in front of the cashier). No PII other than item names and
// totals is rendered.
export default async function CfdPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const { slug } = await params;
  const { device } = await searchParams;
  return <CfdView slug={slug} deviceId={device ?? null} />;
}
