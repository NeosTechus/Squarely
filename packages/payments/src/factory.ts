import type { PaymentProvider } from "./provider";
import { ValorProvider } from "./valor";
import { SquareProvider } from "./square";
import { StripeProvider } from "./stripe";
import { AdyenProvider } from "./adyen";
import { CloverProvider } from "./clover";
import { AuthorizeNetProvider } from "./authorizenet";
import { PayPalProvider } from "./paypal";

/**
 * Build the terminal adapter for a merchant's saved gateway config.
 * Server-side only (config holds secret keys). Returns null for providers that
 * have no card-present cloud terminal integration here.
 */
export function getTerminalProvider(
  provider: string,
  config: Record<string, unknown>,
): PaymentProvider | null {
  switch (provider) {
    case "valor":
      return new ValorProvider({ apiKey: String(config.apiKey ?? ""), apiBase: config.apiBase ? String(config.apiBase) : undefined });
    case "square":
      return new SquareProvider({
        accessToken: String(config.accessToken ?? ""),
        locationId: config.locationId ? String(config.locationId) : undefined,
        deviceId: config.deviceId ? String(config.deviceId) : undefined,
        environment: config.environment ? String(config.environment) : undefined,
      });
    case "stripe":
      return new StripeProvider({ secretKey: String(config.secretKey ?? ""), readerId: config.readerId ? String(config.readerId) : undefined });
    case "adyen":
      return new AdyenProvider({
        apiKey: String(config.apiKey ?? ""),
        merchantAccount: config.merchantAccount ? String(config.merchantAccount) : undefined,
        poiId: config.poiId ? String(config.poiId) : undefined,
        environment: config.environment ? String(config.environment) : undefined,
      });
    case "clover":
      return new CloverProvider({
        merchantId: String(config.merchantId ?? ""),
        apiToken: String(config.apiToken ?? ""),
        deviceId: config.deviceId ? String(config.deviceId) : undefined,
        environment: config.environment ? String(config.environment) : undefined,
      });
    case "authorizenet":
      return new AuthorizeNetProvider({
        apiLoginId: String(config.apiLoginId ?? ""),
        transactionKey: String(config.transactionKey ?? ""),
        environment: config.environment ? String(config.environment) : undefined,
        trackData: config.trackData ? String(config.trackData) : undefined,
      });
    case "paypal":
      return new PayPalProvider({
        clientId: String(config.clientId ?? ""),
        clientSecret: String(config.clientSecret ?? ""),
        environment: config.environment ? String(config.environment) : undefined,
      });
    // cash: no processor
    default:
      return null;
  }
}

/** Providers that support card-present / server-driven charging here. */
export const TERMINAL_PROVIDERS = ["valor", "square", "stripe", "adyen", "clover", "authorizenet", "paypal"] as const;
