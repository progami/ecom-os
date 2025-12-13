const path = require('path')

const basePath = process.env.BASE_PATH || '/hrms'
const { version } = require('./package.json')
const resolvedVersion = process.env.NEXT_PUBLIC_VERSION || version

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_VERSION: resolvedVersion,
  },
  outputFileTracingRoot: path.join(__dirname, '../..'),
  trailingSlash: false,
  // Turbopack is the default bundler in Next.js 16
  turbopack: {},
}

module.exports = nextConfig
