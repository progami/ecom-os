const https = require('https');
const http = require('http');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Clear development log file on server start
// Now that we've configured watchers to ignore logs directory, this is safe
if (dev) {
  const logsDir = path.join(__dirname, 'logs');
  const devLogPath = path.join(logsDir, 'development.log');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Clear the development log file
  try {
    fs.writeFileSync(devLogPath, '');
    console.log('Development log file cleared on server start');
  } catch (error) {
    console.error('Failed to clear development log:', error);
  }
  
  console.log('Server starting in development mode');
}

// Configure Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// SSL certificate configuration (optional)
const certDir = path.join(__dirname, 'certificates');
const keyPath = path.join(certDir, 'localhost-key.pem');
const certPath = path.join(certDir, 'localhost.pem');
const hasCertificates = fs.existsSync(keyPath) && fs.existsSync(certPath);
const httpsOptions = hasCertificates
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : null;

app.prepare().then(async () => {
  // Queue workers are initialized by Next.js instrumentation hook
  // No need to initialize them here to avoid duplication
  if (dev) {
    console.log('Queue workers will be initialized by Next.js instrumentation hook');
  }
  
  const requestHandler = async (req, res) => {
    try {
      // Use WHATWG URL API instead of deprecated url.parse()
      const protocol = hasCertificates ? 'https' : 'http';
      const baseURL = `${protocol}://${hostname}:${port}`;
      const parsedUrl = new URL(req.url, baseURL);
      
      // Convert to Next.js expected format
      const urlObject = {
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams)
      };
      
      // Skip authentication for Next.js static files - let Next.js handle them directly
      if (urlObject.pathname.startsWith('/_next/static/') || 
          urlObject.pathname.startsWith('/_next/image/') ||
          urlObject.pathname.endsWith('.js') ||
          urlObject.pathname.endsWith('.css') ||
          urlObject.pathname.endsWith('.map')) {
        // Let Next.js handle static files directly
        await handle(req, res, urlObject);
        return;
      }
      
      await handle(req, res, urlObject);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  const createServer = hasCertificates
    ? () => https.createServer(httpsOptions, requestHandler)
    : () => http.createServer(requestHandler);

  if (!hasCertificates) {
    console.warn(
      '[Dev Server] SSL certificates not found in apps/fcc/certificates; starting HTTP server instead.'
    );
  }

  createServer()
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please stop the other instance or use a different port.`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    })
    .listen(port, hostname, () => {
      const protocol = hasCertificates ? 'https' : 'http';
      console.log(`> Ready on ${protocol}://${hostname}:${port}`);
      console.log('> Server PID:', process.pid);
    });
    
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });
});
