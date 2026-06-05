/**
 * Redact common secret-shaped substrings from a string before it is surfaced
 * to a client or logged at a non-sensitive level. This is defense-in-depth:
 * upstream providers (Twilio/Resend/Stripe) are not currently known to echo
 * our credentials back, but if a future provider or a future adapter throws
 * `new Error(\`auth failed: Bearer eyJ...\`)`, we want it masked.
 *
 * Patterns covered:
 *   - "Authorization: Bearer <token>"   → "Authorization: Bearer ***"
 *   - "Bearer <token>"                  → "Bearer ***"
 *   - "Basic <base64>"                  → "Basic ***"
 *   - Stripe-shaped secret keys (sk_live_..., sk_test_..., rk_live_...)
 *   - Generic "api_key=<value>" / "apikey: <value>" / "api-key: <value>"
 *   - JWT-shaped tokens (eyJ...long...)
 */
export function redact(s: string): string {
  if (!s) return s;
  let out = s;
  // Bearer <token>  (case-insensitive; token = non-space chars)
  out = out.replace(/(bearer)\s+[A-Za-z0-9._\-+/=]+/gi, "$1 ***");
  // Basic <base64>
  out = out.replace(/(basic)\s+[A-Za-z0-9+/=]+/gi, "$1 ***");
  // Stripe-style secret keys (sk_live_, sk_test_, rk_live_, rk_test_)
  out = out.replace(/\b(sk|rk)_(live|test)_[A-Za-z0-9]+/g, "$1_$2_***");
  // api_key / apikey / api-key followed by a value
  out = out.replace(/((?:api[_-]?key)\s*[:=]\s*)["']?[A-Za-z0-9._\-]+["']?/gi, "$1***");
  // Authorization: <anything-up-to-200-chars> when value isn't already masked
  out = out.replace(/(authorization\s*:\s*)(?!\*\*\*)[^\s,;]+/gi, "$1***");
  // JWT-shaped: three base64url segments separated by dots, starting with eyJ
  out = out.replace(/\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, "***");
  return out;
}

/**
 * Truncate and redact a provider/adapter/database error message before
 * returning it to a client. The 200-char cap matches the existing receipts
 * routes pattern.
 */
export function safeErrorMessage(input: unknown, fallback = "Internal error"): string {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : input == null
          ? ""
          : String(input);
  if (!raw) return fallback;
  return redact(raw).slice(0, 200);
}
