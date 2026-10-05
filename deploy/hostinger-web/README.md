# Hostinger build of the web CRM

A minimal deploy root for Hostinger's Node.js hosting. It installs **only** the web
CRM's runtime dependencies (no API, Prisma engines or dev tooling) and builds a
self-contained Next.js standalone server, keeping the build under Hostinger's disk
quota (`Unknown system error -122` / EDQUOT).

| Hostinger setting | Value |
| --- | --- |
| Framework preset | Other (plain Node.js), not Next.js |
| Root directory | `deploy/hostinger-web` |
| Build command | `npm run build` |
| Output directory | `apps/web/.next/standalone` |
| Entry file | `server.js` |

Environment: `NODE_ENV=production`, `API_INTERNAL_URL=<API origin>` (set before the
build; it is baked into the build). Do not set `NPM_CONFIG_INCLUDE`.

`build.mjs` copies `apps/web` and `packages/shared` from the repo, compiles the shared
package, removes native packages for the other Linux C library, builds with
`next build --webpack` (webpack cache in memory) and completes the standalone folder.
It fails if `package.json` here no longer lists a dependency of `apps/web` or
`packages/shared`: add it with the version from the root `package-lock.json`, then run
`npm install --package-lock-only` here.

Measured from a clean checkout: peak ~0.6 GB / 24.6k files (repo-root install and
build: ~1.2 GB / 36.7k files).
