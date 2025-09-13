const path = require('path')
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    // Ensure '@/...' resolves to this app root
    config.resolve.alias['@'] = __dirname
    config.resolve.alias['@/'] = __dirname + '/'
    return config
  },
}

module.exports = nextConfig
