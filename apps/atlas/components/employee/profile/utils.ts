export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—'
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null

  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (!endDate || startDate.getTime() === endDate.getTime()) {
    return `${startStr}, ${startDate.getFullYear()}`
  }

  const sameMonth =
    startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}–${endDate.getDate()}, ${startDate.getFullYear()}`
  }
  if (sameYear) {
    return `${startStr} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${startDate.getFullYear()}`
  }
  return `${startStr}, ${startDate.getFullYear()} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endDate.getFullYear()}`
}

export function getLeaveStatusConfig(status: string): {
  label: string
  dotColor: string
  ringColor: string
  badgeClass: string
} {
  switch (status) {
    case 'APPROVED':
      return {
        label: 'Approved',
        dotColor: 'bg-success-500',
        ringColor: 'ring-success-100',
        badgeClass: 'bg-success-100 text-success-700',
      }
    case 'REJECTED':
      return {
        label: 'Rejected',
        dotColor: 'bg-destructive',
        ringColor: 'ring-red-100',
        badgeClass: 'bg-red-100 text-red-700',
      }
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        dotColor: 'bg-muted-foreground',
        ringColor: 'ring-muted',
        badgeClass: 'bg-muted text-muted-foreground',
      }
    case 'PENDING':
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
    case 'PENDING_SUPER_ADMIN':
      return {
        label: status === 'PENDING' ? 'Pending' : status.replace('PENDING_', '').replace('_', ' '),
        dotColor: 'bg-warning-500',
        ringColor: 'ring-warning-100',
        badgeClass: 'bg-warning-100 text-warning-700',
      }
    default:
      return {
        label: status.replace(/_/g, ' ').toLowerCase(),
        dotColor: 'bg-muted-foreground',
        ringColor: 'ring-muted',
        badgeClass: 'bg-muted text-muted-foreground',
      }
  }
}

export function getLeaveTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PTO: 'PTO',
    PARENTAL: 'Parental Leave',
    MATERNITY: 'Maternity',
    PATERNITY: 'Paternity',
    BEREAVEMENT: 'Bereavement',
    BEREAVEMENT_IMMEDIATE: 'Bereavement',
    BEREAVEMENT_EXTENDED: 'Extended Bereavement',
    JURY_DUTY: 'Jury Duty',
    UNPAID: 'Unpaid Leave',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

export function formatBytes(size: number | null | undefined): string {
  if (size == null || !Number.isFinite(size)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let s = size
  let idx = 0
  while (s >= 1024 && idx < units.length - 1) {
    s /= 1024
    idx += 1
  }
  return `${s.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

export function getReviewStatusConfig(status: string): { label: string; bgClass: string; textClass: string } {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'ACKNOWLEDGED') {
    return { label: 'Completed', bgClass: 'bg-success-100', textClass: 'text-success-700' }
  }
  if (s === 'PENDING_HR_REVIEW' || s === 'PENDING_ACKNOWLEDGMENT') {
    return { label: 'Pending', bgClass: 'bg-warning-100', textClass: 'text-warning-700' }
  }
  if (s === 'IN_PROGRESS' || s === 'DRAFT' || s === 'NOT_STARTED') {
    return { label: 'In Progress', bgClass: 'bg-accent/10', textClass: 'text-accent' }
  }
  return { label: status.replace(/_/g, ' '), bgClass: 'bg-muted', textClass: 'text-muted-foreground' }
}

