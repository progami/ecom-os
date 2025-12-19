import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request, session) => {
 try {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const entityType = searchParams.get('tableName') || searchParams.get('entityType')
 const entityId = searchParams.get('recordId') || searchParams.get('entityId')
 const limit = parseInt(searchParams.get('limit') || '50')

 const whereClause: { entity?: string; entityId?: string } = {}

 if (entityType) {
 // Map entity type to table name for backward compatibility
 const tableMap: { [key: string]: string } = {
 'transaction': 'inventory_transactions',
 'invoice': 'invoices',
 'sku': 'skus',
 'warehouse': 'warehouses'
 }
 whereClause.entity = tableMap[entityType] || entityType
 }

 if (entityId) {
 whereClause.entityId = entityId
 }

 const logs = await prisma.auditLog.findMany({
 where: whereClause,
 include: {
 user: {
 select: {
 id: true,
 fullName: true
 }
 }
 },
 orderBy: {
 createdAt: 'desc'
 },
 take: limit
 })

 // Transform logs to match the expected format
 const transformedLogs = logs.map(log => ({
 id: log.id,
 entityType: log.entity === 'inventory_transactions' ? 'transaction' : log.entity,
 entityId: log.entityId,
 action: log.action,
 oldValue: log.oldValue || null,
 newValue: log.newValue || null,
 changedBy: log.user,
 createdAt: log.createdAt
 }))

 return NextResponse.json({
 logs: transformedLogs,
 count: logs.length
 })
 } catch (_error) {
 // console.error('Fetch audit logs error:', _error)
 return NextResponse.json({
 error: 'Failed to fetch audit logs',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
})
