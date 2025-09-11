// src/utils/clientLogger.ts
const sendLogToServer = async (level: string, message: string, details?: any) => {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, message, details }),
    });
  } catch (error) {
    console.error('Failed to send log to server:', error);
  }
};

const clientLogger = {
  info: (message: string, details?: any) => sendLogToServer('info', message, details),
  warn: (message: string, details?: any) => sendLogToServer('warn', message, details),
  error: (message: string, details?: any) => sendLogToServer('error', message, details),
  debug: (message: string, details?: any) => sendLogToServer('debug', message, details),
};

export default clientLogger;