const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')

// Load environment file by NODE_ENV like WMS
if (!process.env.CI) {
  const envFile = `.env.${process.env.NODE_ENV || 'development'}`
  try {
    require('dotenv').config({ path: path.join(__dirname, envFile) })
  } catch (e) {
    // Fallback to .env if specific file not found
    try { require('dotenv').config() } catch {}
  }
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3006', 10)

// Create the Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Production logging similar to WMS
let logger = console
if (!dev) {
  try {
    const winston = require('winston')
    require('winston-daily-rotate-file')
    const logDir = process.env.LOG_DIR || path.join(__dirname, 'logs')
    logger = winston.createLogger({
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
    })
  } catch (e) {
    // Fallback to console
    logger = console
  }
}

app.prepare().then(async () => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      logger.error ? logger.error(err) : console.error(err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })
    .once('error', (err) => {
      logger.error ? logger.error('Server error', err) : console.error('Server error', err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`HRMS listening on http://${hostname}:${port} in ${dev ? 'dev' : 'prod'} mode`)
    })
})

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
