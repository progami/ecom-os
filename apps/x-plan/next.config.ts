import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Base path configuration - set BASE_PATH env var if needed
  basePath: process.env.BASE_PATH || '',
  assetPrefix: process.env.BASE_PATH || '',

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

  // Disable ESLint during production builds for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  serverExternalPackages: ['@prisma/client', 'handsontable'],
};

export default nextConfig;
