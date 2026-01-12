'use client'

import type { CompletedWorkItemDTO } from '@/lib/contracts/work-items'
import { cn } from '@/lib/utils'

type CompletedItemListProps = {
  items: CompletedWorkItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

function CompletedItem({
  item,
  selected,
  onSelect,
  index,
}: {
  item: CompletedWorkItemDTO
  selected: boolean
  onSelect: () => void
  index: number
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full text-left transition-all duration-200 ease-out',
        'rounded-xl border-2',
        selected
          ? 'border-slate-400 dark:border-slate-500 shadow-md'
          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700',
        'bg-slate-50/50 dark:bg-slate-800/30',
        'opacity-75 hover:opacity-100',
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
    >
      {/* Completed indicator bar */}
      <div className={cn(
        'absolute left-0 top-3 bottom-3 w-1 rounded-full transition-all',
        'bg-emerald-400',
        selected ? 'opacity-100' : 'opacity-50 group-hover:opacity-70'
      )} />

      <div className="pl-4 pr-3 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">
              {item.typeLabel}
            </span>
          </div>

          {/* Completed badge */}
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            {item.completedLabel}
          </span>
        </div>

        {/* Title */}
        <h3 className={cn(
          'mt-2 text-sm font-semibold leading-snug line-clamp-2',
          selected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'
        )}>
          {item.title}
        </h3>

        {/* Completion date */}
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {formatDate(item.completedAt)}
        </p>
      </div>
    </button>
  )
}

export function CompletedItemList({ items, selectedId, onSelect }: CompletedItemListProps) {
  if (!items.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8 py-16">
          <div className="relative mx-auto mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 tracking-tight">
            No completed items
          </h3>
          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto">
            Items you complete will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 space-y-2">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm py-2 -mx-1 px-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Completed <span className="text-slate-300 dark:text-slate-600">({items.length})</span>
          </span>
        </div>
        {items.map((item, idx) => (
          <CompletedItem
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)}
            index={idx}
          />
        ))}
      </div>
    </div>
  )
}
