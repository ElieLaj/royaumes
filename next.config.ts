import type { NextConfig } from 'next'

/** PGlite et pg doivent être chargés tels quels par Node.js, non intégrés à la construction. */
const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
}

export default nextConfig
