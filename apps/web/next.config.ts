import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-coach/shared', '@ai-coach/ai', '@ai-coach/db'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
