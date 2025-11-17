import { prisma } from '@/lib/prisma'
import { Prisma } from '@ecom-os/prisma-wms'
import { sanitizeForAudit } from './input-sanitization'

export interface AuditLogEntry {
 entityType: string
 entityId: string
 action: string
 userId: string
 data?: unknown
 ipAddress?: string
 userAgent?: string
}

/**
 * Create an audit log entry
 */
export async function auditLog(entry: AuditLogEntry) {
 try {
 // Sanitize data before storing
 const sanitizedData: Prisma.JsonValue =
 entry.data === undefined ? null : sanitizeAuditData(entry.data)

 await prisma.auditLog.create({
 data: {
 entity: entry.entityType,
 entityId: entry.entityId,
 action: entry.action,
 userId: entry.userId,
 newValue: sanitizedData,
 }
 })
 } catch (_error) {
 // Log to external system if database write fails
 // console.error('Failed to write audit log:', error, entry)
 // Could send to external logging service here
 }
}

/**
 * Sanitize data for audit logging
 */
function sanitizeAuditData(data: unknown): Prisma.JsonValue {
 if (data === null || data === undefined) {
 return null
 }

 if (typeof data === 'string') {
 return sanitizeForAudit(data) as string
 }

 if (typeof data === 'number' || typeof data === 'boolean') {
 return data
 }

 if (typeof data === 'bigint') {
 return data.toString()
 }

 if (data instanceof Date) {
 return data.toISOString()
 }

 if (data instanceof Set) {
 const sanitizedSet: Prisma.JsonArray = Array.from(data).map((item) => sanitizeAuditData(item))
 return sanitizedSet
 }

 if (data instanceof Map) {
 const mapObject: Record<string, Prisma.JsonValue> = {}
 for (const [key, value] of data.entries()) {
 mapObject[String(key)] = sanitizeAuditData(value)
 }
 return mapObject
 }

 if (Array.isArray(data)) {
 const sanitizedArray: Prisma.JsonArray = data.map((item) => sanitizeAuditData(item))
 return sanitizedArray
 }

 if (typeof data === 'object') {
 const sanitized: Record<string, Prisma.JsonValue> = {}
 for (const [key, value] of Object.entries(data)) {
 if (isSensitiveField(key)) {
 sanitized[key] = '[REDACTED]'
 } else {
 sanitized[key] = sanitizeAuditData(value)
 }
 }
 return sanitized
 }

 // Fallback to string representation for unsupported types
 return String(data)
}

/**
 * Check if a field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
 const sensitivePatterns = [
 /password/i,
 /secret/i,
 /token/i,
 /key/i,
 /auth/i,
 /credit/i,
 /ssn/i,
 /bank/i,
 ]
 
 return sensitivePatterns.some(pattern => pattern.test(fieldName))
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogs(
 entityType: string,
 entityId: string,
 options: {
 limit?: number
 offset?: number
 startDate?: Date
 endDate?: Date
 userId?: string
 } = {}
) {
 const where: Prisma.AuditLogWhereInput = {
 entity: entityType,
 entityId: entityId,
 }
 
 if (options.userId) {
 where.userId = options.userId
 }
 
 if (options.startDate || options.endDate) {
 where.createdAt = {}
 if (options.startDate) where.createdAt.gte = options.startDate
 if (options.endDate) where.createdAt.lte = options.endDate
 }
 
 return prisma.auditLog.findMany({
 where,
 include: {
 user: {
 select: {
 id: true,
 fullName: true,
 email: true,
 }
 }
 },
 orderBy: {
 createdAt: 'desc'
 },
 take: options.limit || 50,
 skip: options.offset || 0,
 })
}

/**
 * Create a compliance report for audit logs
 */
export async function generateComplianceReport(
 startDate: Date,
 endDate: Date,
 options: {
 entityTypes?: string[]
 actions?: string[]
 userIds?: string[]
 } = {}
) {
 const where: Prisma.AuditLogWhereInput = {
 createdAt: {
 gte: startDate,
 lte: endDate,
 }
 }
 
 if (options.entityTypes?.length) {
 where.entity = { in: options.entityTypes }
 }
 
 if (options.actions?.length) {
 where.action = { in: options.actions }
 }
 
 if (options.userIds?.length) {
 where.userId = { in: options.userIds }
 }
 
 // Get aggregated data
 const [totalLogs, logsByType, logsByUser, logsByAction] = await Promise.all([
 // Total count
 prisma.auditLog.count({ where }),
 
 // Group by entity type
 prisma.auditLog.groupBy({
 by: ['entity'],
 where,
 _count: true,
 }),
 
 // Group by user
 prisma.auditLog.groupBy({
 by: ['userId'],
 where,
 _count: true,
 }),
 
 // Group by action
 prisma.auditLog.groupBy({
 by: ['action'],
 where,
 _count: true,
 }),
 ])
 
 return {
 period: {
 start: startDate,
 end: endDate,
 },
 summary: {
 totalLogs,
 byEntityType: logsByType,
 byUser: logsByUser,
 byAction: logsByAction,
 },
 }
}
