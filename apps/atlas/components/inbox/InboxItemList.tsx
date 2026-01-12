'use client'

import { useMemo } from 'react'
import type { WorkItemDTO, WorkItemPriority } from '@/lib/contracts/work-items'
import { cn } from '@/lib/utils'

type InboxItemListProps = {
  items: WorkItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function getPriorityConfig(item: WorkItemDTO): { dot: string; bg: string; label?: string; isUrgent: boolean } {
  // Only 2 colors: red for urgent/overdue, slate for everything else
  if (item.isOverdue || item.priority === 'URGENT') {
    return {
      dot: 'bg-red-500',
      bg: 'bg-red-50 dark:bg-red-950/20',
      label: item.isOverdue
        ? (item.overdueDays ? `${item.overdueDays}d overdue` : 'Overdue')
        : 'Urgent',
      isUrgent: true,
    }
  }
  return {
    dot: 'bg-slate-400 dark:bg-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    isUrgent: false,
  }
}


function InboxItem({
  item,
  selected,
  onSelect,
  index
}: {
  item: WorkItemDTO
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const config = getPriorityConfig(item)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full h-[104px] text-left transition-all duration-200 ease-out',
        'rounded-xl border',
        selected
          ? 'border-slate-900 dark:border-slate-100 shadow-lg scale-[1.02]'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
        config.bg,
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {/* Priority indicator bar */}
      <div className={cn(
        'absolute left-0 top-3 bottom-3 w-1 rounded-full transition-all',
        config.dot,
        selected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
      )} />

      <div className="pl-4 pr-3 py-3 h-full flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
              {item.typeLabel}
            </span>
          </div>

          {config.label ? (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              {config.label}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className={cn(
          'mt-2 text-sm font-semibold leading-snug line-clamp-2',
          selected ? 'text-slate-900 dark:text-slate-50' : 'text-slate-700 dark:text-slate-200'
        )}>
          {item.title}
        </h3>

        {/* Action indicator - pushed to bottom */}
        <div className="mt-auto">
          {item.primaryAction ? (
            <div className="flex items-center gap-2">
              <span className={cn(
                'h-2 w-2 rounded-full',
                config.dot
              )} />
              <span className={cn(
                'text-xs font-medium',
                config.isUrgent ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
              )}>
                {item.primaryAction.label}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function InboxItemList({ items, selectedId, onSelect }: InboxItemListProps) {
  // Group items by urgency
  const groupedItems = useMemo(() => {
    const overdue = items.filter(i => i.isOverdue)
    const urgent = items.filter(i => !i.isOverdue && (i.priority === 'URGENT' || i.priority === 'HIGH'))
    const actionRequired = items.filter(i => !i.isOverdue && i.priority !== 'URGENT' && i.priority !== 'HIGH' && i.isActionRequired)
    const other = items.filter(i => !i.isOverdue && i.priority !== 'URGENT' && i.priority !== 'HIGH' && !i.isActionRequired)

    return { overdue, urgent, actionRequired, other }
  }, [items])

  if (!items.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8 py-16">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            All caught up
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            No pending items
          </p>
        </div>
      </div>
    )
  }

  const renderGroup = (title: string, groupItems: WorkItemDTO[], startIndex: number) => {
    if (!groupItems.length) return null

    return (
      <div className="space-y-2">
        <div className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm py-2 -mx-1 px-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            {title} <span className="text-slate-300 dark:text-slate-600">({groupItems.length})</span>
          </span>
        </div>
        {groupItems.map((item, idx) => (
          <InboxItem
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)}
            index={startIndex + idx}
          />
        ))}
      </div>
    )
  }

  let indexOffset = 0

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 space-y-4">
        {renderGroup('Needs Attention', groupedItems.overdue, indexOffset)}
        {(indexOffset += groupedItems.overdue.length, null)}

        {renderGroup('High Priority', groupedItems.urgent, indexOffset)}
        {(indexOffset += groupedItems.urgent.length, null)}

        {renderGroup('Action Required', groupedItems.actionRequired, indexOffset)}
        {(indexOffset += groupedItems.actionRequired.length, null)}

        {renderGroup('Other', groupedItems.other, indexOffset)}
      </div>
    </div>
  )
}
