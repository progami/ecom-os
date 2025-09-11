import * as fs from 'fs';
import * as path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const devLogPath = path.join(process.cwd(), 'logs', 'dev.log');
const logStream = fs.createWriteStream(devLogPath, { flags: 'a' });

// Request logging middleware for Express-style middleware
interface RequestWithConnection extends Request {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  connection?: { remoteAddress?: string };
}

interface ResponseWithMethods extends Response {
  statusCode: number;
  write: (chunk: string | Buffer) => boolean;
  end: (chunk?: string | Buffer) => void;
  getHeader: (name: string) => string | number | string[] | undefined;
}

export function requestLogger(req: RequestWithConnection, res: ResponseWithMethods, next?: () => void): void {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  // Log request
  const requestLog = {
    timestamp,
    requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent']
  };
  
  logStream.write(`${timestamp} [REQUEST] ${JSON.stringify(requestLog)}\n`);
  
  // Override res.end to capture response
  const originalEnd = res.end;
  const originalWrite = res.write;
  
  let responseBody = '';
  
  res.write = function(chunk: string | Buffer) {
    if (chunk) {
      responseBody += chunk.toString();
    }
    return originalWrite.apply(res, [chunk]);
  };
  
  res.end = function(chunk?: string | Buffer) {
    if (chunk) {
      responseBody += chunk.toString();
    }
    
    const duration = Date.now() - startTime;
    const responseLog = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentType: res.getHeader('content-type'),
      contentLength: res.getHeader('content-length') || responseBody.length
    };
    
    logStream.write(`${new Date().toISOString()} [RESPONSE] ${JSON.stringify(responseLog)}\n`);
    
    // Log response body for API routes (not for static files)
    if (req.url.startsWith('/api/') && responseBody && res.statusCode !== 304) {
      try {
        const bodyPreview = responseBody.substring(0, 1000);
        logStream.write(`${new Date().toISOString()} [RESPONSE-BODY] [${requestId}] ${bodyPreview}${responseBody.length > 1000 ? '...' : ''}\n`);
      } catch (_e) {
        // Ignore errors in logging response body
      }
    }
    
    return originalEnd.apply(res, chunk ? [chunk] : []);
  };
  
  if (next) {
    next();
  }
}

export default requestLogger;