/**
 * Application-wide type definitions
 */

// Example user type
export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  updatedAt: Date
}

// Example API response types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
  timestamp: string
}

export interface ApiError {
  message: string
  code: string
  details?: any
}

// Example pagination types
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Example form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'date'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  validation?: any
}