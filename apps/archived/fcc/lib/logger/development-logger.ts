import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'development.log');

export function logToDevelopmentFile(message: string, data?: any) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data: data || {}
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (error) {
    console.error('Failed to write to development log:', error);
  }
}

export function logTaxSync(context: string, data: any) {
  const message = `[Tax Sync] ${context}`;
  logToDevelopmentFile(message, data);
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(message, JSON.stringify(data, null, 2));
  }
}