export function parseDateOnlyToUtcNoon(dateString: string): Date {
  const date = new Date(`${dateString}T12:00:00.000Z`)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }
  return date
}

export function calculateBusinessDaysUtc(start: Date, end: Date): number {
  if (start > end) return 0

  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return count
}

export function calculateBusinessDaysUtcFromDateOnly(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  try {
    const start = parseDateOnlyToUtcNoon(startDate)
    const end = parseDateOnlyToUtcNoon(endDate)
    return calculateBusinessDaysUtc(start, end)
  } catch {
    return 0
  }
}

