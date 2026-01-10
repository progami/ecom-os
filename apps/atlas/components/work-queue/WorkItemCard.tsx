'use client'

import type { WorkItemDTO } from '@/lib/contracts/work-items'

type WorkItemCardProps = {
  item: WorkItemDTO
  selected?: boolean
  onSelect?: () => void
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function WorkItemCard({ item, selected = false, onSelect }: WorkItemCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border bg-card px-3 py-3 transition-all duration-150',
        selected
          ? 'border-brand-teal-500 bg-brand-teal-50/50 shadow-sm'
          : 'border-border hover:border-brand-gray-300 hover:bg-muted/30'
      )}
    >
      {/* Top row: type + priority indicator */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(
            'shrink-0 w-1.5 h-1.5 rounded-full',
            item.isOverdue ? 'bg-danger-500' : item.isActionRequired ? 'bg-brand-teal-500' : 'bg-brand-gray-400'
          )} />
          <span className="text-xs font-medium text-muted-foreground truncate">{item.typeLabel}</span>
          <span className="text-xs text-muted-foreground/60">·</span>
          <span className="text-xs text-muted-foreground/80 truncate">{item.stageLabel}</span>
        </div>
        {item.isOverdue ? (
          <span className="shrink-0 text-2xs font-semibold text-danger-600 uppercase">Overdue</span>
        ) : item.priority === 'URGENT' || item.priority === 'HIGH' ? (
          <span className="shrink-0 text-2xs font-medium text-warning-600 uppercase">{item.priority === 'URGENT' ? 'Urgent' : 'High'}</span>
        ) : null}
      </div>

      {/* Title */}
      <p className="mt-1.5 text-sm font-medium text-foreground line-clamp-1">{item.title}</p>

      {/* Description - only show first line */}
      {item.description ? (
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
      ) : null}
    </button>
  )
}

