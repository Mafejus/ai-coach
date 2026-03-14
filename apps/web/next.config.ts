import type { NextConfig } from 'next';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load root monorepo .env — Next.js only looks in its own directory (apps/web),
// so we manually load ../../.env. override: false = don't overwrite vars already set.
dotenvConfig({ path: resolve(__dirname, '../../.env'), override: false });

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-coach/shared', '@ai-coach/ai', '@ai-coach/db'],
  typedRoutes: true,
};

export default nextConfig;
