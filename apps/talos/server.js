const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const isTruthy = (value) =>
  typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());

// Load environment variables unless explicitly disabled.
// Dotenv does not override existing env vars unless `override: true` is set.
if (!isTruthy(process.env.SKIP_DOTENV)) {
  const dotenv = require('dotenv');
  const baseOptions = { override: false, quiet: true };

  // Load .env.local first (highest precedence for local/prod deployments)
  dotenv.config({
    ...baseOptions,
    path: path.join(__dirname, `.env.local`),
  });

  // Then load environment-specific file
  dotenv.config({
    ...baseOptions,
    path: path.join(__dirname, `.env.${process.env.NODE_ENV || 'development'}`),
  });
}

const basePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || ''

if (basePath && typeof global.fetch === 'function') {
  const originalFetch = global.fetch

  global.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`
      input = `${normalizedBase}${input}`
    }
    return originalFetch.call(this, input, init)
  }
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || (process.env.CI ? '0.0.0.0' : 'localhost');
const port = parseInt(process.env.PORT || '3000', 10);

// In CI, log more information about startup
if (process.env.CI) {
  console.log('Running in CI mode');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
  console.log('USE_TEST_AUTH:', process.env.USE_TEST_AUTH);
}

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Logging setup for production
if (!dev) {
  const winston = require('winston');
  require('winston-daily-rotate-file');
  
  const logDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
  
  // Create winston logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d'
      }),
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d'
      })
    ]
  });

  // Add console transport in development
  if (dev) {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  global.logger = logger;
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      // Log requests in production
      if (!dev && global.logger) {
        global.logger.info('Request', {
          method: req.method,
          url: req.url,
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      }

      // Handle all requests through Next.js
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      
      if (!dev && global.logger) {
        global.logger.error('Request handler error', {
          error: err.message,
          stack: err.stack,
          url: req.url
        });
      }
      
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`
      );
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
