import path from 'node:path';
import type { NextConfig } from 'next';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone (with the node_modules it needs,
  // e.g. React) so hosts can run it without the monorepo's node_modules.
  // Traced from the repo root because npm workspaces hoist packages there.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // The browser only ever talks to the Next.js origin; API calls are proxied so
  // the session cookie stays first-party (HttpOnly, SameSite=Lax).
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
