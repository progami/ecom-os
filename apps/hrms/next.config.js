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
}

module.exports = nextConfig
