import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@resvg/resvg-js'],
  transpilePackages: ['@lobehub/ui'],
}

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)
