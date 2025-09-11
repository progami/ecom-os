// src/utils/server-logger.ts
// Server-only logger with Winston support - DO NOT import in Edge Runtime contexts
import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, colorize, align } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ''}`;
});

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const serverLogger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize(),
        align(),
        logFormat
      )
    }),
    new transports.File({
      filename: path.join(logsDir, 'server.log'),
      level: 'info',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

export default serverLogger;