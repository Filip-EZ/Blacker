import type { NextConfig } from 'next';

// Locally the keys live in the repo root (.env.local, shared with the scraper). On Vercel there is
// no such file and the variables come from the project settings; existing values are never overwritten.
try {
  process.loadEnvFile(new URL('../../.env.local', import.meta.url));
} catch {
  // No root .env.local: fine on Vercel and in CI.
}

const config: NextConfig = {
  // @blacker/core ships TypeScript sources, not a build.
  transpilePackages: ['@blacker/core'],
};

export default config;
