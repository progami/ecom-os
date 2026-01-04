'use client'

import { Badge } from '@/components/ui/Badge'
import type { WorkItemDTO } from '@/lib/contracts/work-items'
import { getWorkItemDueLabel } from './work-item-utils'

type WorkItemCardProps = {
  item: WorkItemDTO
  selected?: boolean
  onSelect?: () => void
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function getPriorityBadge(priority: WorkItemDTO['priority']): { label: string; variant: 'default' | 'info' | 'warning' | 'error' } {
  switch (priority) {
    case 'URGENT':
      return { label: 'Urgent', variant: 'error' }
    case 'HIGH':
      return { label: 'High', variant: 'warning' }
    case 'NORMAL':
      return { label: 'Normal', variant: 'info' }
    case 'LOW':
    default:
      return { label: 'Low', variant: 'default' }
  }
}

export function WorkItemCard({ item, selected = false, onSelect }: WorkItemCardProps) {
  const dueLabel = getWorkItemDueLabel(item)
  const priorityBadge = getPriorityBadge(item.priority)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border shadow-sm bg-card px-4 py-4 transition-colors',
        selected ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-input'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground">{item.typeLabel}</p>
            <span className="text-xs text-muted-foreground">•</span>
            <p className="text-xs text-muted-foreground">{item.stageLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={priorityBadge.variant}>{priorityBadge.label}</Badge>
          {item.isOverdue ? <Badge variant="error">Overdue</Badge> : null}
        </div>
      </div>

      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
        {item.description ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={cn('text-xs', item.isOverdue ? 'text-danger-700 font-medium' : 'text-muted-foreground')}>{dueLabel}</p>
        {item.isActionRequired ? (
          <span className="text-xs font-semibold text-accent">Action required</span>
        ) : (
          <span className="text-xs text-muted-foreground">FYI</span>
        )}
      </div>
    </button>
  )
}

