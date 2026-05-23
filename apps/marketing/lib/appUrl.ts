/**
 * URL of the web-admin app (where real login/signup live).
 * Override with NEXT_PUBLIC_APP_URL in production (e.g. https://app.squarely.com).
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const APP_LOGIN_URL = `${APP_URL}/login`;
export const APP_SIGNUP_URL = `${APP_URL}/signup`;
