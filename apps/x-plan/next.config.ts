import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      rules: {
        "*.{ts,tsx}": {
          loaders: ["@vercel/turbo/next"],
        },
      },
    },
  },
  eslint: {
    dirs: ["app", "components", "lib"],
  },
  transpilePackages: [
    "@ecom-os/auth",
    "@ecom-os/config",
    "@ecom-os/logger",
  ],
};

export default nextConfig;
