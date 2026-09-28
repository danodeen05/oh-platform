import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const here = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Build stamp for the plan shell footer and print cover (lib/plan/build.ts).
// Vercel sets VERCEL_GIT_COMMIT_SHA; elsewhere ask git, and fail soft.
const planCommit =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  (() => {
    try {
      return execSync('git rev-parse HEAD', { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  })();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Perf measurement builds (Task G2a) go to their own dist dir so they never
  // clash with a running dev server's `.next`: NEXT_DIST_DIR=.next-perf.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_PLAN_BUILT_AT: new Date().toISOString(),
    NEXT_PUBLIC_PLAN_COMMIT: planCommit,
  },
  // The business plan engine is consumed from TypeScript source (spec 5.1: one
  // package, no build step, every figure traceable to it).
  transpilePackages: ['@oh/plan-model', '@oh/floor-plan'],
  // The plan NDA's executed PDF is rendered server-side with @react-pdf/renderer,
  // which reads its fonts and logo from lib/plan/nda/assets at runtime.
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: {
    '/api/plan/nda/sign': ['./lib/plan/nda/assets/**/*'],
  },
  // The pnpm workspace root. Next infers this, but the inference has failed on dev-server
  // self-restarts ("Next.js package not found"), so pin it.
  turbopack: { root: path.join(here, '..', '..') },
  // The floor plan's 3D view imports a few named drei helpers; keep the barrel tree-shaken.
  experimental: {
    optimizePackageImports: ['@react-three/drei'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Press and Careers were template pages with invented facts (San Francisco flagship,
  // open jobs). Retired 2026-09-27; old links land on the homepage instead of a 404.
  async redirects() {
    return [
      { source: '/:locale(en|zh-TW|zh-CN|es)/press', destination: '/:locale', permanent: true },
      { source: '/:locale(en|zh-TW|zh-CN|es)/careers', destination: '/:locale', permanent: true },
      { source: '/press', destination: '/', permanent: true },
      { source: '/careers', destination: '/', permanent: true },
      // Task D7: the loyalty page is now /rewards (permanent: true is a 308).
      { source: '/:locale(en|zh-TW|zh-CN|es)/loyalty', destination: '/:locale/rewards', permanent: true },
      { source: '/loyalty', destination: '/rewards', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ohbeef.com',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
