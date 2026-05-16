/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@squarely/ui-web",
    "@squarely/types",
    "@squarely/auth",
    "@squarely/db",
    "@squarely/api-client",
    "@squarely/feature-flags",
    "@squarely/billing",
    "@squarely/payments",
    "@squarely/printing",
  ],
};

export default nextConfig;
