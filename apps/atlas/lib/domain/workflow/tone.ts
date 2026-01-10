import type { WorkflowTone } from '@/lib/contracts/workflow-record'

export function toneForStatus(status: string): WorkflowTone {
  const s = status.toUpperCase()
  if (s.includes('APPROVED') || s === 'ACTIVE' || s === 'ACKNOWLEDGED' || s === 'COMPLETED') return 'success'
  if (s.includes('REJECT') || s.includes('DISMISS') || s.includes('CANCEL') || s.includes('DENY')) return 'danger'
  if (s.includes('PENDING') || s.includes('IN_PROGRESS') || s.includes('UNDER_REVIEW') || s.includes('IN_REVIEW')) return 'warning'
  return 'neutral'
}

