import type { NextConfig } from 'next'
import { version } from './package.json'

const nextConfig: NextConfig = {
  env: {
    // Baked in at build time from package.json — bump the version there on each release.
    NEXT_PUBLIC_APP_VERSION: `v${version}`,
  },
}

export default nextConfig
