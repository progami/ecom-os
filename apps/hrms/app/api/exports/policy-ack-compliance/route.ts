import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { getPolicyAckComplianceExportRows } from '@/lib/domain/dashboards/compliance'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replaceAll('"', '""')}"`
  return str
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ].join('\n')
}

function todayStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const policyId = searchParams.get('policyId') || undefined
    const statusParam = (searchParams.get('status') || 'PENDING').toUpperCase()
    const status = statusParam === 'ALL' ? 'ALL' : statusParam === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'PENDING'

    const rows = await getPolicyAckComplianceExportRows({
      status,
      policyId,
    })

    const headers = [
      'policyTitle',
      'policyCategory',
      'policyRegion',
      'policyVersion',
      'employeeId',
      'employeeName',
      'employeeEmail',
      'employeeDepartment',
      'employeeRegion',
      'status',
      'acknowledgedAt',
    ]

    const csv = toCsv(headers, rows)

    await writeAuditLog({
      actorId,
      action: 'EXPORT',
      entityType: 'EXPORT',
      entityId: 'POLICY_ACK_COMPLIANCE',
      summary: 'Exported policy acknowledgement compliance list',
      metadata: {
        policyId: policyId ?? null,
        status,
        rows: rows.length,
      },
      req,
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"policy-ack-compliance-${todayStamp()}.csv\"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to export policy compliance list')
  }
}

