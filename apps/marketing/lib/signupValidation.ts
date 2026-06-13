// Server-side credential validation shared by any marketing-site signup
// handler / server action.
//
// The marketing site currently redirects /signup to the web-admin app, which
// owns the real signup flow. These helpers exist so that if/when the
// marketing site grows a lead-capture or signup endpoint of its own (e.g. an
// API route at /api/signup), validation is consistent and never relies on
// client-side checks alone.

/**
 * RFC-5322 is famously hairy. This regex is the pragmatic subset most apps
 * (and most validators) actually use: a non-empty local part, '@', a
 * non-empty domain with at least one dot and a 2+ char TLD. No spaces or
 * angle brackets. Good enough for "is this plausibly an email" — the only
 * authoritative check is sending mail to it.
 */
const EMAIL_RE = /^[^\s@"<>()[\]\\,;:]+@[^\s@"<>()[\]\\,;:]+\.[^\s@"<>()[\]\\,;:]{2,}$/;

/**
 * Top-N most common passwords (truncated SecLists / rockyou heads). Inline
 * to avoid a runtime dependency or shipping a large data file. Lowercase —
 * we compare case-insensitively because "Password1" should still be
 * rejected.
 */
const COMMON_PASSWORDS = new Set<string>([
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
  "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football",
  "monkey", "letmein", "shadow", "master", "666666", "qwertyuiop", "123321",
  "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx",
  "7777777", "121212", "000000", "qazwsx", "123qwe", "killer", "trustno1",
  "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster", "soccer",
  "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "fuckme",
  "2000", "charlie", "robert", "thomas", "hockey", "ranger", "daniel",
  "starwars", "klaster", "112233", "george", "computer", "michelle",
  "jessica", "pepper", "1111", "zxcvbn", "555555", "11111111", "131313",
  "freedom", "777777", "pass", "fuck", "maggie", "159753", "aaaaaa",
  "ginger", "princess", "joshua", "cheese", "amanda", "summer", "love",
  "ashley", "6969", "nicole", "chelsea", "biteme", "matthew", "access",
  "yankees", "987654321", "dallas", "austin", "thunder", "taylor", "matrix",
  "william", "corvette", "hello", "martin", "heather", "secret", "fucker",
  "merlin", "diamond",
]);

export type SignupValidationResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Validate signup credentials. Order matters — we always check email first
 * so the caller can show one error at a time without leaking info about
 * whether the password was also bad.
 *
 * Password policy: 8+ chars, at least one letter and one digit, not on the
 * common-passwords list. Deliberately no max length / no special-char
 * requirement (NIST SP 800-63B-aligned).
 */
export function validateSignup(
  emailRaw: unknown,
  passwordRaw: unknown,
): SignupValidationResult {
  if (typeof emailRaw !== "string") {
    return { ok: false, error: "Invalid email" };
  }
  // Trim — accidental leading/trailing whitespace is the user's fat finger,
  // not a different account.
  const email = emailRaw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Invalid email" };
  }

  if (typeof passwordRaw !== "string") {
    return { ok: false, error: "Password does not meet requirements" };
  }
  const password = passwordRaw;
  if (password.length < 8) {
    return { ok: false, error: "Password does not meet requirements" };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Password does not meet requirements" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: "Password does not meet requirements" };
  }

  return { ok: true, email };
}

/**
 * Login error sanitization. Never differentiate "no such user" from
 * "wrong password" — both leak account-existence info that fuels
 * credential-stuffing and user-enumeration attacks.
 */
export const GENERIC_LOGIN_ERROR = "Invalid credentials";
