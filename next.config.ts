import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    // Baked in at build time — changes with every deploy.
    // Check the sidebar badge to confirm a deployment went through.
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  },
}

export default nextConfig
