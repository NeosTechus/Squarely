/**
 * verifyWebhook — a single, reusable gate for inbound third-party webhooks.
 *
 * Today only /api/stripe-webhook calls it, but every future signed callback
 * (Twilio delivery receipts, Resend bounce events, Adyen notifications,
 * GitHub events, etc.) should go through this harness rather than rolling
 * its own ad-hoc HMAC verification. That gives us:
 *
 *   1) ONE place where the timing-safe comparison is implemented correctly
 *      (constant-time compare via node:crypto.timingSafeEqual on equal-length
 *      buffers; differing lengths are an instant false so timingSafeEqual is
 *      never asked to throw — that throw would itself be a side channel).
 *   2) ONE place that owns reading the request body. Stripe and Svix both
 *      require the EXACT raw bytes for HMAC; Next.js Request bodies are
 *      single-shot streams, so a caller that already did `await req.json()`
 *      has destroyed the bytes the verifier needs. Owning the read here
 *      removes the footgun.
 *   3) ONE error vocabulary that callers translate to HTTP 400 with an
 *      opaque code. We never echo internal signature-mismatch detail back to
 *      the caller — that matches the existing /api/stripe-webhook policy.
 *
 * The function returns a discriminated-union result and never throws.
 */
import crypto from "node:crypto";
import { getStripe } from "@squarely/billing";

export type VerifyResult<T> =
  | { ok: true; payload: T; raw: string }
  | { ok: false; error: VerifyError };

export type VerifyError =
  | "missing-signature"
  | "missing-secret"
  | "invalid-signature"
  | "stale-timestamp"
  | "bad-request";

export type VerifyOptions =
  | { kind: "stripe"; secret: string; headerName?: string }
  | { kind: "twilio"; authToken: string; signatureHeader?: string; url?: string }
  | { kind: "svix"; secret: string } // Resend / generic Svix-signed providers
  | { kind: "hmacSha256"; secret: string; header: string; encoding?: "hex" | "base64" }
  | { kind: "hmacSha1"; secret: string; header: string; encoding?: "hex" | "base64" };

/**
 * Public entry point. Reads the body ONCE — callers must not have already
 * consumed `req.body`. Returns the raw text alongside the parsed payload so
 * the handler doesn't have to (and can't) read the stream a second time.
 */
export async function verifyWebhook<T = unknown>(
  req: Request,
  options: VerifyOptions,
): Promise<VerifyResult<T>> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, error: "bad-request" };
  }

  switch (options.kind) {
    case "stripe":
      return verifyStripe<T>(req, raw, options);
    case "twilio":
      return verifyTwilio<T>(req, raw, options);
    case "svix":
      return verifySvix<T>(req, raw, options);
    case "hmacSha256":
      return verifyGenericHmac<T>(req, raw, options, "sha256");
    case "hmacSha1":
      return verifyGenericHmac<T>(req, raw, options, "sha1");
  }
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------
// We deliberately delegate to stripe.webhooks.constructEvent rather than
// reimplementing Stripe's signing scheme. Stripe versions the scheme (v1, v0
// deprecated) and ships the validator inside the SDK, so delegating means we
// get tolerance/skew/scheme upgrades for free. The harness's job is to
// normalize the *interface*, not the *cryptography*.
function verifyStripe<T>(
  req: Request,
  raw: string,
  opts: Extract<VerifyOptions, { kind: "stripe" }>,
): VerifyResult<T> {
  if (!opts.secret) return { ok: false, error: "missing-secret" };
  const sig = req.headers.get(opts.headerName ?? "stripe-signature");
  if (!sig) return { ok: false, error: "missing-signature" };
  try {
    const event = getStripe().webhooks.constructEvent(raw, sig, opts.secret) as unknown as T;
    return { ok: true, payload: event, raw };
  } catch (err) {
    // Don't echo internal signature-mismatch detail back to the caller; the
    // opaque error code is enough for legit retries. Ops can diagnose via
    // server logs.
    console.error("[verifyWebhook:stripe] signature check failed", err);
    return { ok: false, error: "invalid-signature" };
  }
}

