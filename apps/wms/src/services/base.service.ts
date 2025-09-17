import { PrismaClient, Prisma } from '@prisma/client'
import { Session } from 'next-auth'
import DOMPurify from 'isomorphic-dompurify'
import { businessLogger, perfLogger, securityLogger } from '@/lib/logger/server'
import { getWarehouseFilter } from '@/lib/auth-utils'

export interface ServiceContext {
  session: Session
  prisma: PrismaClient
}

export interface TransactionOptions {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
}

export abstract class BaseService {
  protected prisma: PrismaClient
  protected session: Session | null = null

  constructor(protected context: ServiceContext) {
    this.prisma = context.prisma
    this.session = context.session
  }

  /**
   * Execute database operations within a transaction
   */
  protected async executeInTransaction<T>(
    operation: (tx: PrismaClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const startTime = Date.now()
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      businessLogger.info(`Starting transaction`, {
        transactionId: transactionId,
        service: this.constructor.name,
        userId: this.session?.user?.id
      })

      const result = await this.prisma.$transaction(
        async (tx) => {
          // Type assertion to handle Prisma transaction client type
          return await operation(tx as PrismaClient)
        },
        {
          isolationLevel: options?.isolationLevel,
          maxWait: 5000,
          timeout: 10000
        }
      )

      const duration = Date.now() - startTime
      perfLogger.log(`Transaction completed`, {
        transactionId: transactionId,
        service: this.constructor.name,
        duration
      })

      return result
    } catch (_error) {
      const duration = Date.now() - startTime
      businessLogger.error(`Transaction failed`, {
        transactionId: transactionId,
        service: this.constructor.name,
        error: _error instanceof Error ? _error.message : 'Unknown error',
        duration,
        userId: this.session?.user?.id
      })
      throw _error
    }
  }

  /**
   * Log audit trail for important operations
   */
  protected async logAudit(
    action: string,
    entityType: string,
    entityId: string,
    details?: Prisma.InputJsonValue
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: this.session?.user?.id || 'system',
          action,
          entity: entityType,
          entityId: entityId,
          newValue: details ?? Prisma.JsonNull
        }
      })

      securityLogger.info(`Audit log created`, {
        action,
        entityType,
        entityId,
        userId: this.session?.user?.id,
        service: this.constructor.name
      })
    } catch (_error) {
      // Don't throw on audit log failures
      securityLogger.error(`Failed to create audit log`, {
        action,
        entityType,
        entityId,
        error: _error instanceof Error ? _error.message : 'Unknown error',
        userId: this.session?.user?.id
      })
    }
  }

  /**
   * Check if user has permission for a specific action
   */
  protected async checkPermission(permission: string): Promise<boolean> {
    if (!this.session?.user) {
      return false
    }

    // Admin users have all permissions
    if (this.session.user.role === 'admin') {
      return true
    }

    // For non-admin users, check role-based permissions
    // This is a simplified permission check - in a real app, you'd have a proper permission system
    const rolePermissions: Record<string, string[]> = {
      staff: ['inventory.read', 'inventory.write', 'finance.read'],
      admin: [] // Admin has all permissions, handled above
    }

    const userPermissions = rolePermissions[this.session.user.role] || []
    return userPermissions.includes(permission)
  }

  /**
   * Ensure user has required permission, throw if not
   */
  protected async requirePermission(permission: string): Promise<void> {
    const hasPermission = await this.checkPermission(permission)
    
    if (!hasPermission) {
      securityLogger.warn(`Permission denied`, {
        permission,
        userId: this.session?.user?.id,
        service: this.constructor.name
      })
      throw new Error(`Permission denied: ${permission}`)
    }
  }

  /**
   * Get warehouse filter based on user permissions
   */
  protected getWarehouseFilter(warehouseId?: string): { warehouseId?: string } | null {
    if (!this.session) {
      return null
    }
    return getWarehouseFilter(this.session, warehouseId)
  }

  /**
   * Handle service errors consistently
   */
  protected handleError(_error: unknown, operation: string): never {
    const errorMessage = _error instanceof Error ? _error.message : 'Unknown error'
    
    businessLogger.error(`Service operation failed`, {
      service: this.constructor.name,
      operation,
      error: errorMessage,
      userId: this.session?.user?.id
    })

    // Re-throw with consistent error structure
    throw new Error(`${operation} failed: ${errorMessage}`)
  }

  /**
   * Validate required fields
   */
  protected validateRequired<T extends Record<string, unknown>>(
    data: T,
    requiredFields: (keyof T)[]
  ): void {
    const missingFields = requiredFields.filter(field => !data[field])
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }
  }

  /**
   * Sanitize data for safe storage and display
   * Uses DOMPurify to properly sanitize HTML and prevent XSS attacks
   */
  protected sanitizeData<T extends Record<string, unknown>>(data: T): T {
    const sanitizedEntries = Object.entries(data).map(([key, value]) => {
      if (typeof value === 'string') {
        const cleanValue = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true
        }).trim()
        return [key, cleanValue]
      }

      return [key, value]
    })

    return Object.fromEntries(sanitizedEntries) as T
  }

  /**
   * Get pagination parameters with defaults
   */
  protected getPaginationParams(params: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    return {
      page: Math.max(1, params.page || 1),
      limit: Math.min(100, Math.max(1, params.limit || 10)),
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'desc'
    }
  }

  /**
   * Create paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    params: { page: number; limit: number }
  ) {
    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    }
  }
}
