import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/errors/api-error';

type HandlerOptions<T extends z.ZodSchema> = {
  authenticate?: boolean;
  schema?: T;
  handler: (
    req: NextRequest,
    context: {
      user?: any;
      body?: z.infer<T>;
      params?: any;
    }
  ) => Promise<any>;
};

export function createApiHandler<T extends z.ZodSchema>(options: HandlerOptions<T>) {
  return async (req: NextRequest, { params }: any) => {
    try {
      let user = null;
      let body = null;

      if (options.authenticate) {
        const session = await validateSession(req);
        if (!session) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
            { status: 401 }
          );
        }
        user = session.user;
      }

      if (options.schema && ['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
        try {
          const rawBody = await req.json();
          body = options.schema.parse(rawBody);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request data',
                  details: error.errors,
                },
              },
              { status: 400 }
            );
          }
          throw error;
        }
      }

      const result = await options.handler(req, { user, body, params });

      return NextResponse.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }

      console.error('Unhandled API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}