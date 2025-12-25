import type { EmployeeRegion, Region } from '@ecom-os/prisma-hrms'
import { prisma } from '@/lib/prisma'

export type ComplianceDepartmentSummary = {
  department: string
  applicableCount: number
  acknowledgedCount: number
  pendingCount: number
  compliancePct: number
}

export type CompliancePolicySummary = {
  policyId: string
  title: string
  category: string
  region: string
  version: string
  effectiveDate: string | null
  applicableCount: number
  acknowledgedCount: number
  pendingCount: number
  compliancePct: number
  byDepartment: ComplianceDepartmentSummary[]
}

export type ComplianceDashboardSnapshot = {
  generatedAt: string
  policies: CompliancePolicySummary[]
}

export type PolicyAckComplianceExportRow = {
  policyTitle: string
  policyCategory: string
  policyRegion: string
  policyVersion: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  employeeDepartment: string
  employeeRegion: string
  acknowledgedAt: string
  status: string
}

function normalizeDepartment(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed || 'Unassigned'
}

function mapPolicyRegionToEmployeeRegion(region: Region): EmployeeRegion | null {
  if (region === 'PAKISTAN') return 'PAKISTAN'
  if (region === 'KANSAS_US') return 'KANSAS_USA'
  return null
}

export function isEmployeeInPolicyRegion(policyRegion: Region, employeeRegion: EmployeeRegion): boolean {
  if (policyRegion === 'ALL') return true
  const mapped = mapPolicyRegionToEmployeeRegion(policyRegion)
  if (!mapped) return false
  return mapped === employeeRegion
}

async function loadComplianceContext(): Promise<{
  policies: Array<{
    id: string
    title: string
    category: string
    region: Region
    version: string
    effectiveDate: Date | null
  }>
  employees: Array<{
    id: string
    employeeId: string
    firstName: string
    lastName: string
    email: string
    department: string
    region: EmployeeRegion
  }>
  acknowledgements: Array<{
    policyId: string
    policyVersion: string
    employeeId: string
    acknowledgedAt: Date
  }>
}> {
  const [policies, employees] = await Promise.all([
    prisma.policy.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ category: 'asc' }, { region: 'asc' }, { effectiveDate: 'desc' }],
      select: {
        id: true,
        title: true,
        category: true,
        region: true,
        version: true,
        effectiveDate: true,
      },
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        region: true,
      },
      take: 20_000,
    }),
  ])

  if (policies.length === 0) {
    return { policies: [], employees, acknowledgements: [] }
  }

  const acknowledgements = await prisma.policyAcknowledgement.findMany({
    where: { policyId: { in: policies.map((p) => p.id) } },
    select: {
      policyId: true,
      policyVersion: true,
      employeeId: true,
      acknowledgedAt: true,
    },
  })

  return { policies, employees, acknowledgements }
}

export async function getComplianceDashboardSnapshot(): Promise<ComplianceDashboardSnapshot> {
  const { policies, employees, acknowledgements } = await loadComplianceContext()

  const ackMap = new Map<string, Set<string>>()
  for (const ack of acknowledgements) {
    const k = `${ack.policyId}:${ack.policyVersion}`
    const set = ackMap.get(k) ?? new Set<string>()
    set.add(ack.employeeId)
    ackMap.set(k, set)
  }

  const summaries: CompliancePolicySummary[] = policies.map((policy) => {
    const applicable = employees.filter((e) => isEmployeeInPolicyRegion(policy.region, e.region))
    const ackKey = `${policy.id}:${policy.version}`
    const acked = ackMap.get(ackKey) ?? new Set<string>()

    const byDept = new Map<string, { applicable: number; acknowledged: number }>()
    for (const employee of applicable) {
      const department = normalizeDepartment(employee.department)
      const row = byDept.get(department) ?? { applicable: 0, acknowledged: 0 }
      row.applicable += 1
      if (acked.has(employee.id)) row.acknowledged += 1
      byDept.set(department, row)
    }

    const byDepartment: ComplianceDepartmentSummary[] = Array.from(byDept.entries())
      .map(([department, row]) => {
        const pendingCount = row.applicable - row.acknowledged
        const compliancePct = row.applicable === 0 ? 100 : Math.round((row.acknowledged / row.applicable) * 1000) / 10
        return {
          department,
          applicableCount: row.applicable,
          acknowledgedCount: row.acknowledged,
          pendingCount,
          compliancePct,
        }
      })
      .sort((a, b) => b.pendingCount - a.pendingCount || a.department.localeCompare(b.department))

    const applicableCount = applicable.length
    const acknowledgedCount = applicable.reduce((acc, e) => acc + (acked.has(e.id) ? 1 : 0), 0)
    const pendingCount = applicableCount - acknowledgedCount
    const compliancePct = applicableCount === 0 ? 100 : Math.round((acknowledgedCount / applicableCount) * 1000) / 10

    return {
      policyId: policy.id,
      title: policy.title,
      category: policy.category,
      region: policy.region,
      version: policy.version,
      effectiveDate: policy.effectiveDate ? policy.effectiveDate.toISOString() : null,
      applicableCount,
      acknowledgedCount,
      pendingCount,
      compliancePct,
      byDepartment,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    policies: summaries.sort((a, b) => b.pendingCount - a.pendingCount || a.title.localeCompare(b.title)),
  }
}

export async function getPolicyAckComplianceExportRows(options?: {
  status?: 'PENDING' | 'ACKNOWLEDGED' | 'ALL'
  policyId?: string
}): Promise<PolicyAckComplianceExportRow[]> {
  const status = options?.status ?? 'PENDING'
  const { policies, employees, acknowledgements } = await loadComplianceContext()

  const filteredPolicies = options?.policyId
    ? policies.filter((p) => p.id === options.policyId)
    : policies

  const ackByKeyEmployee = new Map<string, Date>()
  for (const ack of acknowledgements) {
    const k = `${ack.policyId}:${ack.policyVersion}:${ack.employeeId}`
    const existing = ackByKeyEmployee.get(k)
    if (!existing || ack.acknowledgedAt > existing) {
      ackByKeyEmployee.set(k, ack.acknowledgedAt)
    }
  }

  const rows: PolicyAckComplianceExportRow[] = []

  for (const policy of filteredPolicies) {
    const applicableEmployees = employees.filter((e) => isEmployeeInPolicyRegion(policy.region, e.region))
    for (const e of applicableEmployees) {
      const ackKey = `${policy.id}:${policy.version}:${e.id}`
      const ackAt = ackByKeyEmployee.get(ackKey) ?? null
      const isAck = Boolean(ackAt)
      const rowStatus = isAck ? 'ACKNOWLEDGED' : 'PENDING'

      if (status !== 'ALL' && status !== rowStatus) continue

      rows.push({
        policyTitle: policy.title,
        policyCategory: policy.category,
        policyRegion: policy.region,
        policyVersion: policy.version,
        employeeId: e.employeeId,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        employeeEmail: e.email,
        employeeDepartment: normalizeDepartment(e.department),
        employeeRegion: e.region,
        acknowledgedAt: ackAt ? ackAt.toISOString() : '',
        status: rowStatus,
      })
    }
  }

  rows.sort((a, b) => {
    if (a.policyTitle !== b.policyTitle) return a.policyTitle.localeCompare(b.policyTitle)
    if (a.status !== b.status) return a.status.localeCompare(b.status)
    if (a.employeeDepartment !== b.employeeDepartment) return a.employeeDepartment.localeCompare(b.employeeDepartment)
    return a.employeeName.localeCompare(b.employeeName)
  })

  return rows
}

