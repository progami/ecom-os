import { structuredLogger } from './logger';

export function devLog(context: string, message: string, data?: any) {
  if (process.env.NODE_ENV !== 'production') {
    const formattedMessage = `[${context}] ${message}`;
    structuredLogger.info(formattedMessage, data);
  }
}