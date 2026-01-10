import type { NextConfig } from "next"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const { version } = require("./package.json") as { version: string }
const resolvedVersion = process.env.NEXT_PUBLIC_VERSION || version

const nextConfig: NextConfig = {
  transpilePackages: ["@targon/theme"],
  env: {
    NEXT_PUBLIC_VERSION: resolvedVersion,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "targon-website.s3.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/",
        has: [
          {
            type: "header",
            key: "host",
            value: "targon\\..*",
          },
        ],
        destination: "/targon",
      },
    ]
  },
}

export default nextConfig
