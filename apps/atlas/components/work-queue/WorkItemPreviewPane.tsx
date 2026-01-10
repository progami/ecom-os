'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkItemDTO } from '@/lib/contracts/work-items'
import { formatWorkItemWhen, getWorkItemDueLabel } from './work-item-utils'

type WorkItemPreviewPaneProps = {
  item: WorkItemDTO | null
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
}

export function WorkItemPreviewPane({ item, onAction }: WorkItemPreviewPaneProps) {
  const [acting, setActing] = useState<ActionId | null>(null)

  if (!item) {
    return (
      <div className="h-full rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Select a work item</p>
        </div>
      </div>
    )
  }

  const dueLabel = getWorkItemDueLabel(item)

  return (
    <div className="h-full rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Header with type indicator */}
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={item.isOverdue ? 'error' : item.isActionRequired ? 'warning' : 'default'}>
              {item.typeLabel}
            </Badge>
            <span className="text-sm text-muted-foreground">{item.stageLabel}</span>
          </div>
          {item.isOverdue ? (
            <span className="text-xs font-semibold text-danger-600 uppercase tracking-wide">Overdue</span>
          ) : item.isActionRequired ? (
            <span className="text-xs font-semibold text-brand-teal-600 uppercase tracking-wide">Action Required</span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-foreground leading-tight">{item.title}</h2>
        {item.description ? (
          <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{item.description}</p>
        ) : null}

        {/* Metadata grid */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</p>
            <p className={`mt-1 text-sm font-semibold ${item.isOverdue ? 'text-danger-600' : 'text-foreground'}`}>
              {dueLabel}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatWorkItemWhen(item.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="px-6 py-4 border-t border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" href={item.href} size="sm">
            Open record
          </Button>

          <div className="flex items-center gap-2">
            {item.secondaryActions.map((action) => (
              <Button
                key={action.id}
                variant="secondary"
                size="sm"
                disabled={action.disabled || acting === action.id}
                loading={acting === action.id}
                onClick={async () => {
                  setActing(action.id)
                  try {
                    await onAction(action.id, item)
                  } finally {
                    setActing(null)
                  }
                }}
              >
                {action.label}
              </Button>
            ))}

            {item.primaryAction ? (
              <Button
                size="sm"
                disabled={item.primaryAction.disabled || acting === item.primaryAction.id}
                loading={acting === item.primaryAction.id}
                onClick={async () => {
                  setActing(item.primaryAction!.id)
                  try {
                    await onAction(item.primaryAction!.id, item)
                  } finally {
                    setActing(null)
                  }
                }}
              >
                {item.primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
