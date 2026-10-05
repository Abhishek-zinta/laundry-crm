// Builds the RinseOps web CRM for Hostinger from this folder alone, so the host
// installs only the web app's dependencies (package.json here) instead of the
// whole monorepo (API, Prisma engines, dev tooling) and stays under its disk quota.
//
// Hostinger: root directory deploy/hostinger-web, `npm install`, then `npm run build`.
// Output: apps/web/.next/standalone (entry: server.js), a self-contained server.
//
// Steps:
//  1. Check this package.json still lists every runtime dependency of
//     apps/web and packages/shared (fails loudly if they drift apart), and
//     remove native packages built for the other Linux C library.
//  2. Copy packages/shared and apps/web sources here, mirroring the repo
//     layout, so the app's next.config (outputFileTracingRoot ../..) and
//     prepare-standalone script work unchanged and node_modules is in scope.
//  3. Compile @rinseops/shared and install it into ./node_modules.
//  4. `next build --webpack` with the webpack cache kept in memory (no .next/cache).
//  5. Complete the standalone folder (static assets, server.js entry).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const step = (msg) => console.log(`\n== ${msg}`);

// 1. Dependency drift check -------------------------------------------------
step('Checking dependencies against apps/web and packages/shared');
const own = readJson(path.join(here, 'package.json')).dependencies;
const needed = {
  ...readJson(path.join(repo, 'packages/shared/package.json')).dependencies,
  ...readJson(path.join(repo, 'apps/web/package.json')).dependencies,
};
delete needed['@rinseops/shared']; // built from source below
const missing = Object.keys(needed).filter((name) => !(name in own));
if (missing.length) {
  console.error(`deploy/hostinger-web/package.json is missing: ${missing.join(', ')}.`);
  console.error('Add them (same versions as the root package-lock.json) and regenerate its package-lock.json.');
  process.exit(1);
}

// npm installs native packages for both Linux C libraries (glibc and musl);
// only the one matching this machine can load. Remove the other (~120 MB:
// Next.js SWC compiler and sharp/libvips builds) to stay under disk quotas.
step('Removing native packages for the other C library');
const glibc = Boolean(process.report?.getReport?.().header?.glibcVersionRuntime);
const otherLibc = glibc ? ['@next/swc-linux-x64-musl', '@next/swc-linux-arm64-musl'] : ['@next/swc-linux-x64-gnu', '@next/swc-linux-arm64-gnu'];
const imgDir = path.join(here, 'node_modules/@img');
if (existsSync(imgDir)) {
  for (const name of readdirSync(imgDir)) {
    const isMusl = name.includes('linuxmusl');
    const isGlibcLinux = /^sharp-(libvips-)?linux-/.test(name);
    if (glibc ? isMusl : isGlibcLinux) otherLibc.push(`@img/${name}`);
  }
}
for (const name of otherLibc) {
  const dir = path.join(here, 'node_modules', name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`  removed ${name} (this machine uses ${glibc ? 'glibc' : 'musl'})`);
  }
}

// 2. Copy sources -------------------------------------------------------------
step('Copying apps/web and packages/shared');
const skip = new Set(['node_modules', '.next', 'dist', 'tsconfig.tsbuildinfo', 'next-env.d.ts']);
const copy = (rel) => {
  const dest = path.join(here, rel);
  rmSync(dest, { recursive: true, force: true });
  cpSync(path.join(repo, rel), dest, { recursive: true, filter: (src) => !skip.has(path.basename(src)) });
};
copy('packages/shared');
copy('apps/web');

// 3. Build and install @rinseops/shared ----------------------------------------
step('Building @rinseops/shared');
run(process.execPath, [path.join(here, 'node_modules/typescript/bin/tsc'), '-p', 'packages/shared/tsconfig.build.json'], { cwd: here });
const sharedPkg = path.join(here, 'node_modules/@rinseops/shared');
rmSync(sharedPkg, { recursive: true, force: true });
mkdirSync(sharedPkg, { recursive: true });
cpSync(path.join(here, 'packages/shared/package.json'), path.join(sharedPkg, 'package.json'));
cpSync(path.join(here, 'packages/shared/dist'), path.join(sharedPkg, 'dist'), { recursive: true });

// 4. Next.js build (webpack, standalone) ----------------------------------------
step('Building the web CRM (next build --webpack)');
run(process.execPath, [path.join(here, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  cwd: path.join(here, 'apps/web'),
  env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', RINSEOPS_WEBPACK_MEMORY_CACHE: '1' },
});

// 5. Complete the standalone output and drop leftovers ----------------------------
step('Preparing the standalone server');
run(process.execPath, ['scripts/prepare-standalone.mjs'], { cwd: path.join(here, 'apps/web') });
rmSync(path.join(here, 'apps/web/.next/cache'), { recursive: true, force: true });

const entry = path.join(here, 'apps/web/.next/standalone/server.js');
if (!existsSync(entry)) {
  console.error(`Build finished but ${entry} is missing.`);
  process.exit(1);
}
console.log('\nDone. Output directory: apps/web/.next/standalone  Entry file: server.js');
