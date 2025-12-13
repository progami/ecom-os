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

export type Policy = {
  id: string
  title: string
  category: string
  region: string
  summary?: string | null
  content?: string | null
  fileUrl?: string | null
  version: string
  effectiveDate?: string | null
  status: string
  createdAt?: string
  updatedAt?: string
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

// Policies
export const PoliciesApi = {
  list(params: { q?: string; take?: number; skip?: number; category?: string; region?: string; status?: string } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.category) qp.set('category', params.category)
    if (params.region) qp.set('region', params.region)
    if (params.status) qp.set('status', params.status)
    const qs = qp.toString()
    return request<{ items: Policy[]; total: number }>(`/api/policies${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<Policy>(`/api/policies/${encodeURIComponent(id)}`)
  },
  create(payload: Partial<Policy> & { title: string; category: string; region: string; status?: string }) {
    return request<Policy>(`/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<Policy> & { bumpVersion?: 'major' | 'minor' }) {
    return request<Policy>(`/api/policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/policies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Dashboard
export type DashboardUser = {
  id: string
  firstName: string
  lastName: string
  department: string
  position: string
  avatar: string | null
}

export type DashboardDirectReport = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  avatar: string | null
}

export type DashboardPendingReview = {
  id: string
  reviewType: string
  reviewPeriod: string
  reviewDate: string
  status: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeId: string
  }
}

export type DashboardStat = {
  label: string
  value: number
}

export type DashboardCurrentEmployee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  department?: string | null
  position: string
  avatar?: string | null
  status: string
  employmentType: string
  joinDate?: string | null
  reportsToId?: string | null
  reportsTo?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

export type DashboardPendingLeaveRequest = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  status: string
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    avatar?: string | null
  }
}

export type DashboardUpcomingLeave = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  employee: {
    id: string
    firstName: string
    lastName: string
    avatar?: string | null
  }
}

export type LeaveBalance = {
  leaveType: string
  year?: number
  allocated: number
  used: number
  pending: number
  available: number
}

export type DashboardData = {
  user: DashboardUser | null
  isManager: boolean
  currentEmployee: DashboardCurrentEmployee | null
  directReports: DashboardDirectReport[]
  notifications: Notification[]
  unreadNotificationCount: number
  pendingReviews: DashboardPendingReview[]
  pendingLeaveRequests: DashboardPendingLeaveRequest[]
  myLeaveBalance: LeaveBalance[]
  upcomingLeaves: DashboardUpcomingLeave[]
  stats: DashboardStat[]
}

export const DashboardApi = {
  get() {
    return request<DashboardData>(`/api/dashboard`)
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

// Performance Reviews
export type PerformanceReview = {
  id: string
  employeeId: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    department?: string
    position?: string
    email?: string
  }
  reviewType: string
  reviewPeriod: string
  reviewDate: string
  reviewerName: string
  overallRating: number
  qualityOfWork?: number | null
  productivity?: number | null
  communication?: number | null
  teamwork?: number | null
  initiative?: number | null
  attendance?: number | null
  strengths?: string | null
  areasToImprove?: string | null
  goals?: string | null
  comments?: string | null
  status: string
  createdAt?: string
  updatedAt?: string
}

export const PerformanceReviewsApi = {
  list(params: {
    q?: string
    take?: number
    skip?: number
    employeeId?: string
    reviewType?: string
    status?: string
  } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.reviewType) qp.set('reviewType', params.reviewType)
    if (params.status) qp.set('status', params.status)
    const qs = qp.toString()
    return request<{ items: PerformanceReview[]; total: number }>(`/api/performance-reviews${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<PerformanceReview>(`/api/performance-reviews/${encodeURIComponent(id)}`)
  },
  create(payload: Omit<PerformanceReview, 'id' | 'employee' | 'createdAt' | 'updatedAt'>) {
    return request<PerformanceReview>(`/api/performance-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<Omit<PerformanceReview, 'id' | 'employeeId' | 'employee' | 'createdAt' | 'updatedAt'>>) {
    return request<PerformanceReview>(`/api/performance-reviews/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/performance-reviews/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Disciplinary Actions
export type DisciplinaryAction = {
  id: string
  employeeId: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    department?: string
    position?: string
    email?: string
  }
  violationType: string
  violationReason: string
  severity: string
  incidentDate: string
  reportedDate: string
  reportedBy: string
  description: string
  witnesses?: string | null
  evidence?: string | null
  actionTaken: string
  actionDate?: string | null
  actionDetails?: string | null
  followUpDate?: string | null
  followUpNotes?: string | null
  status: string
  resolution?: string | null
  createdAt?: string
  updatedAt?: string
}

export const DisciplinaryActionsApi = {
  list(params: {
    q?: string
    take?: number
    skip?: number
    employeeId?: string
    violationType?: string
    severity?: string
    status?: string
  } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.violationType) qp.set('violationType', params.violationType)
    if (params.severity) qp.set('severity', params.severity)
    if (params.status) qp.set('status', params.status)
    const qs = qp.toString()
    return request<{ items: DisciplinaryAction[]; total: number }>(`/api/disciplinary-actions${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<DisciplinaryAction>(`/api/disciplinary-actions/${encodeURIComponent(id)}`)
  },
  create(payload: Omit<DisciplinaryAction, 'id' | 'employee' | 'reportedDate' | 'createdAt' | 'updatedAt'>) {
    return request<DisciplinaryAction>(`/api/disciplinary-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<Omit<DisciplinaryAction, 'id' | 'employeeId' | 'employee' | 'reportedDate' | 'createdAt' | 'updatedAt'>>) {
    return request<DisciplinaryAction>(`/api/disciplinary-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/disciplinary-actions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// HR Calendar Events
export type HRCalendarEvent = {
  id: string
  title: string
  description?: string | null
  eventType: string
  startDate: string
  endDate?: string | null
  allDay: boolean
  employeeId?: string | null
  relatedRecordId?: string | null
  relatedRecordType?: string | null
  googleEventId?: string | null
  createdAt?: string
  updatedAt?: string
}

export const HRCalendarApi = {
  list(params: {
    q?: string
    take?: number
    skip?: number
    eventType?: string
    employeeId?: string
    startDate?: string
    endDate?: string
  } = {}) {
    const qp = new URLSearchParams()
    if (params.q) qp.set('q', params.q)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    if (params.eventType) qp.set('eventType', params.eventType)
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.startDate) qp.set('startDate', params.startDate)
    if (params.endDate) qp.set('endDate', params.endDate)
    const qs = qp.toString()
    return request<{ items: HRCalendarEvent[]; total: number }>(`/api/hr-calendar${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<HRCalendarEvent>(`/api/hr-calendar/${encodeURIComponent(id)}`)
  },
  create(payload: Omit<HRCalendarEvent, 'id' | 'googleEventId' | 'createdAt' | 'updatedAt'>) {
    return request<HRCalendarEvent>(`/api/hr-calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<Omit<HRCalendarEvent, 'id' | 'googleEventId' | 'createdAt' | 'updatedAt'>>) {
    return request<HRCalendarEvent>(`/api/hr-calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/hr-calendar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

// Google Admin Users
export type GoogleAdminUser = {
  googleId: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  department: string | null
  position: string | null
  phone: string | null
  orgUnit: string
  isAdmin: boolean
  createdAt: string
  lastLogin: string
  photoUrl: string | null
}

export const GoogleAdminApi = {
  listUsers() {
    return request<{ items: GoogleAdminUser[]; total: number }>(`/api/google-admin/users`)
  },
}

// Notifications
export type Notification = {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  relatedId?: string | null
  relatedType?: string | null
  employeeId?: string | null
  isRead: boolean
  createdAt: string
}

export const NotificationsApi = {
  list(params: { unreadOnly?: boolean; limit?: number } = {}) {
    const qp = new URLSearchParams()
    if (params.unreadOnly) qp.set('unreadOnly', 'true')
    if (params.limit != null) qp.set('limit', String(params.limit))
    const qs = qp.toString()
    return request<{ items: Notification[]; unreadCount: number }>(`/api/notifications${qs ? `?${qs}` : ''}`)
  },
  markAsRead(ids: string[]) {
    return request<{ ok: boolean }>(`/api/notifications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  },
  markAllAsRead() {
    return request<{ ok: boolean }>(`/api/notifications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
  },
}

// Hierarchy
export type HierarchyEmployee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  avatar: string | null
  reportsToId: string | null
  status: string
}

export const HierarchyApi = {
  getDirectReports() {
    return request<{ items: HierarchyEmployee[]; currentEmployeeId: string | null }>(`/api/hierarchy?type=direct-reports`)
  },
  getManagerChain() {
    return request<{ items: HierarchyEmployee[]; currentEmployeeId: string | null }>(`/api/hierarchy?type=manager-chain`)
  },
  getFull() {
    return request<{
      items: HierarchyEmployee[]
      currentEmployeeId: string | null
      managerChainIds: string[]
      directReportIds: string[]
    }>(`/api/hierarchy?type=full`)
  },
}

// Leave Requests
export type LeaveRequest = {
  id: string
  employeeId: string
  employee?: {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    avatar: string | null
  }
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  status: string
  reviewedById?: string | null
  reviewedBy?: {
    id: string
    firstName: string
    lastName: string
  } | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  createdAt: string
  updatedAt: string
}

export const LeavesApi = {
  list(params: {
    employeeId?: string
    status?: string
    startDate?: string
    endDate?: string
    take?: number
    skip?: number
  } = {}) {
    const qp = new URLSearchParams()
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.status) qp.set('status', params.status)
    if (params.startDate) qp.set('startDate', params.startDate)
    if (params.endDate) qp.set('endDate', params.endDate)
    if (params.take != null) qp.set('take', String(params.take))
    if (params.skip != null) qp.set('skip', String(params.skip))
    const qs = qp.toString()
    return request<{ items: LeaveRequest[]; total: number }>(`/api/leaves${qs ? `?${qs}` : ''}`)
  },
  get(id: string) {
    return request<LeaveRequest>(`/api/leaves/${encodeURIComponent(id)}`)
  },
  create(payload: {
    employeeId: string
    leaveType: string
    startDate: string
    endDate: string
    totalDays: number
    reason?: string
  }) {
    return request<LeaveRequest>(`/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<{
    status: string
    reviewNotes?: string
  }>) {
    return request<LeaveRequest>(`/api/leaves/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ ok: boolean }>(`/api/leaves/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
  getBalance(params: { employeeId: string; year?: number } = { employeeId: '' }) {
    const qp = new URLSearchParams()
    if (params.employeeId) qp.set('employeeId', params.employeeId)
    if (params.year != null) qp.set('year', String(params.year))
    const qs = qp.toString()
    return request<{ balances: LeaveBalance[] }>(`/api/leaves/balance${qs ? `?${qs}` : ''}`)
  },
}

// Departments
export type DepartmentHead = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  position: string
  avatar?: string | null
}

export type Department = {
  id: string
  name: string
  code?: string | null
  kpi?: string | null
  headId?: string | null
  head?: DepartmentHead | null
  parentId?: string | null
  parent?: { id: string; name: string } | null
  children?: { id: string; name: string }[]
  _count?: {
    employees: number
    children?: number
  }
}

export const DepartmentsApi = {
  list() {
    return request<{ items: Department[] }>('/api/departments')
  },
  get(id: string) {
    return request<Department>(`/api/departments/${encodeURIComponent(id)}`)
  },
  getHierarchy() {
    return request<{ items: Department[] }>('/api/departments/hierarchy')
  },
  create(payload: { name: string; code?: string; kpi?: string; headId?: string; parentId?: string }) {
    return request<Department>('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  update(id: string, payload: Partial<{ name: string; code: string; kpi: string; headId: string; parentId: string }>) {
    return request<Department>(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  delete(id: string) {
    return request<{ success: boolean }>(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
