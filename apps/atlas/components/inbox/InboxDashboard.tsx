'use client'

import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { WorkItemsResponse, WorkItemDTO, CompletedWorkItemsResponse, CompletedWorkItemDTO } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { InboxItemList } from './InboxItemList'
import { CompletedItemList } from './CompletedItemList'
import { InboxActionPane } from './InboxActionPane'
import { CompletedActionPane } from './CompletedActionPane'
import { cn } from '@/lib/utils'

type InboxTab = 'pending' | 'completed'

type InboxDashboardProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  data: WorkItemsResponse | null
  completedData: CompletedWorkItemsResponse | null
  loading: boolean
  completedLoading: boolean
  error?: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
  onNewRequest?: () => void
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

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-semibold rounded-lg transition-all',
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <span className={cn(
          'ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full',
          active
            ? 'bg-white/20 dark:bg-slate-900/20'
            : 'bg-slate-200 dark:bg-slate-700'
        )}>
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function InboxDashboard({
  activeTab,
  onTabChange,
  data,
  completedData,
  loading,
  completedLoading,
  error,
  selectedId,
  onSelect,
  onAction,
  onNewRequest,
}: InboxDashboardProps) {
  const items = data?.items ?? []
  const meta = data?.meta
  const completedItems = completedData?.items ?? []
  const completedMeta = completedData?.meta

  const selected = useMemo(() => {
    if (!items.length) return null
    if (!selectedId) return items[0] ?? null
    return items.find((i) => i.id === selectedId) ?? items[0] ?? null
  }, [items, selectedId])

  const selectedIndex = useMemo(() => {
    if (!selected) return -1
    return items.findIndex((i) => i.id === selected.id)
  }, [items, selected])

  const selectedCompleted = useMemo(() => {
    if (!completedItems.length) return null
    if (!selectedId) return completedItems[0] ?? null
    return completedItems.find((i) => i.id === selectedId) ?? completedItems[0] ?? null
  }, [completedItems, selectedId])

  const completedSelectedIndex = useMemo(() => {
    if (!selectedCompleted) return -1
    return completedItems.findIndex((i) => i.id === selectedCompleted.id)
  }, [completedItems, selectedCompleted])

  const isLoading = activeTab === 'pending' ? loading : completedLoading

  return (
    <div className="flex flex-col h-full">
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {/* Compact header with title, tabs, and action */}
      <div className="shrink-0 flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {/* Title */}
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Inbox</h1>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <TabButton
              active={activeTab === 'pending'}
              onClick={() => onTabChange('pending')}
              count={meta?.totalCount}
            >
              Pending
            </TabButton>
            <TabButton
              active={activeTab === 'completed'}
              onClick={() => onTabChange('completed')}
              count={completedMeta?.totalCount}
            >
              Completed
            </TabButton>
          </div>

          {/* Zero inbox indicator */}
          {activeTab === 'pending' && meta?.totalCount === 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold">All clear</span>
            </div>
          ) : null}
        </div>

        {/* New Request button */}
        {onNewRequest ? (
          <Button onClick={onNewRequest} variant="default" size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Button>
        ) : null}
      </div>

      {/* Main content area */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : activeTab === 'pending' ? (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Scrollable inbox list */}
          <div className="w-[380px] shrink-0 flex flex-col min-h-0">
            <InboxItemList items={items} selectedId={selected?.id ?? null} onSelect={onSelect} />
          </div>

          {/* Right: Action pane */}
          <div className="flex-1 min-h-0">
            <InboxActionPane
              item={selected}
              onAction={onAction}
              currentIndex={selectedIndex}
              totalCount={items.length}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Scrollable completed list */}
          <div className="w-[380px] shrink-0 flex flex-col min-h-0">
            <CompletedItemList items={completedItems} selectedId={selectedCompleted?.id ?? null} onSelect={onSelect} />
          </div>

          {/* Right: Detail pane (no actions) */}
          <div className="flex-1 min-h-0">
            <CompletedActionPane item={selectedCompleted} />
          </div>
        </div>
      )}
    </div>
  )
}
