import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The business plan engine is consumed from TypeScript source (spec 5.1: one
  // package, no build step, every figure traceable to it).
  transpilePackages: ['@oh/plan-model'],
  typescript: {
    ignoreBuildErrors: true,
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
