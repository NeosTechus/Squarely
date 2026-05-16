import { buildReceiptXml } from "./xml";
import type { ReceiptJob } from "./types";

/**
 * Cloud-fallback print: queue the receipt in Supabase so the
 * `print-dispatch` Edge Function can serve it to the Epson Server Direct
 * Print poll endpoint. Mirrors api/print/epson.ts from the Fenton repo.
 *
 * `queueReceipt` is called from the mobile app or web admin when direct LAN
 * print fails (printer offline / different VLAN / no LAN access at all).
 */
export interface QueueReceiptArgs {
  merchantId: string;
  printerId: string;
  job: ReceiptJob;
  /**
   * Called with the assembled ePOS XML — typically you'd insert this into
   * the `receipts` table via Supabase, but we keep the IO injectable so this
   * package stays runtime-agnostic.
   */
  store: (args: {
    merchant_id: string;
    printer_id: string;
    epos_xml: string;
    order_id: string;
  }) => Promise<{ id: string }>;
}

export async function queueReceipt(args: QueueReceiptArgs): Promise<{ id: string }> {
  const xml = buildReceiptXml(args.job);
  return args.store({
    merchant_id: args.merchantId,
    printer_id: args.printerId,
    epos_xml: xml,
    order_id: args.job.order.id,
  });
}
