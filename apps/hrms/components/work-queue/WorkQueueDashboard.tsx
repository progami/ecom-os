'use client'

import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import type { WorkItemsResponse, WorkItemDTO } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { WorkItemList } from './WorkItemList'
import { WorkItemPreviewPane } from './WorkItemPreviewPane'

type WorkQueueDashboardProps = {
  data: WorkItemsResponse | null
  loading: boolean
  error?: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
}

export function WorkQueueDashboard({ data, loading, error, selectedId, onSelect, onAction }: WorkQueueDashboardProps) {
  const items = data?.items ?? []
  const meta = data?.meta

  const selected = useMemo(() => {
    if (!items.length) return null
    if (!selectedId) return items[0] ?? null
    return items.find((i) => i.id === selectedId) ?? items[0] ?? null
  }, [items, selectedId])

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="error">
          {error}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{meta?.totalCount ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Required</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{meta?.actionRequiredCount ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{meta?.overdueCount ?? 0}</p>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="lg:col-span-2">
            <div className="h-80 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <WorkItemList items={items} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <div className="lg:col-span-2">
            <WorkItemPreviewPane item={selected} onAction={onAction} />
          </div>
        </div>
      )}
    </div>
  )
}
