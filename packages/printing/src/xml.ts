import type { ReceiptJob } from "./types";

// Epson ePOS-Print XML builder. Mirrors api/_lib/receipt-xml.ts from the Fenton
// repo but generalized over per-merchant header + cash-drawer pulse.

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatCents = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );

export function buildReceiptXml(job: ReceiptJob): string {
  const { header, order, payment, openCashDrawer } = job;
  const lines: string[] = [];

  const push = (s: string) => lines.push(s);

  push(`<?xml version="1.0" encoding="utf-8"?>`);
  push(
    `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`,
  );

  push(`<text align="center"/>`);
  push(`<text width="2" height="2"/>`);
  push(`<text>${xmlEscape(header.storeName)}&#10;</text>`);
  push(`<text width="1" height="1"/>`);
  if (header.storeAddress) {
    push(`<text>${xmlEscape(header.storeAddress)}&#10;</text>`);
  }
  if (header.storePhone) {
    push(`<text>${xmlEscape(header.storePhone)}&#10;</text>`);
  }
  push(`<text>&#10;</text>`);
  push(`<text align="left"/>`);
  push(
    `<text>Order #${order.number}    ${new Date(order.created_at).toLocaleString()}&#10;</text>`,
  );
  push(
    `<text>Type: ${order.order_type.replace("_", " ")}    Source: ${order.source}&#10;</text>`,
  );
  if (order.customer_name) {
    push(`<text>Customer: ${xmlEscape(order.customer_name)}&#10;</text>`);
  }
  push(`<text>----------------------------------------&#10;</text>`);

  for (const item of order.items) {
    const lineTotal = formatCents(item.unit_price_cents * item.quantity);
    push(
      `<text>${item.quantity}x ${xmlEscape(item.name_snapshot)}     ${lineTotal}&#10;</text>`,
    );
    for (const mod of item.modifiers) {
      const delta = mod.price_delta_cents
        ? `  ${formatCents(mod.price_delta_cents)}`
        : "";
      push(`<text>  + ${xmlEscape(mod.name_snapshot)}${delta}&#10;</text>`);
    }
    if (item.notes) {
      push(`<text>  note: ${xmlEscape(item.notes)}&#10;</text>`);
    }
  }
  push(`<text>----------------------------------------&#10;</text>`);
  push(`<text>Subtotal: ${formatCents(order.subtotal_cents)}&#10;</text>`);
  if (order.discount_cents) {
    push(`<text>Discount: -${formatCents(order.discount_cents)}&#10;</text>`);
  }
  push(`<text>Tax:      ${formatCents(order.tax_cents)}&#10;</text>`);
  if (order.surcharge_cents) {
    push(`<text>Card fee: ${formatCents(order.surcharge_cents)}&#10;</text>`);
  }
  if (order.tip_cents) {
    push(`<text>Tip:      ${formatCents(order.tip_cents)}&#10;</text>`);
  }
  push(`<text width="2" height="2"/>`);
  push(`<text>TOTAL:    ${formatCents(order.total_cents)}&#10;</text>`);
  push(`<text width="1" height="1"/>`);

  if (payment) {
    push(`<text>&#10;</text>`);
    push(`<text>Paid via ${payment.method.toUpperCase()}&#10;</text>`);
    if (payment.maskedPan) {
      push(
        `<text>Card: ${xmlEscape(payment.cardBrand ?? "")} ${xmlEscape(payment.maskedPan)}&#10;</text>`,
      );
    }
    if (payment.authCode) {
      push(`<text>Auth: ${xmlEscape(payment.authCode)}&#10;</text>`);
    }
    if (payment.rrn) {
      push(`<text>RRN:  ${xmlEscape(payment.rrn)}&#10;</text>`);
    }
  }

  push(`<text>&#10;</text>`);
  push(`<text align="center"/>`);
  push(`<text>Thank you!&#10;</text>`);
  push(`<feed line="2"/>`);
  push(`<cut type="feed"/>`);

  if (openCashDrawer) {
    // Pulse the printer's DK port to kick the cash drawer.
    push(`<pulse drawer="drawer_1" time="pulse_100"/>`);
  }

  push(`</epos-print>`);
  return lines.join("");
}

export function wrapSoapEnvelope(xml: string): string {
  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">`,
    `<s:Body>`,
    xml,
    `</s:Body>`,
    `</s:Envelope>`,
  ].join("");
}
