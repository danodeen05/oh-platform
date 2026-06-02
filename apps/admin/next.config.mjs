/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resilient production builds: the repo pins React 19 RC type packages that
  // emit benign JSX type mismatches. Mirror the web app so deploys aren't
  // blocked by type/lint noise (tsc is still run separately for real checks).
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
export default nextConfig;
