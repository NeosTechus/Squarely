/** @type {import('next').NextConfig} */

// Conservative, report-only CSP. Tightened to what the marketing site actually
// loads:
//  - same-origin for everything by default
//  - Google Fonts (Inter, Sora) via fonts.googleapis.com / fonts.gstatic.com
//  - Vercel insights endpoints kept in connect-src for forward-compat
//  - 'unsafe-inline' on script/style — Next.js' inline bootstrap + Tailwind
//    inline styles + next/font's inline <style> blocks would otherwise break.
//    We can move to nonces in a later pass.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://vercel.live https://*.vercel-insights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Report-only for the first rollout. Promote to
    // 'Content-Security-Policy' once we've watched violations for a release.
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives.join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@squarely/ui-web", "@squarely/types"],
  async headers() {
    return [
      {
        // Apply to every route. Static assets under /_next/static are
        // immutable and benefit from the same headers (especially HSTS,
        // nosniff, XFO).
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
