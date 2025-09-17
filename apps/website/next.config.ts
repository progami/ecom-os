import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
