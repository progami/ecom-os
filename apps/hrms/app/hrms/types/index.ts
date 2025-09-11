// Re-export Prisma types (trimmed to core models)
export type {
  Employee,
  Resource,
  Policy,
  EmploymentType,
  EmployeeStatus,
  ResourceCategory,
  PolicyCategory,
  PolicyStatus,
} from '@prisma/client'

// Additional types for forms and UI
export interface EmployeeFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  department: string
  position: string
  employmentType: string
  joinDate: Date
  salary?: number
  dateOfBirth?: Date
  address?: string
  city?: string
  country?: string
  emergencyContact?: string
  emergencyPhone?: string
}

export interface ResourceFormData {
  name: string
  description?: string
  category: string
  subcategory?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  country?: string
  tags?: string[]
  rating?: number
  notes?: string
}

export interface FilterOptions {
  search?: string
  department?: string
  status?: string
  category?: string
  dateFrom?: Date
  dateTo?: Date
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DashboardStats {
  totalEmployees: number
  totalResources: number
  totalPolicies: number
  monthlyPayroll: number
  averageWorkHours: number
}

export interface PolicyFormData {
  title: string
  category: string
  summary?: string
  content?: string
  file?: File
  version?: string
  effectiveDate?: Date
  status?: string
}
