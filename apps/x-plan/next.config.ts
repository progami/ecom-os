import type { NextConfig } from "next";

const appBasePath = process.env.BASE_PATH || ''

const nextConfig: NextConfig = {
  // Base path configuration - set BASE_PATH env var if needed
  basePath: appBasePath,
  assetPrefix: appBasePath,

  transpilePackages: [
    "@ecom-os/auth",
    "@ecom-os/config",
    "@ecom-os/logger",
  ],

  // Disable ESLint during production builds for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  serverExternalPackages: ['@ecom-os/prisma-x-plan', 'handsontable'],
};

export default nextConfig;
