'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  EmployeeFilesApi,
  EmployeesApi,
  LeavesApi,
  MeApi,
  PerformanceReviewsApi,
  UploadsApi,
  type Employee,
  type EmployeeFile,
  type LeaveBalance,
  type LeaveRequest,
  type PerformanceReview,
} from '@/lib/api-client'
import {
  BuildingIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  EnvelopeIcon,
  FolderIcon,
  PencilIcon,
  PhoneIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { TabButton } from '@/components/ui/TabButton'
import { SelectField } from '@/components/ui/FormField'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'

const visibilityOptions = [
  { value: 'HR_ONLY', label: 'HR only' },
  { value: 'EMPLOYEE_AND_HR', label: 'Employee + HR' },
]

type Tab = 'overview' | 'job' | 'documents' | 'performance' | 'leave'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—'
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null

  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (!endDate || startDate.getTime() === endDate.getTime()) {
    return `${startStr}, ${startDate.getFullYear()}`
  }

  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}–${endDate.getDate()}, ${startDate.getFullYear()}`
  }
  if (sameYear) {
    return `${startStr} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${startDate.getFullYear()}`
  }
  return `${startStr}, ${startDate.getFullYear()} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endDate.getFullYear()}`
}

function getLeaveStatusConfig(status: string): {
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

function getLeaveTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PTO: 'PTO',
    PARENTAL: 'Parental Leave',
    BEREAVEMENT_IMMEDIATE: 'Bereavement',
    BEREAVEMENT_EXTENDED: 'Extended Bereavement',
    JURY_DUTY: 'Jury Duty',
    UNPAID: 'Unpaid Leave',
  }
  return labels[type] || type.replace(/_/g, ' ').toLowerCase()
}

function formatBytes(size: number | null | undefined): string {
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

type EmployeeProfileVariant = 'employee' | 'hub'

type EmployeeProfileClientProps = {
  employeeId: string
  variant?: EmployeeProfileVariant
}

export function EmployeeProfileClient({ employeeId, variant = 'employee' }: EmployeeProfileClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = employeeId

  const tabParam = (searchParams.get('tab') ?? '').toLowerCase()
  const normalizedTabParam = tabParam === 'timeoff' ? 'leave' : tabParam
  const initialTab: Tab =
    normalizedTabParam === 'job' ||
    normalizedTabParam === 'documents' ||
    normalizedTabParam === 'performance' ||
    normalizedTabParam === 'leave'
      ? (normalizedTabParam as Tab)
      : 'overview'

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [me, setMe] = useState<{ id: string; isHR: boolean; isSuperAdmin: boolean } | null>(null)
  const [permissions, setPermissions] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveLoading, setLeaveLoading] = useState(false)

  const [files, setFiles] = useState<EmployeeFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadVisibility, setUploadVisibility] = useState<'HR_ONLY' | 'EMPLOYEE_AND_HR'>('HR_ONLY')
  const [uploading, setUploading] = useState(false)

  const isHR = Boolean(me?.isHR || me?.isSuperAdmin)
  const isSelf = Boolean(employee && me && employee.id === me.id)
  const isManager = Boolean(permissions?.isManager)
  const canViewSensitive = isSelf || isHR || isManager
  const canViewDocuments = isSelf || isHR
  const canViewPerformance = canViewSensitive
  const canViewLeave = canViewSensitive
  const permissionsReady = Boolean(employee && me && permissions)

  // Sync tab from URL only when it differs (e.g., browser back/forward navigation)
  useEffect(() => {
    if (initialTab !== activeTab) {
      setActiveTab(initialTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam])

  useEffect(() => {
    if (tabParam !== 'timeoff') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'leave')
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '')
  }, [router, searchParams, tabParam])

  useEffect(() => {
    if (!isHR && isSelf) {
      setUploadVisibility('EMPLOYEE_AND_HR')
    }
  }, [isHR, isSelf])

  const tabs = useMemo(
    () => [
      { id: 'overview' as Tab, label: 'Overview', icon: UsersIcon, visible: true },
      { id: 'job' as Tab, label: 'Job & Org', icon: BuildingIcon, visible: true },
      { id: 'documents' as Tab, label: 'Documents', icon: FolderIcon, visible: canViewDocuments },
      { id: 'performance' as Tab, label: 'Performance', icon: ClipboardDocumentCheckIcon, visible: canViewPerformance },
      { id: 'leave' as Tab, label: 'Leave', icon: CalendarDaysIcon, visible: canViewLeave },
    ],
    [canViewDocuments, canViewPerformance, canViewLeave]
  )

  const visibleTabs = useMemo(() => tabs.filter((tab) => tab.visible), [tabs])

  function setTab(next: Tab) {
    if (!visibleTabs.some((tab) => tab.id === next)) return
    setActiveTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '')
  }

  useEffect(() => {
    if (!permissionsReady) return
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      const fallback = visibleTabs[0]?.id ?? 'overview'
      setActiveTab(fallback)
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', fallback)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '')
    }
  }, [activeTab, permissionsReady, router, searchParams, visibleTabs])

  useEffect(() => {
    let cancelled = false

    async function loadEmployee() {
      try {
        setLoading(true)
        setError(null)

        const [emp, perms, meRes] = await Promise.all([
          EmployeesApi.get(id),
          EmployeesApi.getPermissions(id),
          MeApi.get(),
        ])
        if (cancelled) return

        setEmployee(emp)
        setPermissions(perms)
        setMe({ id: meRes.id, isHR: Boolean(meRes.isHR), isSuperAdmin: Boolean(meRes.isSuperAdmin) })
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Failed to load employee'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEmployee()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    async function loadReviews() {
      if (!employee || activeTab !== 'performance' || !canViewPerformance) return
      try {
        setReviewsLoading(true)
        const data = await PerformanceReviewsApi.list({ employeeId: employee.id })
        setReviews(data.items || [])
      } catch (e) {
        console.error('Failed to load reviews', e)
        setReviews([])
      } finally {
        setReviewsLoading(false)
      }
    }
    loadReviews()
  }, [activeTab, canViewPerformance, employee])

  useEffect(() => {
    async function loadLeave() {
      if (!employee || activeTab !== 'leave' || !canViewLeave) return
      try {
        setLeaveLoading(true)
        const [balanceData, requestsData] = await Promise.all([
          LeavesApi.getBalance({ employeeId: employee.id }),
          LeavesApi.list({ employeeId: employee.id }),
        ])
        setLeaveBalances(balanceData.balances || [])
        setLeaveRequests(requestsData.items || [])
      } catch (e) {
        console.error('Failed to load leave data', e)
        setLeaveBalances([])
        setLeaveRequests([])
      } finally {
        setLeaveLoading(false)
      }
    }
    loadLeave()
  }, [activeTab, canViewLeave, employee])

  useEffect(() => {
    async function loadFiles() {
      if (!employee || activeTab !== 'documents' || !canViewDocuments) return
      try {
        setFilesLoading(true)
        const res = await EmployeeFilesApi.list(employee.id)
        setFiles(res.items || [])
      } catch (e) {
        console.error('Failed to load employee files', e)
        setFiles([])
      } finally {
        setFilesLoading(false)
      }
    }
    loadFiles()
  }, [activeTab, canViewDocuments, employee])

  async function uploadDocument() {
    if (!employee || !uploadFile) return
    try {
      setUploading(true)
      setError(null)

      const contentType = uploadFile.type || 'application/octet-stream'
      const presign = await UploadsApi.presign({
        filename: uploadFile.name,
        contentType,
        size: uploadFile.size,
        target: { type: 'EMPLOYEE', id: employee.id },
        visibility: uploadVisibility,
      })

      const put = await fetch(presign.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: uploadFile,
      })

      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`)
      }

      await UploadsApi.finalize({
        key: presign.key,
        filename: uploadFile.name,
        contentType,
        size: uploadFile.size,
        target: { type: 'EMPLOYEE', id: employee.id },
        visibility: uploadVisibility,
        title: uploadTitle.trim() || null,
      })

      setUploadFile(null)
      setUploadTitle('')

      const res = await EmployeeFilesApi.list(employee.id)
      setFiles(res.items || [])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to upload'
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  async function downloadFile(fileId: string) {
    if (!employee) return
    try {
      const { url } = await EmployeeFilesApi.getDownloadUrl(employee.id, fileId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to download'
      setError(message)
    }
  }

  const headerTitle = useMemo(() => {
    if (variant === 'hub') return 'My Hub'
    if (!employee) return 'Employee profile'
    return `${employee.firstName} ${employee.lastName}`.trim()
  }, [employee, variant])

  const headerDescription = useMemo(() => {
    if (!employee) return ''
    if (variant === 'hub') {
      return `${employee.firstName} ${employee.lastName} • ${employee.department} • ${employee.position}`
    }
    return `${employee.department} • ${employee.position}`
  }, [employee, variant])

  const canEditFields: string[] = permissions?.editableFields ?? []
  const canEdit = canEditFields.length > 0

  if (loading && !employee) {
    return (
      <>
        <ListPageHeader title={headerTitle} description="Loading…" icon={<UsersIcon className="h-6 w-6 text-white" />} />
        <Card padding="lg">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Card>
      </>
    )
  }

  if (!employee) {
    return (
      <>
        <ListPageHeader title={headerTitle} description="Not found" icon={<UsersIcon className="h-6 w-6 text-white" />} />
        {error ? (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Card padding="lg">
          <p className="text-sm text-muted-foreground">Employee not found.</p>
          <div className="mt-4">
            <Button href="/work" variant="secondary">
              Back to Work Queue
            </Button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <ListPageHeader
        title={headerTitle}
        description={headerDescription}
        icon={<UsersIcon className="h-6 w-6 text-white" />}
        action={
          canEdit ? (
            <Button href={`/employees/${employee.id}/edit`} icon={<PencilIcon className="h-4 w-4" />}>
              Edit profile
            </Button>
          ) : null
        }
      />

      {!canViewSensitive ? (
        <Alert variant="info" className="mb-6">
          You have limited access to this profile. Sensitive records (leave, performance, timeline) are visible only to managers and HR.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 pb-2">
        {visibleTabs.map((tab) => (
          <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setTab(tab.id)} icon={tab.icon}>
            {tab.label}
          </TabButton>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card padding="md">
              <h2 className="text-sm font-semibold text-foreground mb-3">Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={EnvelopeIcon} label="Email" value={employee.email} />
                <InfoRow icon={PhoneIcon} label="Phone" value={employee.phone || '—'} />
                <InfoRow icon={BuildingIcon} label="Department" value={employee.department || '—'} />
                <InfoRow
                  icon={UsersIcon}
                  label="Employment type"
                  value={EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] || employee.employmentType}
                />
                <InfoRow icon={CalendarIcon} label="Join date" value={formatDate(employee.joinDate)} />
                <InfoRow icon={UsersIcon} label="Employee ID" value={employee.employeeId} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card padding="md">
              <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => window.open(`mailto:${employee.email}`)}
                  icon={<EnvelopeIcon className="h-4 w-4" />}
                >
                  Send email
                </Button>
                {employee.phone ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => window.open(`tel:${employee.phone}`)}
                    icon={<PhoneIcon className="h-4 w-4" />}
                  >
                    Call
                  </Button>
                ) : null}
              </div>
            </Card>

            <Card padding="md">
              <h2 className="text-sm font-semibold text-foreground mb-3">Security</h2>
              <p className="text-xs text-muted-foreground">
                Documents are served using short-lived download links. Emails contain only a title and a link to HRMS.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'job' ? (
        <div className="space-y-6">
          <Card padding="md">
            <h2 className="text-sm font-semibold text-foreground mb-3">Job & Org</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldRow label="Department" value={employee.department || '—'} fieldKey="department" permissions={permissions} />
              <FieldRow label="Role / title" value={employee.position} fieldKey="position" permissions={permissions} />
                <FieldRow
                  label="Employment type"
                  value={EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] || employee.employmentType}
                  fieldKey="employmentType"
                  permissions={permissions}
                />
              <FieldRow label="Join date" value={formatDate(employee.joinDate)} fieldKey="joinDate" permissions={permissions} />
              <FieldRow label="Status" value={employee.status} fieldKey="status" permissions={permissions} />
              <FieldRow
                label="Manager"
                value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
                fieldKey="reportsToId"
                permissions={permissions}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'documents' && canViewDocuments ? (
        <div className="space-y-6">
          <Card padding="md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Documents</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Uploads are stored securely. Email notifications include only a title + “View in HRMS” link.
                </p>
              </div>
            </div>

            {isHR || isSelf ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-foreground">Title (optional)</label>
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Offer Letter"
                  />
                </div>
                <div className="sm:col-span-1">
                  <SelectField
                    label="Visibility"
                    options={visibilityOptions}
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value as any)}
                    disabled={!isHR && isSelf}
                  />
                  {!isHR && isSelf ? (
                    <p className="text-xs text-muted-foreground mt-1">Self uploads are visible to the employee and HR.</p>
                  ) : null}
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-foreground">File</label>
                  <input className="mt-1 block w-full text-sm text-foreground" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                </div>

                <div className="sm:col-span-3 flex justify-end">
                  <Button onClick={uploadDocument} disabled={!uploadFile || uploading}>
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>
              </div>
            ) : (
              <Alert variant="warning" className="mt-4">
                Only HR or the employee can view/upload documents on this profile.
              </Alert>
            )}
          </Card>

          <Card padding="md">
            <h3 className="text-sm font-semibold text-foreground">Files</h3>
            {filesLoading ? (
              <p className="text-sm text-muted-foreground mt-3">Loading…</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No documents yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2 pr-4">Visibility</th>
                      <th className="py-2 pr-4">Uploaded</th>
                      <th className="py-2 pr-4">Size</th>
                      <th className="py-2 pr-0 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-foreground">{f.title}</div>
                          <div className="text-xs text-muted-foreground">{f.fileName || '—'}</div>
                        </td>
                        <td className="py-3 pr-4 text-foreground">{f.visibility === 'HR_ONLY' ? 'HR only' : 'Employee + HR'}</td>
                        <td className="py-3 pr-4 text-foreground">{formatDate(f.uploadedAt)}</td>
                        <td className="py-3 pr-4 text-foreground">{formatBytes(f.size)}</td>
                        <td className="py-3 pr-0 text-right">
                          <Button variant="secondary" onClick={() => downloadFile(f.id)}>
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'performance' && canViewPerformance ? (
        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance</h2>
              <p className="text-xs text-muted-foreground mt-1">Performance reviews and cycles for this employee.</p>
            </div>
          </div>

          {reviewsLoading ? (
            <p className="text-sm text-muted-foreground mt-4">Loading…</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No performance reviews found.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {reviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/performance/reviews/${review.id}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:border-input"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{review.reviewPeriod}</div>
                      <div className="text-sm text-muted-foreground">{review.reviewerName}</div>
                      <div className="text-xs text-muted-foreground mt-1">{formatDate(review.reviewDate)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{review.status.replaceAll('_', ' ').toLowerCase()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'leave' && canViewLeave ? (
        <div className="space-y-6">
          {/* Balances Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Leave Balances</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your available time off</p>
              </div>
              {isSelf ? (
                <Button href="/leave?request=true" className="shadow-sm">
                  <CalendarDaysIcon className="h-4 w-4 mr-2" />
                  Request Leave
                </Button>
              ) : null}
            </div>
            {leaveLoading ? (
              <Card padding="lg">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-accent" />
                </div>
              </Card>
            ) : (
              <LeaveBalanceCards balances={leaveBalances} />
            )}
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Request History</h3>
              {leaveRequests.length > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {leaveRequests.length} request{leaveRequests.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {leaveLoading ? (
              <Card padding="lg">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-1 h-16 bg-muted rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : leaveRequests.length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                    <CalendarDaysIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No leave requests yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Your request history will appear here</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {leaveRequests.map((request, index) => {
                  const statusConfig = getLeaveStatusConfig(request.status)
                  const leaveTypeLabel = getLeaveTypeLabel(request.leaveType)

                  return (
                    <Link
                      key={request.id}
                      href={`/leaves/${request.id}`}
                      className="group block"
                    >
                      <div className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-border/80 transition-all duration-200">
                        {/* Status indicator line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ring-4 ${statusConfig.dotColor} ${statusConfig.ringColor}`}
                          />
                          {index < leaveRequests.length - 1 && (
                            <div className="w-0.5 flex-1 mt-2 bg-border rounded-full" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-foreground">
                                  {leaveTypeLabel}
                                </span>
                                <span className={`
                                  inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
                                  ${statusConfig.badgeClass}
                                `}>
                                  {statusConfig.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">{formatDateRange(request.startDate, request.endDate)}</span>
                                <span className="text-muted-foreground/50">•</span>
                                <span className="tabular-nums">{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</span>
                              </div>
                              {request.reason && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic">
                                  "{request.reason}"
                                </p>
                              )}
                            </div>

                            {/* Arrow indicator */}
                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

function FieldRow({
  label,
  value,
  fieldKey,
  permissions,
}: {
  label: string
  value: string
  fieldKey: string
  permissions: any
}) {
  const field = permissions?.fieldPermissions?.[fieldKey]
  const canEdit = Boolean(field?.canEdit)
  const reason = field?.reason as string | undefined

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground mt-0.5 truncate">{value || '—'}</p>
        </div>
        <span
          className={
            canEdit
              ? 'text-xs rounded-full bg-success-50 text-success-700 px-2 py-0.5'
              : 'text-xs rounded-full bg-muted text-foreground px-2 py-0.5'
          }
        >
          {canEdit ? 'Editable' : 'Read-only'}
        </span>
      </div>
      {!canEdit && reason ? <p className="text-xs text-muted-foreground mt-2">{reason}</p> : null}
    </div>
  )
}
