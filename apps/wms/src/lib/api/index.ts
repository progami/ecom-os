/**
 * Centralized API utilities export
 */

// Authentication and authorization
export {
 withAuth,
 withAuthAndParams,
 withRole,
 withWarehouse,
 requireRole,
 requireWarehouse,
 type AuthenticatedHandler,
 type AuthenticatedHandlerWithParams
} from './auth-wrapper'

// Response utilities
export {
 ApiResponses,
 ValidationError,
 AuthorizationError,
 NotFoundError,
 ConflictError
} from './responses'

// Validation utilities
export {
 validateRequest,
 validateArray,
 parseQueryParams,
 validateDateRange,
 sanitizeForDisplay,
 CommonSchemas
} from './validation'

// Re-export zod for convenience
export { z } from 'zod'