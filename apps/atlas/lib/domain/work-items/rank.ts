import type { WorkItemDTO, WorkItemPriority } from '@/lib/contracts/work-items'

export function rankWorkItems(items: WorkItemDTO[]): WorkItemDTO[] {
  const priorityOrder: Record<WorkItemPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }

  return [...items].sort((a, b) => {
    // 1) Action required before FYI
    if (a.isActionRequired !== b.isActionRequired) return a.isActionRequired ? -1 : 1

    // 2) Overdue before not overdue, more overdue first
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    if (a.isOverdue && b.isOverdue) return (b.overdueDays ?? 0) - (a.overdueDays ?? 0)

    // 3) Priority
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority]

    // 4) Due date soonest first (items without dueAt are last)
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (a.dueAt) return -1
    if (b.dueAt) return 1

    // 5) Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

