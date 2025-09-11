const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Clear development log file on startup (before logger is imported)
if (process.env.NODE_ENV !== 'production') {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const devLogPath = path.join(logsDir, 'development.log');
  if (fs.existsSync(devLogPath)) {
    fs.writeFileSync(devLogPath, '');
  }
}

// Import logger after clearing log file
// Note: We'll use console logging in server.js since it's a plain JS file
// The TypeScript logger will be used in the Next.js app
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`),
  error: (msg, err) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, err),
  debug: (msg) => console.log(`[${new Date().toISOString()}] [DEBUG] ${msg}`)
};

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.includes('_next') && !req.url.includes('favicon')) {
      const emoji = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
      console.log(`[${new Date().toISOString()}] [HTTP] ${emoji} ${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
};

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  logger.info('[Server] Starting Jason application...');
  
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost.pem'))
  };

  createServer(httpsOptions, async (req, res) => {
    // Add request logger middleware
    requestLogger(req, res, () => {});
    
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error('[Server] Error handling request', err, { url: req.url });
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, err => {
    if (err) {
      logger.error('[Server] Failed to start server', err);
      throw err;
    }
    logger.info(`[Server] ✅ Ready on https://${hostname}:${port}`);
    logger.info('[Server] Environment: ' + (dev ? 'development' : 'production'));
  });
});