// ---------------------------------------------------------------------------
// Twilio — HMAC-SHA1 over (url + concat(sortedKey + value)), base64
// ---------------------------------------------------------------------------
// Twilio's scheme is unusual: signing string is the full request URL
// concatenated with each form parameter (key + value) in sorted-by-key order.
// We use req.url by default but accept an explicit `url` override because
// behind Vercel's proxy req.url may not match the public URL Twilio actually
// signed against.
async function verifyTwilio<T>(
  req: Request,
  raw: string,
  opts: Extract<VerifyOptions, { kind: "twilio" }>,
): Promise<VerifyResult<T>> {
  if (!opts.authToken) return { ok: false, error: "missing-secret" };
  const provided = req.headers.get(opts.signatureHeader ?? "x-twilio-signature");
  if (!provided) return { ok: false, error: "missing-signature" };

  const params = new URLSearchParams(raw);
  const sortedKeys = Array.from(new Set([...params.keys()])).sort();
  const url = opts.url ?? req.url;
  let data = url;
  for (const k of sortedKeys) data += k + (params.get(k) ?? "");

  const mac = crypto.createHmac("sha1", opts.authToken).update(data).digest("base64");
  if (!safeEqualStr(mac, provided)) return { ok: false, error: "invalid-signature" };

  // Form-encoded payload becomes a plain object for downstream handlers.
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return { ok: true, payload: obj as unknown as T, raw };
}

// ---------------------------------------------------------------------------
// Svix (Resend)
// ---------------------------------------------------------------------------
// signed_content = `${msg_id}.${msg_timestamp}.${body}`
// signature header = "v1,<b64>" (potentially space-separated for rotation)
// Svix secrets are prefixed `whsec_` and base64-encoded.
function verifySvix<T>(
  req: Request,
  raw: string,
  opts: Extract<VerifyOptions, { kind: "svix" }>,
): VerifyResult<T> {
  if (!opts.secret) return { ok: false, error: "missing-secret" };
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return { ok: false, error: "missing-signature" };

  // Reject stale timestamps (>5min skew) to defeat replay. Svix itself
  // recommends this; without it a leaked signed payload could be replayed
  // forever. Distinct error code so observability can tell the two apart.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 5 * 60) {
    return { ok: false, error: "stale-timestamp" };
  }

  const keyB64 = opts.secret.startsWith("whsec_") ? opts.secret.slice(6) : opts.secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, "base64");
  } catch {
    return { ok: false, error: "missing-secret" };
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");

  // Header can be space-separated for key rotation: "v1,<b64> v1,<b64>".
  const candidates: string[] = [];
  for (const part of sigHeader.split(" ")) {
    const sig = part.split(",")[1];
    if (sig) candidates.push(sig);
  }
  const matched = candidates.some((c) => safeEqualStr(expected, c));
  if (!matched) return { ok: false, error: "invalid-signature" };

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* leave as string */
  }
  return { ok: true, payload: parsed as T, raw };
}

// ---------------------------------------------------------------------------
// Generic HMAC (sha256 / sha1)
// ---------------------------------------------------------------------------
// Accepts both raw hex/base64 and scheme-prefixed forms (`sha256=...`)
// because GitHub, Slack, and several other providers prefix their signature
// header that way.
function verifyGenericHmac<T>(
  req: Request,
  raw: string,
  opts: Extract<VerifyOptions, { kind: "hmacSha256" | "hmacSha1" }>,
  algo: "sha256" | "sha1",
): VerifyResult<T> {
  if (!opts.secret) return { ok: false, error: "missing-secret" };
  const provided = req.headers.get(opts.header);
  if (!provided) return { ok: false, error: "missing-signature" };
  const enc = opts.encoding ?? "hex";
  const expected = crypto.createHmac(algo, opts.secret).update(raw).digest(enc);
  const stripped = provided.includes("=") ? provided.split("=").pop()! : provided;
  if (!safeEqualStr(expected, stripped)) return { ok: false, error: "invalid-signature" };
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* leave as string */
  }
  return { ok: true, payload: parsed as T, raw };
}

// ---------------------------------------------------------------------------
// Constant-time string compare
// ---------------------------------------------------------------------------
// timingSafeEqual throws on mismatched lengths, which would itself be a side
// channel and an exception path. Return false immediately on differing
// length, otherwise delegate to the constant-time primitive.
function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
