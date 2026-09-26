/**
 * @file Next.js configuration. Workspace packages ship TypeScript source, so Next compiles them.
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@caa/api-contract', '@caa/domain'],
};

export default nextConfig;
