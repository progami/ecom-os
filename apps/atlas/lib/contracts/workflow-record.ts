import type { ActionId } from './action-ids'

export type WorkflowTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type WorkflowStageStatus = 'completed' | 'current' | 'upcoming'

export type WorkflowActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type WorkflowActionConfirm = {
  title: string
  body: string
  confirmLabel: string
}

export type WorkflowRecordAction = {
  id: ActionId
  label: string
  variant: WorkflowActionVariant
  disabled: boolean
  disabledReason?: string
  confirm?: WorkflowActionConfirm
}

export type WorkflowSummaryRow = { label: string; value: string }

export type WorkflowTimelineAttachment = { name: string; downloadHref: string }

export type WorkflowTimelineEntry = {
  id: string
  at: string
  actor: { type: 'user' | 'system'; name: string; avatarUrl?: string | null }
  event: string
  note?: string
  transition?: { from: string; to: string }
  attachments?: WorkflowTimelineAttachment[]
}

export type WorkflowRecordDTO = {
  identity: {
    title: string
    recordId: string
    href: string
  }

  subject: {
    displayName: string
    employeeId?: string
    subtitle?: string
    avatarUrl?: string | null
    statusChip?: { label: string; tone: WorkflowTone }
  }

  workflow: {
    currentStageId: string
    currentStageLabel: string
    stages: Array<{ id: string; label: string; status: WorkflowStageStatus }>
    statusBadge?: { label: string; tone: WorkflowTone }
    sla?: { dueAt?: string; isOverdue: boolean; overdueLabel?: string; tone: 'none' | 'warning' | 'danger' }
    severity?: { label: string; tone: WorkflowTone }
  }

  actions: {
    primary: WorkflowRecordAction | null
    secondary: WorkflowRecordAction[]
    more: WorkflowRecordAction[]
  }

  summary: WorkflowSummaryRow[]

  timeline: WorkflowTimelineEntry[]

  access: {
    canView: boolean
    noAccessReason?: string
    sensitivity?: 'INTERNAL' | 'CONFIDENTIAL' | 'HIGHLY_CONFIDENTIAL'
  }
}

