'use client'

import { useMemo } from 'react'
import type { WorkItemDTO, WorkItemPriority } from '@/lib/contracts/work-items'
import { cn } from '@/lib/utils'

type InboxItemListProps = {
  items: WorkItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function getPriorityConfig(item: WorkItemDTO): { ring: string; dot: string; bg: string; label?: string } {
  if (item.isOverdue) {
    return {
      ring: 'ring-red-500/30',
      dot: 'bg-red-500',
      bg: 'bg-red-50 dark:bg-red-950/20',
      label: item.overdueDays ? `${item.overdueDays}d overdue` : 'Overdue',
    }
  }
  if (item.priority === 'URGENT') {
    return {
      ring: 'ring-amber-500/30',
      dot: 'bg-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      label: 'Urgent',
    }
  }
  if (item.priority === 'HIGH') {
    return {
      ring: 'ring-orange-400/30',
      dot: 'bg-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
    }
  }
  if (item.isActionRequired) {
    return {
      ring: 'ring-cyan-500/30',
      dot: 'bg-cyan-500',
      bg: 'bg-cyan-50 dark:bg-cyan-950/20',
    }
  }
  return {
    ring: 'ring-slate-300/50 dark:ring-slate-600/50',
    dot: 'bg-slate-400',
    bg: 'bg-slate-50/50 dark:bg-slate-800/30',
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
        'group relative w-full h-20 text-left transition-all duration-200 ease-out',
        'rounded-xl border-2',
        selected
          ? 'border-slate-900 dark:border-slate-100 shadow-lg scale-[1.02]'
          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700',
        config.bg,
        'ring-2',
        config.ring,
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
            {item.typeLabel}
          </span>
          {config.label ? (
            <span className={cn(
              'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
              item.isOverdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            )}>
              {config.label}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className={cn(
          'mt-1.5 text-sm font-semibold leading-snug line-clamp-2',
          selected ? 'text-slate-900 dark:text-slate-50' : 'text-slate-700 dark:text-slate-200'
        )}>
          {item.title}
        </h3>
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
          {/* Celebratory icon */}
          <div className="relative mx-auto mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* Sparkles */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '150ms' }} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Inbox Zero
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
            You've cleared everything. Take a moment to celebrate.
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
