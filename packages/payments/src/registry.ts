/**
 * Plugin catalog of selectable payment gateways.
 *
 * Each merchant opts in to one or more of these from their dashboard and can
 * mark one as the default. The POS reads the merchant's enabled gateways and
 * uses the matching adapter to process a sale.
 *
 * `configFields` describes the inputs the dashboard renders for that gateway.
 * `secret: true` fields must only ever be handled server-side.
 */

export type GatewayId = "cash" | "valor" | "stripe" | "square";

export interface GatewayConfigField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
}

export interface GatewayPlugin {
  id: GatewayId;
  label: string;
  description: string;
  /** No external processor — settles immediately (cash drawer / manual). */
  manual: boolean;
  configFields: GatewayConfigField[];
}

export const GATEWAY_CATALOG: GatewayPlugin[] = [
  {
    id: "cash",
    label: "Cash",
    description: "Accept cash at the counter. No processor or fees.",
    manual: true,
    configFields: [],
  },
  {
    id: "valor",
    label: "Valor PayTech",
    description: "Valor smart terminals / card readers over the Valor API.",
    manual: false,
    configFields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "apiBase", label: "API base URL", placeholder: "https://api.valorpaytech.com", optional: true },
      { key: "epi", label: "Terminal EPI / device id" },
    ],
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Stripe Terminal / online card payments.",
    manual: false,
    configFields: [
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_live_…" },
      { key: "secretKey", label: "Secret key", placeholder: "sk_live_…", secret: true },
    ],
  },
  {
    id: "square",
    label: "Square",
    description: "Square readers and the Square payments API.",
    manual: false,
    configFields: [
      { key: "accessToken", label: "Access token", secret: true },
      { key: "locationId", label: "Square location id" },
    ],
  },
];

export function getGatewayPlugin(id: string): GatewayPlugin | undefined {
  return GATEWAY_CATALOG.find((g) => g.id === id);
}
