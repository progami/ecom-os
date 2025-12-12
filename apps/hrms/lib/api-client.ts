// Centralized, typed API client for HRMS
// Avoid direct fetch calls in UI components

export type Employee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  department?: string
  dept?: { id: string; name: string } | null
  position: string
  employmentType: string
  joinDate: string
  status: string
  region: string
  managerId?: string | null
  roles?: { id: string; name: string }[]
}

export type Resource = {
  id: string
  name: string
  category: string
  subcategory?: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  rating?: number | null
}

export type LeavePolicy = {
  id: string
  region: string
  leaveType: string
  title: string
  description?: string | null
  entitledDays: number
  isPaid: boolean
  carryoverMax?: number | null
  minNoticeDays: number
  maxConsecutive?: number | null
  rules?: Record<string, unknown> | null
  effectiveFrom?: string | null
  status: string
  createdAt?: string
  updatedAt?: string
}

export type LeaveBalance = {
  id: string
  employeeId: string
  leaveType: string
  year: number
  entitled: number
  used: number
  carryover: number
  adjustment: number
  remaining: number
  employee?: {
    id: string
    firstName: string
    lastName: string
    email: string
    region: string
  }
}

export type LeaveRequest = {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  workingDays: number
  isHalfDay: boolean
  halfDayType?: string | null
  reason?: string | null
  status: string
  approverId?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  comments?: string | null
  createdAt?: string
  updatedAt?: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    email: string
    department: string
    region: string
  }
  approver?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

function getApiBase(): string {
  // Allow override via env for future deployments; default to /hrms
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE
  }
  // Default to /hrms basePath matching next.config.js
  return '/hrms'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase()
  const url = `${base}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Accept': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  } as RequestInit)

  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  let body: any = null
  try {
    body = isJson ? await res.json() : await res.text()
  } catch {
    body = null
  }
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `${res.status} ${res.statusText}`
    throw new ApiError(msg, res.status, body)
  }
  return body as T
}

// Employees
export const EmployeesApi = {
  list(params: {
    q?: string
    take?: number
    skip?: number
    department?: string
    status?: string
    employmentType?: string
  } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.department) qp.set('department', params.department)
    if (params.status) qp.set('status', params.status)
    if (params.employmentType) qp.set('employmentType', params.employmentType)
    const qs = qp.toString()
    return request<{ items: Employee[]; total: number }>(`/api/employees${qs ? `?${qs}` : ''}`)
  },
  create(payload: Partial<Employee> & {
    firstName: string
    lastName: string
    email: string
    department?: string
    position: string
    employmentType: string
    joinDate: string
    status?: string
    region?: string
    managerId?: string | null
  }) {
    return request<Employee>(`/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  get(id: string) {
    return request<Employee>(`/api/employees/${encodeURIComponent(id)}`)
  },
  update(id: string, payload: Partial<Employee>) {
    return request<Employee>(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Resources
export const ResourcesApi = {
  list(params: { q?: string; take?: number; skip?: number; category?: string; subcategories?: string[] } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.category) qp.set('category', params.category)
    if (params.subcategories?.length) qp.set('subcategories', params.subcategories.join(','))
    const qs = qp.toString()
    return request<{ items: Resource[]; total: number }>(`/api/resources${qs ? `?${qs}` : ''}`)
  },
  create(payload: Partial<Resource> & { name: string; category: string }) {
    return request<Resource>(`/api/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
}

// Leave Policies
export const LeavePoliciesApi = {
  list(params: { q?: string; take?: number; skip?: number; region?: string; leaveType?: string; status?: string } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.region) qp.set('region', params.region)
    if (params.leaveType) qp.set('leaveType', params.leaveType)
    if (params.status) qp.set('status', params.status)
    const qs = qp.toString()
    return request<{ items: LeavePolicy[]; total: number }>(`/api/leave-policies${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<LeavePolicy>(`/api/leave-policies/${encodeURIComponent(id)}`)
  },
  create(payload: {
    region: string
    leaveType: string
    title: string
    description?: string
    entitledDays: number
    isPaid?: boolean
    carryoverMax?: number
    minNoticeDays?: number
    maxConsecutive?: number
    status?: string
  }) {
    return request<LeavePolicy>(`/api/leave-policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<LeavePolicy>) {
    return request<LeavePolicy>(`/api/leave-policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/leave-policies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Leave Requests
export const LeaveRequestsApi = {
  list(params: {
    employeeId?: string
    approverId?: string
    status?: string
    leaveType?: string
    pendingForManager?: string
    take?: number
    skip?: number
  } = {}) {
    const qp = new URLSearchParams()
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.approverId) qp.set('approverId', params.approverId)
    if (params.status) qp.set('status', params.status)
    if (params.leaveType) qp.set('leaveType', params.leaveType)
    if (params.pendingForManager) qp.set('pendingForManager', params.pendingForManager)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    const qs = qp.toString()
    return request<{ items: LeaveRequest[]; total: number }>(`/api/leave-requests${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}`)
  },
  create(payload: {
    employeeId: string
    leaveType: string
    startDate: string
    endDate: string
    isHalfDay?: boolean
    halfDayType?: string
    reason?: string
  }) {
    return request<LeaveRequest>(`/api/leave-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  approve(id: string, comments?: string) {
    return request<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED', comments }),
    })
  },
  reject(id: string, comments?: string) {
    return request<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', comments }),
    })
  },
  cancel(id: string) {
    return request<LeaveRequest>(`/api/leave-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/leave-requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Leave Balances
export const LeaveBalancesApi = {
  list(params: { employeeId?: string; year?: number; leaveType?: string; take?: number; skip?: number } = {}) {
    const qp = new URLSearchParams()
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.year != null) qp.set('year', String(params.year))
    if (params.leaveType) qp.set('leaveType', params.leaveType)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    const qs = qp.toString()
    return request<{ items: LeaveBalance[]; total: number }>(`/api/leave-balances${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<LeaveBalance>(`/api/leave-balances/${encodeURIComponent(id)}`)
  },
  adjust(id: string, adjustment: number, reason?: string) {
    return request<LeaveBalance>(`/api/leave-balances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustment, reason }),
    })
  },
}

// Dashboard
export const DashboardApi = {
  get() {
    return request<{ stats: any[]; recentActivity: any[]; upcomingEvents: any[] }>(`/api/dashboard`)
  },
}

// Calendar
export type CalendarEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  htmlLink?: string
}

export const CalendarApi = {
  list() {
    return request<{ items: CalendarEvent[] }>(`/api/calendar/events`)
  },
  create(input: { summary: string; description?: string; location?: string; start: { dateTime: string; timeZone?: string }; end: { dateTime: string; timeZone?: string } }) {
    return request<CalendarEvent>(`/api/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  }
}
