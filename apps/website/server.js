const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')

// Load environment variables in non-CI environments
if (!process.env.CI) {
  try {
    require('dotenv').config({
      path: path.join(__dirname, `.env.${process.env.NODE_ENV || 'development'}`)
    })
  } catch {}
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

// Optional production logger
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
          level: 'error',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d'
        })
      ]
    })
  } catch {
    // Fallback to console if winston not installed
    logger = console
  }
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      logger.error ? logger.error('Request handler error', { message: err.message, stack: err.stack }) : console.error(err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Server listening at http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`)
    })
})

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

