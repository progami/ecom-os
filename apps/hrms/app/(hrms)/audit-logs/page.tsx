'use client'

import { useCallback, useEffect, useState } from 'react'
import { AuditLogsApi, type AuditLog } from '@/lib/api-client'
import { LockClosedIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

function formatWhen(isoString: string) {
  return new Date(isoString).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await AuditLogsApi.list({ take: 100 })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load audit logs', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Audit Logs"
        description="Immutable activity trail for HR operations"
        icon={<LockClosedIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-6">
        <Card padding="md">
          <p className="text-sm text-gray-600">
            Use this for compliance reviews, incident investigations, and approvals traceability.
          </p>
        </Card>

        <ResultsCount count={items.length} singular="entry" plural="entries" loading={loading} />

        <Table>
          <TableHeader>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Summary</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={8} columns={5} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                icon={<LockClosedIcon className="h-10 w-10" />}
                title="No audit entries"
                description="No activity has been recorded yet."
              />
            ) : (
              items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-gray-600">{formatWhen(log.createdAt)}</TableCell>
                  <TableCell className="text-gray-900">
                    {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : '—'}
                  </TableCell>
                  <TableCell className="text-gray-600">{log.action}</TableCell>
                  <TableCell className="text-gray-600">
                    {log.entityType} • {log.entityId}
                  </TableCell>
                  <TableCell className="text-gray-900">
                    <span className="text-sm">{log.summary || '—'}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

