import { structuredLogger } from './logger';
import { AppError, ErrorType } from './errors/error-handler';

export interface XeroApiError {
  statusCode: number;
  message: string;
  type?: string;
  detail?: string;
  validationErrors?: Array<{
    message: string;
    field?: string;
  }>;
}

export class XeroErrorHandler {
  static isRateLimitError(error: any): boolean {
    return error?.response?.statusCode === 429 || 
           error?.statusCode === 429 ||
           error?.response?.status === 429;
  }

  static isAuthError(error: any): boolean {
    return error?.response?.statusCode === 401 || 
           error?.statusCode === 401 ||
           error?.response?.status === 401;
  }

  static isServiceUnavailable(error: any): boolean {
    return error?.response?.statusCode === 503 || 
           error?.statusCode === 503 ||
           error?.response?.status === 503;
  }

  static getRetryAfter(error: any): number {
    // Check for Retry-After header
    const retryAfter = error?.response?.headers?.['retry-after'] || 
                      error?.response?.headers?.['Retry-After'];
    
    if (retryAfter) {
      // If it's a number, it's seconds
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to milliseconds
      }
    }
    
    // Default retry delays based on error type
    if (this.isRateLimitError(error)) {
      return 60000; // 1 minute for rate limit
    }
    if (this.isServiceUnavailable(error)) {
      return 30000; // 30 seconds for service unavailable
    }
    
    return 5000; // 5 seconds default
  }

  static shouldRetry(error: any, attemptNumber: number): boolean {
    // Don't retry auth errors
    if (this.isAuthError(error)) {
      return false;
    }
    
    // Retry rate limit and service unavailable errors up to 3 times
    if (this.isRateLimitError(error) || this.isServiceUnavailable(error)) {
      return attemptNumber < 3;
    }
    
    // Retry network errors
    if (error?.code === 'ECONNRESET' || 
        error?.code === 'ETIMEDOUT' || 
        error?.code === 'ENOTFOUND') {
      return attemptNumber < 2;
    }
    
    return false;
  }

  static async handleError(error: any, context: { operation: string; tenantId?: string }): Promise<never> {
    const errorDetails = this.extractErrorDetails(error);
    
    structuredLogger.error(`Xero API error in ${context.operation}`, error, {
      component: 'xero-api',
      operation: context.operation,
      tenantId: context.tenantId,
      statusCode: errorDetails.statusCode,
      errorType: errorDetails.type,
      errorMessage: errorDetails.message
    });

    // Handle specific error types
    if (this.isAuthError(error)) {
      throw new AppError(
        ErrorType.AUTHENTICATION,
        'Authentication failed. Please reconnect to Xero.',
        401,
        'XERO_AUTH_FAILED'
      );
    }
    
    if (this.isRateLimitError(error)) {
      const retryAfter = this.getRetryAfter(error);
      throw new AppError(
        ErrorType.RATE_LIMIT,
        `Rate limit exceeded. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`,
        429,
        'XERO_RATE_LIMIT',
        { retryAfter }
      );
    }
    
    if (this.isServiceUnavailable(error)) {
      throw new AppError(
        ErrorType.EXTERNAL_SERVICE,
        'Xero service is temporarily unavailable. Please try again later.',
        503,
        'XERO_UNAVAILABLE'
      );
    }
    
    // Validation errors
    if (errorDetails.statusCode === 400 && errorDetails.validationErrors?.length) {
      const messages = errorDetails.validationErrors.map(e => e.message).join(', ');
      throw new AppError(
        ErrorType.VALIDATION,
        `Validation error: ${messages}`,
        400,
        'XERO_VALIDATION_ERROR',
        errorDetails.validationErrors
      );
    }
    
    // Generic error
    throw new AppError(
      errorDetails.statusCode >= 500 ? ErrorType.EXTERNAL_SERVICE : ErrorType.BAD_REQUEST,
      errorDetails.message || 'An error occurred while communicating with Xero',
      errorDetails.statusCode || 500,
      'XERO_API_ERROR'
    );
  }

  static extractErrorDetails(error: any): XeroApiError {
    // Handle Xero SDK error structure
    if (error?.response?.body) {
      const body = error.response.body;
      return {
        statusCode: error.response.statusCode || 500,
        message: body.Message || body.message || 'Unknown error',
        type: body.Type || body.type,
        detail: body.Detail || body.detail,
        validationErrors: body.Elements?.[0]?.ValidationErrors || body.validationErrors
      };
    }
    
    // Handle axios-style errors
    if (error?.response?.data) {
      const data = error.response.data;
      return {
        statusCode: error.response.status || 500,
        message: data.Message || data.message || data.error || 'Unknown error',
        type: data.Type || data.type,
        detail: data.Detail || data.detail
      };
    }
    
    // Handle plain errors
    return {
      statusCode: error?.statusCode || error?.status || 500,
      message: error?.message || 'Unknown error'
    };
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    context: { operation: string; tenantId?: string },
    maxAttempts = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt) || attempt === maxAttempts) {
          break;
        }
        
        const delay = this.getRetryAfter(error);
        structuredLogger.info(`Retrying ${context.operation} after ${delay}ms (attempt ${attempt}/${maxAttempts})`, {
          component: 'xero-api',
          operation: context.operation,
          attempt,
          delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return this.handleError(lastError, context);
  }
}