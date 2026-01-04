'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ActionButton } from '@/components/ui/ActionButton'
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
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Select an item</p>
        <p className="text-sm text-muted-foreground mt-1">Pick a work item from the list to see details and next actions.</p>
      </Card>
    )
  }

  const dueLabel = getWorkItemDueLabel(item)

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.isOverdue ? 'error' : item.isActionRequired ? 'warning' : 'default'}>
              {item.typeLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">{item.stageLabel}</span>
          </div>

          <h2 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h2>
          {item.description ? <p className="mt-2 text-sm text-foreground whitespace-pre-line">{item.description}</p> : null}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Due</p>
              <p className={item.isOverdue ? 'text-sm font-medium text-danger-700' : 'text-sm font-medium text-foreground'}>
                {dueLabel}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created</p>
              <p className="text-sm font-medium text-foreground">{formatWorkItemWhen(item.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <ActionButton label="Open record" href={item.href} variant="secondary" />

          {item.primaryAction ? (
            <ActionButton
              label={item.primaryAction.label}
              disabled={item.primaryAction.disabled || acting === item.primaryAction.id}
              disabledReason={item.primaryAction.disabledReason}
              loading={acting === item.primaryAction.id}
              onClick={async () => {
                setActing(item.primaryAction!.id)
                try {
                  await onAction(item.primaryAction!.id, item)
                } finally {
                  setActing(null)
                }
              }}
            />
          ) : null}

          {item.secondaryActions.map((action) => (
            <ActionButton
              key={action.id}
              label={action.label}
              variant="secondary"
              disabled={action.disabled || acting === action.id}
              disabledReason={action.disabledReason}
              loading={acting === action.id}
              onClick={async () => {
                setActing(action.id)
                try {
                  await onAction(action.id, item)
                } finally {
                  setActing(null)
                }
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}

