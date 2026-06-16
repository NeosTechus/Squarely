// Server-side credential validation for the web-admin signup flow.
//
// Kept in sync with apps/marketing/lib/signupValidation.ts. Both files must
// share the same policy because the marketing site is the eventual lead-
// capture surface (currently redirects to web-admin) — letting them diverge
// would create two passwords-allowed surfaces with different requirements.

const EMAIL_RE = /^[^\s@"<>()[\]\\,;:]+@[^\s@"<>()[\]\\,;:]+\.[^\s@"<>()[\]\\,;:]{2,}$/;

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
 * Password policy: 8+ chars, at least one letter AND one digit, not on the
 * common-password list. Deliberately no max length / no special-char
 * requirement (NIST SP 800-63B-aligned).
 */
export function validateSignup(
  emailRaw: unknown,
  passwordRaw: unknown,
): SignupValidationResult {
  if (typeof emailRaw !== "string") {
    return { ok: false, error: "Invalid email" };
  }
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
