'use client'

import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import type { WorkItemsResponse, WorkItemDTO } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { InboxItemList } from './InboxItemList'
import { InboxActionPane } from './InboxActionPane'
import { cn } from '@/lib/utils'

type InboxDashboardProps = {
  data: WorkItemsResponse | null
  loading: boolean
  error?: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
}

function StatCard({ value, label, variant = 'default' }: { value: number; label: string; variant?: 'default' | 'action' | 'danger' }) {
  const colors = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100',
    action: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
    danger: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all',
      colors[variant]
    )}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex gap-6 min-h-0 animate-in fade-in duration-300">
      {/* Left skeleton */}
      <div className="w-[380px] shrink-0 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
      {/* Right skeleton */}
      <div className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
    </div>
  )
}

export function InboxDashboard({ data, loading, error, selectedId, onSelect, onAction }: InboxDashboardProps) {
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

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <StatCard value={meta?.totalCount ?? 0} label="Total" />
        <StatCard value={meta?.actionRequiredCount ?? 0} label="Action Required" variant="action" />
        <StatCard value={meta?.overdueCount ?? 0} label="Overdue" variant="danger" />

        {/* Zero inbox indicator when empty */}
        {meta?.totalCount === 0 ? (
          <div className="ml-auto flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">All clear</span>
          </div>
        ) : null}
      </div>

      {/* Main content area */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Scrollable inbox list */}
          <div className="w-[380px] shrink-0 flex flex-col min-h-0">
            <InboxItemList items={items} selectedId={selected?.id ?? null} onSelect={onSelect} />
          </div>

          {/* Right: Action pane */}
          <div className="flex-1 min-h-0">
            <InboxActionPane item={selected} onAction={onAction} />
          </div>
        </div>
      )}
    </div>
  )
}
