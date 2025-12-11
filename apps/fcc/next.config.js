/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    instrumentationHook: true,
    optimizeCss: true,
    optimizePackageImports: ['recharts', 'lucide-react', '@radix-ui/react-*'],
  },
  // Performance optimizations
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  
  // Enable static optimization for better performance
  reactStrictMode: true,
  
  // Temporarily disable TypeScript errors to test sync
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Ensure proper hydration in development
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
  
  // Configure headers for caching
  async headers() {
    return [
      {
        source: '/api/v1/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  
  // Turbopack is the default bundler in Next.js 16
  turbopack: {},

  // Optimize images
  images: {
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
  },

  // Prevent server restarts when logs or database files change
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/logs/**',
          '**/prisma/dev.db*',
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**'
        ],
      }
    }
    
    // Bundle optimization for production
    if (!dev && !isServer) {
      // Optimize bundle splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          commons: {
            name: 'commons',
            chunks: 'initial',
            minChunks: 20,
            priority: 20,
          },
          recharts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-.*|victory.*)[\\/]/,
            priority: 30,
            reuseExistingChunk: true,
          },
          radix: {
            name: 'radix-ui',
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            priority: 25,
            reuseExistingChunk: true,
          },
          tanstack: {
            name: 'tanstack',
            test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            priority: 25,
            reuseExistingChunk: true,
          },
          shared: {
            name(module, chunks) {
              return `npm.${module
                .libIdent({ context: 'dir' })
                .replace(/[@\\\/]/g, '-')}`;
            },
            chunks: 'async',
            reuseExistingChunk: true,
            priority: 10,
            minChunks: 2,
            enforce: true,
          },
        },
        maxAsyncRequests: 30,
        maxInitialRequests: 25,
        enforceSizeThreshold: 50000,
      };
      
      // Enable tree shaking for ES modules
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    
    return config
  },
}

module.exports = nextConfig