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

export type GatewayId =
  | "cash"
  | "stripe"
  | "square"
  | "paypal"
  | "adyen"
  | "authorizenet"
  | "clover"
  | "valor";

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
      { key: "environment", label: "Environment (sandbox / production)", placeholder: "production", optional: true },
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "PayPal / Venmo checkout and PayPal Here card readers.",
    manual: false,
    configFields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
      { key: "environment", label: "Environment (sandbox / live)", placeholder: "live", optional: true },
    ],
  },
  {
    id: "adyen",
    label: "Adyen",
    description: "Adyen unified commerce — terminals and online payments.",
    manual: false,
    configFields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "merchantAccount", label: "Merchant account" },
      { key: "hmacKey", label: "Webhook HMAC key", secret: true, optional: true },
    ],
  },
  {
    id: "authorizenet",
    label: "Authorize.Net",
    description: "Authorize.Net payment gateway (cards, e-checks).",
    manual: false,
    configFields: [
      { key: "apiLoginId", label: "API login ID" },
      { key: "transactionKey", label: "Transaction key", secret: true },
    ],
  },
  {
    id: "clover",
    label: "Clover",
    description: "Clover devices and the Clover Ecommerce API.",
    manual: false,
    configFields: [
      { key: "merchantId", label: "Clover merchant ID" },
      { key: "apiToken", label: "API token", secret: true },
    ],
  },
];

export function getGatewayPlugin(id: string): GatewayPlugin | undefined {
  return GATEWAY_CATALOG.find((g) => g.id === id);
}
