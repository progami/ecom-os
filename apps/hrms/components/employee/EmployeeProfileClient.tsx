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
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  DocumentIcon,
  EnvelopeIcon,
  FolderIcon,
  PencilIcon,
  PhoneIcon,
  StarFilledIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TabButton } from '@/components/ui/TabButton'
import { NativeSelect } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/domain/employee/constants'
import { cn } from '@/lib/utils'

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

function getReviewStatusConfig(status: string): { label: string; bgClass: string; textClass: string } {
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

  // Group leave balances into categories
  const groupedLeaveBalances = useMemo(() => {
    const filtered = leaveBalances.filter(b => b.leaveType !== 'UNPAID')

    // Core leave types (always show first)
    const coreTypes = ['PTO']
    // Parental leave types
    const parentalTypes = ['PARENTAL', 'MATERNITY', 'PATERNITY']
    // Bereavement types
    const bereavementTypes = ['BEREAVEMENT', 'BEREAVEMENT_IMMEDIATE', 'BEREAVEMENT_EXTENDED']
    // Other types
    const otherTypes = ['JURY_DUTY']

    const core = filtered.filter(b => coreTypes.includes(b.leaveType))
    const parental = filtered.filter(b => parentalTypes.includes(b.leaveType))
    const bereavement = filtered.filter(b => bereavementTypes.includes(b.leaveType))
    const other = filtered.filter(b =>
      !coreTypes.includes(b.leaveType) &&
      !parentalTypes.includes(b.leaveType) &&
      !bereavementTypes.includes(b.leaveType) &&
      !['UNPAID'].includes(b.leaveType)
    )

    return { core, parental, bereavement, other }
  }, [leaveBalances])

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

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' ? (
        <Card padding="md">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoRow icon={EnvelopeIcon} label="Email" value={employee.email} href={`mailto:${employee.email}`} />
            <InfoRow icon={PhoneIcon} label="Phone" value={employee.phone || '—'} href={employee.phone ? `tel:${employee.phone}` : undefined} />
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
      ) : null}

      {/* JOB & ORG TAB */}
      {activeTab === 'job' ? (
        <Card padding="md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Department" value={employee.department || '—'} />
            <FieldRow label="Role / Title" value={employee.position} />
            <FieldRow
              label="Employment Type"
              value={EMPLOYMENT_TYPE_LABELS[employee.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] || employee.employmentType}
            />
            <FieldRow label="Join Date" value={formatDate(employee.joinDate)} />
            <FieldRow label="Status" value={employee.status} />
            <FieldRow
              label="Manager"
              value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
            />
          </div>
        </Card>
      ) : null}

      {/* DOCUMENTS TAB */}
      {activeTab === 'documents' && canViewDocuments ? (
        <div className="space-y-6">
          {/* Upload Section - Only show if HR or self */}
          {(isHR || isSelf) ? (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-foreground mb-4">Upload Document</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <Label className="text-xs">Title (optional)</Label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Offer Letter"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Who can view?</Label>
                  <NativeSelect
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value as any)}
                    disabled={!isHR}
                    className="mt-1"
                  >
                    <option value="HR_ONLY">HR only (private)</option>
                    <option value="EMPLOYEE_AND_HR">Employee can view</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label className="text-xs">File</Label>
                  <Input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Button onClick={uploadDocument} disabled={!uploadFile || uploading} className="w-full">
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>
              </div>
              {!isHR && isSelf && (
                <p className="text-xs text-muted-foreground mt-3">
                  Documents you upload will be visible to you and HR.
                </p>
              )}
            </Card>
          ) : null}

          {/* Files List */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-foreground mb-4">Files</h2>
            {filesLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8">
                <DocumentIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {files.map((f) => (
                  <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{f.title || f.fileName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(f.uploadedAt)}</span>
                        <span>{formatBytes(f.size)}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          f.visibility === 'HR_ONLY'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-accent/10 text-accent'
                        )}>
                          {f.visibility === 'HR_ONLY' ? 'HR only' : 'Shared'}
                        </span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => downloadFile(f.id)}>
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* PERFORMANCE TAB */}
      {activeTab === 'performance' && canViewPerformance ? (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Performance Reviews</h2>
            {reviews.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {reviewsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardDocumentCheckIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No performance reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const statusConfig = getReviewStatusConfig(review.status)
                const avgRating = review.overallRating || 0

                return (
                  <Link
                    key={review.id}
                    href={`/performance/reviews/${review.id}`}
                    className="block group"
                  >
                    <div className="rounded-lg border border-border bg-card p-4 hover:border-input hover:bg-muted/30 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">{review.reviewPeriod}</span>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                              statusConfig.bgClass, statusConfig.textClass
                            )}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>Reviewer: {review.reviewerName || '—'}</span>
                            <span>•</span>
                            <span>{formatDate(review.reviewDate)}</span>
                          </div>
                          {avgRating > 0 && (
                            <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
                              <StarFilledIcon className="h-3.5 w-3.5 text-warning" />
                              <span>{avgRating}/10</span>
                            </div>
                          )}
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      ) : null}

      {/* LEAVE TAB */}
      {activeTab === 'leave' && canViewLeave ? (
        <div className="space-y-6">
          {/* Leave Balances */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Leave Balances</h2>
              {isSelf && (
                <Button href="/leave?request=true" size="sm">
                  Request Leave
                </Button>
              )}
            </div>

            {leaveLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leaveBalances.filter(b => b.leaveType !== 'UNPAID').length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-4">
                  <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No leave balances configured</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Core Leave (PTO) - Full width */}
                {groupedLeaveBalances.core.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groupedLeaveBalances.core.map(balance => (
                      <LeaveBalanceCard key={balance.leaveType} balance={balance} />
                    ))}
                  </div>
                )}

                {/* Parental Leave Row */}
                {groupedLeaveBalances.parental.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {groupedLeaveBalances.parental.map(balance => (
                      <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                    ))}
                  </div>
                )}

                {/* Bereavement Row */}
                {groupedLeaveBalances.bereavement.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {groupedLeaveBalances.bereavement.map(balance => (
                      <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                    ))}
                  </div>
                )}

                {/* Other Leave Types */}
                {groupedLeaveBalances.other.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {groupedLeaveBalances.other.map(balance => (
                      <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Request History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Request History</h2>
              {leaveRequests.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {leaveRequests.length} request{leaveRequests.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {leaveLoading ? (
              <Card padding="lg">
                <div className="animate-pulse space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-muted rounded" />
                  ))}
                </div>
              </Card>
            ) : leaveRequests.length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-4">
                  <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No leave requests yet</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {leaveRequests.map((request) => {
                  const statusConfig = getLeaveStatusConfig(request.status)
                  return (
                    <Link key={request.id} href={`/leaves/${request.id}`} className="block group">
                      <div className="rounded-lg border border-border bg-card p-4 hover:border-input hover:bg-muted/30 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {getLeaveTypeLabel(request.leaveType)}
                              </span>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                                statusConfig.badgeClass
                              )}>
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <span>{formatDateRange(request.startDate, request.endDate)}</span>
                              <span>•</span>
                              <span>{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</span>
                            </div>
                            {request.reason && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                                "{request.reason}"
                              </p>
                            )}
                          </div>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn(
          'text-sm font-medium truncate',
          href ? 'text-accent hover:underline' : 'text-foreground'
        )}>
          {value || '—'}
        </p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }

  return content
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

function LeaveBalanceCard({ balance, compact }: { balance: LeaveBalance; compact?: boolean }) {
  const available = balance.available
  const total = balance.allocated
  const used = total - available
  const percentage = total > 0 ? (available / total) * 100 : 0
  const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
  const isEmpty = available === 0

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-4 transition-all hover:border-input',
      compact ? 'p-3' : 'p-4'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'font-medium text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {getLeaveTypeLabel(balance.leaveType)}
        </span>
        {balance.pending > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning-100 text-warning-700">
            {balance.pending} pending
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={cn(
            'font-bold tabular-nums',
            compact ? 'text-2xl' : 'text-3xl',
            isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'
          )}>
            {available}
          </span>
          <span className={cn(
            'text-muted-foreground ml-1',
            compact ? 'text-xs' : 'text-sm'
          )}>
            / {total} days
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isEmpty ? 'bg-muted-foreground/20' : isLow ? 'bg-warning' : 'bg-accent'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Available</span>
        <span>{used} used</span>
      </div>
    </div>
  )
}
