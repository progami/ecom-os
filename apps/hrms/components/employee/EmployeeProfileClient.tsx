'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CasesApi,
  EmployeeFilesApi,
  EmployeeTimelineApi,
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
  type TimelineEvent,
} from '@/lib/api-client'
import {
  BuildingIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  PencilIcon,
  PhoneIcon,
  UsersIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards'
import { LeaveHistoryTable } from '@/components/leave/LeaveHistoryTable'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'
import { TabButton } from '@/components/ui/TabButton'
import { employmentTypeLabels } from '@/lib/constants'
import { StandingCard } from '@/components/employee/StandingCard'

type Tab = 'overview' | 'job' | 'documents' | 'timeline' | 'performance' | 'timeoff' | 'cases'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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
  const initialTab: Tab =
    tabParam === 'job' ||
    tabParam === 'documents' ||
    tabParam === 'timeline' ||
    tabParam === 'performance' ||
    tabParam === 'timeoff' ||
    tabParam === 'cases'
      ? (tabParam as Tab)
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
  const [showLeaveForm, setShowLeaveForm] = useState(false)

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const [cases, setCases] = useState<any[]>([])
  const [casesLoading, setCasesLoading] = useState(false)

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
  const canViewTimeline = canViewSensitive
  const canViewPerformance = canViewSensitive
  const canViewTimeOff = canViewSensitive
  const canViewCases = canViewSensitive
  const permissionsReady = Boolean(employee && me && permissions)

  useEffect(() => {
    setActiveTab(initialTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam])

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
      { id: 'timeline' as Tab, label: 'Timeline', icon: CalendarIcon, visible: canViewTimeline },
      { id: 'performance' as Tab, label: 'Performance', icon: ClipboardDocumentCheckIcon, visible: canViewPerformance },
      { id: 'timeoff' as Tab, label: 'Time off', icon: CalendarDaysIcon, visible: canViewTimeOff },
      { id: 'cases' as Tab, label: 'Cases', icon: ExclamationTriangleIcon, visible: canViewCases },
    ],
    [canViewDocuments, canViewTimeline, canViewPerformance, canViewTimeOff, canViewCases]
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
      if (!employee || activeTab !== 'timeoff' || !canViewTimeOff) return
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
  }, [activeTab, canViewTimeOff, employee])

  useEffect(() => {
    async function loadTimeline() {
      if (!employee || activeTab !== 'timeline' || !canViewTimeline) return
      try {
        setTimelineLoading(true)
        const data = await EmployeeTimelineApi.get(employee.id, { take: 200 })
        setTimelineEvents(data.items || [])
      } catch (e) {
        console.error('Failed to load timeline', e)
        setTimelineEvents([])
      } finally {
        setTimelineLoading(false)
      }
    }
    loadTimeline()
  }, [activeTab, canViewTimeline, employee])

  useEffect(() => {
    async function loadCases() {
      if (!employee || activeTab !== 'cases' || !canViewCases) return
      try {
        setCasesLoading(true)
        const data = await CasesApi.list({ subjectEmployeeId: employee.id, take: 50 })
        setCases(data.items || [])
      } catch (e) {
        console.error('Failed to load cases', e)
        setCases([])
      } finally {
        setCasesLoading(false)
      }
    }
    loadCases()
  }, [activeTab, canViewCases, employee])

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

  async function handleLeaveRequestSuccess() {
    if (!employee) return
    setShowLeaveForm(false)
    const [balanceData, requestsData] = await Promise.all([
      LeavesApi.getBalance({ employeeId: employee.id }),
      LeavesApi.list({ employeeId: employee.id }),
    ])
    setLeaveBalances(balanceData.balances || [])
    setLeaveRequests(requestsData.items || [])
  }

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
          You have limited access to this profile. Sensitive records (time off, performance, cases, timeline) are visible only to managers and HR.
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
                <InfoRow icon={UsersIcon} label="Employment type" value={employmentTypeLabels[employee.employmentType] || employee.employmentType} />
                <InfoRow icon={CalendarIcon} label="Join date" value={formatDate(employee.joinDate)} />
                <InfoRow icon={UsersIcon} label="Employee ID" value={employee.employeeId} />
              </div>
            </Card>

            {canViewSensitive ? <StandingCard employeeId={employee.id} /> : null}
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
                value={employmentTypeLabels[employee.employmentType] || employee.employmentType}
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
                  <label className="text-xs font-medium text-foreground">Visibility</label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value as any)}
                    disabled={!isHR && isSelf}
                  >
                    <option value="HR_ONLY">HR only</option>
                    <option value="EMPLOYEE_AND_HR">Employee + HR</option>
                  </select>
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

      {activeTab === 'timeline' && canViewTimeline ? (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-foreground mb-3">Timeline</h2>
          {timelineLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline events yet.</p>
          ) : (
            <div className="space-y-3">
              {timelineEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{event.title}</div>
                      {event.description ? <div className="text-sm text-muted-foreground mt-1">{event.description}</div> : null}
                      <div className="text-xs text-muted-foreground mt-2">{new Date(event.occurredAt).toLocaleString()}</div>
                    </div>
                    {event.href ? (
                      <Link href={event.href} className="text-sm text-accent hover:underline shrink-0">
                        View
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'performance' && canViewPerformance ? (
        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance</h2>
              <p className="text-xs text-muted-foreground mt-1">Performance reviews and cycles for this employee.</p>
            </div>
            {isHR ? (
              <Button href={`/performance/reviews/add?employeeId=${employee.id}`} icon={<ClipboardDocumentCheckIcon className="h-4 w-4" />}>
                Add review
              </Button>
            ) : null}
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

      {activeTab === 'timeoff' && canViewTimeOff ? (
        <div className="space-y-6">
          <Card padding="md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Time off</h2>
                <p className="text-xs text-muted-foreground mt-1">Balances and leave history.</p>
              </div>
              <Button onClick={() => setShowLeaveForm(true)}>Request leave</Button>
            </div>
            <div className="mt-4">
              {leaveLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <LeaveBalanceCards balances={leaveBalances} />}
            </div>
          </Card>

          {showLeaveForm ? (
            <Card padding="md">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Request leave</h3>
                <Button variant="secondary" onClick={() => setShowLeaveForm(false)}>
                  Cancel
                </Button>
              </div>
              <div className="mt-4">
                <LeaveRequestForm employeeId={employee.id} onSuccess={handleLeaveRequestSuccess} onCancel={() => setShowLeaveForm(false)} />
              </div>
            </Card>
          ) : null}

          <Card padding="md">
            <h3 className="text-sm font-semibold text-foreground">History</h3>
            <div className="mt-4">
              {leaveLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <LeaveHistoryTable requests={leaveRequests} />}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'cases' && canViewCases ? (
        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Cases</h2>
              <p className="text-xs text-muted-foreground mt-1">Cases where this employee is the subject.</p>
            </div>
            {isHR ? (
              <Button href={`/cases/add?subjectEmployeeId=${employee.id}`} icon={<ExclamationTriangleIcon className="h-4 w-4" />}>
                New case
              </Button>
            ) : null}
          </div>

          {casesLoading ? (
            <p className="text-sm text-muted-foreground mt-4">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No cases found.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {cases.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block rounded-lg border border-border bg-card p-4 hover:border-input">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        #{c.caseNumber} • {c.title}
                      </div>
                      <div className="text-sm text-muted-foreground">{c.caseType.replaceAll('_', ' ').toLowerCase()}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.status.replaceAll('_', ' ').toLowerCase()} • {String(c.severity).toLowerCase()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{formatDate(c.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
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
