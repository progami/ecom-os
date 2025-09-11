import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
}