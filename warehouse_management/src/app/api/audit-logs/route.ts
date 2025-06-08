import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tableName = searchParams.get('tableName') || searchParams.get('entityType')
    const recordId = searchParams.get('recordId') || searchParams.get('entityId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const whereClause: any = {}
    
    if (tableName) {
      // Map entity type to table name for backward compatibility
      const tableMap: { [key: string]: string } = {
        'transaction': 'inventory_transactions',
        'invoice': 'invoices',
        'sku': 'skus',
        'warehouse': 'warehouses'
      }
      whereClause.tableName = tableMap[tableName] || tableName
    }
    
    if (recordId) {
      whereClause.recordId = recordId
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
      entityType: log.tableName === 'inventory_transactions' ? 'transaction' : log.tableName,
      entityId: log.recordId,
      action: log.action,
      oldValue: (log.changes as any)?.before || null,
      newValue: (log.changes as any)?.after || null,
      changedBy: log.user,
      createdAt: log.createdAt
    }))

    return NextResponse.json({ 
      logs: transformedLogs,
      count: logs.length
    })
  } catch (error) {
    console.error('Fetch audit logs error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}