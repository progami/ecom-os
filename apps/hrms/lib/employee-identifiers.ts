import { randomUUID } from 'crypto'

export function formatEmployeeId(employeeNumber: number): string {
  if (!Number.isFinite(employeeNumber) || employeeNumber < 1) {
    throw new Error(`Invalid employeeNumber: ${employeeNumber}`)
  }

  return `EMP-${String(employeeNumber).padStart(4, '0')}`
}

export function createTemporaryEmployeeId(): string {
  return `TMP-${randomUUID()}`
}
