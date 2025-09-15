// Simple in-memory store for local development only.
// This is a placeholder for the real DB (see docs/HRMS_BUSINESS_LOGIC.md).

type Employee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  department: string
  position: string
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
  joinDate: string // ISO date
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED'
}

type Resource = {
  id: string
  name: string
  category: 'ACCOUNTING' | 'LEGAL' | 'DESIGN' | 'MARKETING' | 'IT' | 'HR' | 'OTHER'
  subcategory?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  description?: string | null
  rating?: number | null
}

type Policy = {
  id: string
  title: string
  category: 'LEAVE' | 'PERFORMANCE' | 'CONDUCT' | 'SECURITY' | 'COMPENSATION' | 'OTHER'
  summary?: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
}

type Store = {
  employees: Employee[]
  resources: Resource[]
  policies: Policy[]
}

const g = globalThis as any
if (!g.__HRMS_STORE__) {
  const now = new Date().toISOString().slice(0, 10)
  g.__HRMS_STORE__ = {
    employees: [
      {
        id: 'emp_1',
        employeeId: 'EMP1001',
        firstName: 'Umair',
        lastName: 'Afzal',
        email: 'umair.afzal@example.com',
        phone: '+1 555 0100',
        department: 'operations',
        position: 'Operations Manager',
        employmentType: 'FULL_TIME',
        joinDate: now,
        status: 'ACTIVE',
      },
    ],
    resources: [
      { id: 'res_1', name: 'EcomCPA', category: 'ACCOUNTING', website: 'https://ecomcpa.com/', email: null, phone: null, description: null, subcategory: null, rating: 4.7 },
    ],
    policies: [
      { id: 'pol_1', title: 'Leave Policy 2025', category: 'LEAVE', summary: 'Annual leave rules', status: 'ACTIVE' },
    ],
  } as Store
}

export const store: Store = g.__HRMS_STORE__

export function cuid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

