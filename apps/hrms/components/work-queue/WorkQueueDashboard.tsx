'use client'

import { useMemo } from 'react'
import { Alert } from '@/components/ui/Alert'
import { StatCard } from '@/components/ui/Card'
import { BellIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@/components/ui/Icons'
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
    <div className="space-y-8">
      {error ? (
        <Alert variant="error">
          {error}
        </Alert>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger-children">
        <StatCard
          title="Total"
          value={meta?.totalCount ?? 0}
          subtitle="Pending items"
          icon={<BellIcon className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="Action Required"
          value={meta?.actionRequiredCount ?? 0}
          subtitle="Needs attention"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          variant="accent"
        />
        <StatCard
          title="Overdue"
          value={meta?.overdueCount ?? 0}
          subtitle="Past due date"
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          variant={meta?.overdueCount ? "warning" : "default"}
        />
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="h-80 rounded-xl bg-muted/50 animate-pulse" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <CheckCircleIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">All caught up!</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            You have no pending work items. Check back later for new tasks.
          </p>
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
