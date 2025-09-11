import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1
    }
  };
}

export function getPaginationParams(request: Request): PaginationParams {
  const url = new URL(request.url);
  const params = {
    page: url.searchParams.get('page') || '1',
    limit: url.searchParams.get('limit') || '20',
    sortBy: url.searchParams.get('sortBy') || undefined,
    sortOrder: url.searchParams.get('sortOrder') || 'desc'
  };

  const result = paginationSchema.safeParse(params);
  if (!result.success) {
    return {
      page: 1,
      limit: 20,
      sortOrder: 'desc'
    };
  }

  return result.data;
}

export function getPaginationSkipTake(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit
  };
}