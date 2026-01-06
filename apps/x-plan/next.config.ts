import type { NextConfig } from "next";
import { createRequire } from "module";

const appBasePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';

const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };
const resolvedVersion = process.env.NEXT_PUBLIC_VERSION || version;

const nextConfig: NextConfig = {
  // Base path configuration - set BASE_PATH env var if needed
  basePath: appBasePath,
  assetPrefix: appBasePath,

  env: {
    NEXT_PUBLIC_VERSION: resolvedVersion,
    NEXT_PUBLIC_BASE_PATH: appBasePath,
  },

  transpilePackages: [
    "@ecom-os/auth",
    "@ecom-os/config",
    "@ecom-os/logger",
  ],

  serverExternalPackages: ['@ecom-os/prisma-x-plan'],
};

export default nextConfig;
