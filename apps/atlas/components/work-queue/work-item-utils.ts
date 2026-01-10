import type { WorkItemDTO } from '@/lib/contracts/work-items'

export function formatWorkItemWhen(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getWorkItemDueLabel(item: WorkItemDTO): string {
  if (!item.dueAt) return 'No due date'
  if (item.isOverdue) {
    const days = item.overdueDays ?? 1
    return `Overdue by ${days}d`
  }
  return `Due ${formatWorkItemWhen(item.dueAt)}`
}

