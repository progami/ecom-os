'use client'

import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
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
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {/* Stats bar - compact inline */}
      <div className="flex items-center gap-6 mb-5 pb-5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-brand-navy-800">{meta?.totalCount ?? 0}</span>
          <span className="text-sm text-muted-foreground">total</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-brand-teal-600">{meta?.actionRequiredCount ?? 0}</span>
          <span className="text-sm text-muted-foreground">action required</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-danger-600">{meta?.overdueCount ?? 0}</span>
          <span className="text-sm text-muted-foreground">overdue</span>
        </div>
      </div>

      {/* Main content area - fixed height with scroll */}
      {loading ? (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-[380px] shrink-0 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
          <div className="flex-1 rounded-xl bg-muted animate-pulse" />
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Scrollable work item list */}
          <div className="w-[380px] shrink-0 flex flex-col min-h-0">
            <WorkItemList items={items} selectedId={selected?.id ?? null} onSelect={onSelect} />
          </div>

          {/* Right: Preview pane - fills remaining space */}
          <div className="flex-1 min-h-0">
            <WorkItemPreviewPane item={selected} onAction={onAction} />
          </div>
        </div>
      )}
    </div>
  )
}
