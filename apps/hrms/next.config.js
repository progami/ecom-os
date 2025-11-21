const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  assetPrefix: '/hrms',
  outputFileTracingRoot: path.join(__dirname, '../..'),
}

module.exports = nextConfig
