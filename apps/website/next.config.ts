import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
            value: "ecomos\\..*",
          },
        ],
        destination: "/ecomos",
      },
    ]
  },
}

export default nextConfig
