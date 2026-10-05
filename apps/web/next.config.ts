import type { NextConfig } from 'next';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
output: 'standalone',
  // The browser only ever talks to the Next.js origin; API calls are proxied so
  // the session cookie stays first-party (HttpOnly, SameSite=Lax).
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
