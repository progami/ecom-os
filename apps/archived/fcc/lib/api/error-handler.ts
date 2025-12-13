import { NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ErrorContext {
  component: string;
  operation?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export function handleApiError(
  error: unknown,
  context: ErrorContext
): NextResponse {
  const { component, operation, userId, metadata } = context;
  const logPrefix = `[${component}]${operation ? ` ${operation}` : ''}`;

  // Log the error with context
  structuredLogger.error(`${logPrefix} Error occurred`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId,
    ...metadata,
  });

  // Handle specific error types
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Duplicate Entry',
          message: 'This record already exists',
        },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'The requested record was not found',
        },
        { status: 404 }
      );
    }
  }

  // Handle Xero API errors
  if (error instanceof Error && error.message.includes('Xero')) {
    return NextResponse.json(
      {
        error: 'External API Error',
        message: 'Failed to communicate with Xero',
        recommendation: 'Please try again later or check your Xero connection',
      },
      { status: 503 }
    );
  }

  // Handle authentication errors
  if (error instanceof Error && 
      (error.message.includes('Unauthorized') || 
       error.message.includes('authentication'))) {
    return NextResponse.json(
      {
        error: 'Authentication Required',
        message: 'Please log in to access this resource',
      },
      { status: 401 }
    );
  }

  // Default error response
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      recommendation: 'Please try again later',
    },
    { status: 500 }
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export function getStatusCode(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return 404;
    if (error.code === 'P2002') return 409;
  }
  if (error instanceof Error) {
    if (error.message.includes('Unauthorized')) return 401;
    if (error.message.includes('Forbidden')) return 403;
    if (error.message.includes('Not Found')) return 404;
    if (error.message.includes('Xero')) return 503;
  }
  return 500;
}

export function getRecommendation(error: unknown): string {
  const statusCode = getStatusCode(error);
  
  switch (statusCode) {
    case 400:
      return 'Please check your input and try again';
    case 401:
      return 'Please log in to continue';
    case 403:
      return 'You do not have permission to access this resource';
    case 404:
      return 'The requested resource was not found. Try importing data from Xero';
    case 409:
      return 'This record already exists';
    case 503:
      return 'External service is unavailable. Please try again later';
    default:
      return 'Please try again or contact support if the issue persists';
  }
}