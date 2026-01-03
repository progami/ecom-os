import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { getHrOpsDashboardSnapshot } from '@/lib/domain/dashboards/hr-ops'

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

    const snapshot = await getHrOpsDashboardSnapshot({ take: 250 })

    const rows: Array<Record<string, unknown>> = []
    const push = (bucket: string, items: typeof snapshot.overdue.leaves.items) => {
      for (const item of items) {
        rows.push({
          bucket,
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          href: item.href,
          createdAt: item.createdAt ?? '',
          dueAt: item.dueAt ?? '',
        })
      }
    }

    push('LEAVES', snapshot.overdue.leaves.items)
    push('REVIEWS', snapshot.overdue.reviews.items)
    push('VIOLATIONS', snapshot.overdue.violations.items)
    push('ACKS', snapshot.overdue.acknowledgements.items)

    const headers = ['bucket', 'id', 'title', 'subtitle', 'href', 'createdAt', 'dueAt']
    const csv = toCsv(headers, rows)

    await writeAuditLog({
      actorId,
      action: 'EXPORT',
      entityType: 'EXPORT',
      entityId: 'HR_OPS_OVERDUE',
      summary: 'Exported HR ops overdue list',
      metadata: {
        generatedAt: snapshot.generatedAt,
        rows: rows.length,
      },
      req,
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"hr-ops-overdue-${todayStamp()}.csv\"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to export HR ops overdue list')
  }
}
