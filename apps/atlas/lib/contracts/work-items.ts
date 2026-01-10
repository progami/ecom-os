import type { ActionId } from './action-ids'

export type WorkItemPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

export type WorkItemEntity =
  | { type: 'TASK'; id: string }
  | { type: 'POLICY'; id: string }
  | { type: 'LEAVE_REQUEST'; id: string }
  | { type: 'PERFORMANCE_REVIEW'; id: string }
  | { type: 'DISCIPLINARY_ACTION'; id: string }

export type WorkItemAction = {
  id: ActionId
  label: string
  disabled: boolean
  disabledReason?: string
}

export type WorkItemDTO = {
  id: string
  type: string
  typeLabel: string
  title: string
  description: string | null
  href: string
  entity: WorkItemEntity

  stageLabel: string
  createdAt: string
  dueAt: string | null
  isOverdue: boolean
  overdueDays: number | null
  priority: WorkItemPriority
  isActionRequired: boolean

  primaryAction: WorkItemAction | null
  secondaryActions: WorkItemAction[]
}

export type WorkItemsResponse = {
  items: WorkItemDTO[]
  meta: {
    totalCount: number
    actionRequiredCount: number
    overdueCount: number
  }
}

