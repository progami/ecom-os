const path = require('path')

const basePath = process.env.BASE_PATH || '/hrms'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  assetPrefix: basePath,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  trailingSlash: false,
  // Turbopack is the default bundler in Next.js 16
  turbopack: {},
}

module.exports = nextConfig
