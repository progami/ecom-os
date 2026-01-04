'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { AuditLogsApi, type AuditLog } from '@/lib/api-client'
import { LockClosedIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { ResultsCount } from '@/components/ui/Table'
import { TableEmptyContent } from '@/components/ui/EmptyState'

function formatWhen(isoString: string) {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await AuditLogsApi.list({ take: 100 })
      setItems(data.items)
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

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'When',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{formatWhen(getValue<string>())}</span>
        ),
        enableSorting: true,
      },
      {
        accessorFn: (row) =>
          row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : '',
        id: 'actor',
        header: 'Actor',
        cell: ({ getValue }) => {
          const value = getValue<string>()
          return <span className="text-foreground">{value || '—'}</span>
        },
        enableSorting: true,
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorFn: (row) => `${row.entityType} • ${row.entityId}`,
        id: 'entity',
        header: 'Entity',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.entityType} • {row.original.entityId}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        cell: ({ getValue }) => {
          const value = getValue<string>()
          return <span className="text-sm text-foreground">{value || '—'}</span>
        },
        enableSorting: false,
      },
    ],
    []
  )

  return (
    <>
      <ListPageHeader
        title="Audit Logs"
        description="Immutable activity trail for HR operations"
        icon={<LockClosedIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-6">
        <Card padding="md">
          <p className="text-sm text-muted-foreground">
            Use this for compliance reviews, incident investigations, and approvals traceability.
          </p>
        </Card>

        <ResultsCount count={items.length} singular="entry" plural="entries" loading={loading} />

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          skeletonRows={8}
          emptyState={
            <TableEmptyContent
              icon={<LockClosedIcon className="h-10 w-10" />}
              title="No audit entries"
              description="No activity has been recorded yet."
            />
          }
        />
      </div>
    </>
  )
}
