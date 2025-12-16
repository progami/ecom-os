'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DisciplinaryActionsApi, type DisciplinaryAction } from '@/lib/api-client'
import {
  ShieldExclamationIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckIcon,
  XIcon,
} from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  CONDUCT: 'Conduct',
  PERFORMANCE: 'Performance',
  POLICY_VIOLATION: 'Policy Violation',
  SAFETY: 'Safety',
  HARASSMENT: 'Harassment',
  INSUBORDINATION: 'Insubordination',
  THEFT_FRAUD: 'Theft/Fraud',
  SUBSTANCE_ABUSE: 'Substance Abuse',
  OTHER: 'Other',
}

const VIOLATION_REASON_LABELS: Record<string, string> = {
  EXCESSIVE_ABSENCES: 'Excessive Absences',
  TARDINESS: 'Tardiness',
  UNAUTHORIZED_LEAVE: 'Unauthorized Leave',
  NO_CALL_NO_SHOW: 'No Call/No Show',
  UNPROFESSIONAL_BEHAVIOR: 'Unprofessional Behavior',
  DISRUPTIVE_CONDUCT: 'Disruptive Conduct',
  INAPPROPRIATE_LANGUAGE: 'Inappropriate Language',
  DRESS_CODE_VIOLATION: 'Dress Code Violation',
  POOR_QUALITY_WORK: 'Poor Quality Work',
  MISSED_DEADLINES: 'Missed Deadlines',
  FAILURE_TO_FOLLOW_INSTRUCTIONS: 'Failure to Follow Instructions',
  NEGLIGENCE: 'Negligence',
  CONFIDENTIALITY_BREACH: 'Confidentiality Breach',
  DATA_SECURITY_VIOLATION: 'Data Security Violation',
  EXPENSE_POLICY_VIOLATION: 'Expense Policy Violation',
  IT_POLICY_VIOLATION: 'IT Policy Violation',
  SAFETY_PROTOCOL_VIOLATION: 'Safety Protocol Violation',
  EQUIPMENT_MISUSE: 'Equipment Misuse',
  HARASSMENT_DISCRIMINATION: 'Harassment/Discrimination',
  WORKPLACE_VIOLENCE: 'Workplace Violence',
  THEFT: 'Theft',
  FRAUD: 'Fraud',
  FALSIFICATION: 'Falsification of Records',
  SUBSTANCE_USE_AT_WORK: 'Substance Use at Work',
  OTHER: 'Other',
}

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-slate-100 text-slate-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  MAJOR: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

const ACTION_LABELS: Record<string, string> = {
  VERBAL_WARNING: 'Verbal Warning',
  WRITTEN_WARNING: 'Written Warning',
  FINAL_WARNING: 'Final Warning',
  SUSPENSION: 'Suspension',
  DEMOTION: 'Demotion',
  TERMINATION: 'Termination',
  PIP: 'Performance Improvement Plan',
  TRAINING_REQUIRED: 'Training Required',
  NO_ACTION: 'No Action',
}

const STATUS_LABELS: Record<string, string> = {
  // Approval chain statuses
  PENDING_HR_REVIEW: 'Pending HR Review',
  PENDING_SUPER_ADMIN: 'Pending Final Approval',
  PENDING_ACKNOWLEDGMENT: 'Pending Acknowledgment',
  // Active statuses
  ACTIVE: 'Active',
  // Appeal chain
  APPEALED: 'Appealed',
  APPEAL_PENDING_HR: 'Appeal - HR Review',
  APPEAL_PENDING_SUPER_ADMIN: 'Appeal - Final Decision',
  // Resolution statuses
  CLOSED: 'Closed',
  DISMISSED: 'Dismissed',
  // Legacy statuses
  OPEN: 'Open',
  UNDER_INVESTIGATION: 'Under Investigation',
  ACTION_TAKEN: 'Action Taken',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_HR_REVIEW: 'bg-amber-100 text-amber-800',
  PENDING_SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  PENDING_ACKNOWLEDGMENT: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-cyan-100 text-cyan-800',
  APPEALED: 'bg-orange-100 text-orange-800',
  APPEAL_PENDING_HR: 'bg-orange-100 text-orange-800',
  APPEAL_PENDING_SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  CLOSED: 'bg-slate-100 text-slate-800',
  DISMISSED: 'bg-green-100 text-green-800',
}

const APPEAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Review',
  UPHELD: 'Appeal Denied - Decision Upheld',
  OVERTURNED: 'Appeal Granted - Violation Dismissed',
  MODIFIED: 'Appeal Partially Granted - Action Modified',
}

const APPEAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  UPHELD: 'bg-red-100 text-red-800',
  OVERTURNED: 'bg-green-100 text-green-800',
  MODIFIED: 'bg-blue-100 text-blue-800',
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorClass = SEVERITY_COLORS[severity] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {SEVERITY_LABELS[severity] || severity}
    </span>
  )
}

function CustomStatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status] || status.replace(/_/g, ' ')}
    </span>
  )
}

// Workflow Progress Stepper
function WorkflowStepper({ status, appealStatus }: { status: string; appealStatus?: string | null }) {
  // Determine which flow we're in
  const isAppealFlow = ['APPEALED', 'APPEAL_PENDING_HR', 'APPEAL_PENDING_SUPER_ADMIN'].includes(status) ||
                       (appealStatus && appealStatus !== 'PENDING')

  if (isAppealFlow) {
    // Appeal flow steps
    const steps = [
      { key: 'appeal_submitted', label: 'Appeal Submitted', icon: ExclamationTriangleIcon },
      { key: 'appeal_hr', label: 'HR Review', icon: ClockIcon },
      { key: 'appeal_sa', label: 'Final Decision', icon: CheckCircleIcon },
    ]

    let currentStep = 0
    if (status === 'APPEAL_PENDING_HR' || status === 'APPEALED') currentStep = 1
    if (status === 'APPEAL_PENDING_SUPER_ADMIN') currentStep = 2
    if (['CLOSED', 'DISMISSED'].includes(status) && appealStatus) currentStep = 3

    return (
      <div className="mb-6">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Appeal Progress</h4>
        <div className="flex items-center">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isCurrent = idx === currentStep - 1
            const Icon = step.icon
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted ? 'bg-green-500 border-green-500' :
                  isCurrent ? 'bg-amber-500 border-amber-500' :
                  'bg-white border-slate-300'
                }`}>
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4 text-white" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </div>
                <span className={`ml-2 text-xs font-medium ${
                  isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Normal approval flow steps
  const steps = [
    { key: 'raised', label: 'Raised', icon: ShieldExclamationIcon },
    { key: 'hr_review', label: 'HR Review', icon: ClockIcon },
    { key: 'sa_approval', label: 'Final Approval', icon: CheckCircleIcon },
    { key: 'acknowledgment', label: 'Acknowledgment', icon: CheckCircleIcon },
  ]

  let currentStep = 0
  if (status === 'PENDING_HR_REVIEW') currentStep = 1
  if (status === 'PENDING_SUPER_ADMIN') currentStep = 2
  if (status === 'PENDING_ACKNOWLEDGMENT') currentStep = 3
  if (['ACTIVE', 'CLOSED'].includes(status)) currentStep = 4
  if (status === 'DISMISSED') currentStep = -1 // Rejected

  return (
    <div className="mb-6">
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Approval Progress</h4>
      {status === 'DISMISSED' ? (
        <div className="flex items-center gap-2 text-red-600">
          <XCircleIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Rejected/Dismissed</span>
        </div>
      ) : (
        <div className="flex items-center">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isCurrent = idx === currentStep - 1
            const Icon = step.icon
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted ? 'bg-green-500 border-green-500' :
                  isCurrent ? 'bg-cyan-500 border-cyan-500' :
                  'bg-white border-slate-300'
                }`}>
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4 text-white" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </div>
                <span className={`ml-2 text-xs font-medium ${
                  isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type AcknowledgmentStatus = {
  employeeAcknowledged: boolean
  employeeAcknowledgedAt: string | null
  managerAcknowledged: boolean
  managerAcknowledgedAt: string | null
  canAcknowledgeAsEmployee: boolean
  canAcknowledgeAsManager: boolean
  fullyAcknowledged: boolean
}

type AppealStatus = {
  appealReason: string | null
  appealedAt: string | null
  appealStatus: string | null
  appealResolution: string | null
  appealResolvedAt: string | null
  canAppeal: boolean
  canResolveAppeal: boolean
  hasAppealed: boolean
  appealResolved: boolean
}

type HRReviewStatus = {
  canReview: boolean
  hrReview: {
    reviewedAt: string | null
    reviewedById: string | null
    notes: string | null
    approved: boolean | null
  }
}

type SuperAdminStatus = {
  canApprove: boolean
  superAdminApproval: {
    approvedAt: string | null
    approvedById: string | null
    notes: string | null
    approved: boolean | null
  }
}

export default function ViewDisciplinaryPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [action, setAction] = useState<DisciplinaryAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [ackStatus, setAckStatus] = useState<AcknowledgmentStatus | null>(null)
  const [appealStatus, setAppealStatus] = useState<AppealStatus | null>(null)
  const [hrReviewStatus, setHrReviewStatus] = useState<HRReviewStatus | null>(null)
  const [superAdminStatus, setSuperAdminStatus] = useState<SuperAdminStatus | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [appealing, setAppealing] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [hrReviewing, setHrReviewing] = useState(false)
  const [saApproving, setSaApproving] = useState(false)
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [showHRReviewForm, setShowHRReviewForm] = useState(false)
  const [showSAApprovalForm, setShowSAApprovalForm] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [appealResolutionStatus, setAppealResolutionStatus] = useState('UPHELD')
  const [appealResolutionText, setAppealResolutionText] = useState('')
  const [hrReviewNotes, setHrReviewNotes] = useState('')
  const [saApprovalNotes, setSaApprovalNotes] = useState('')

  async function loadAllStatuses() {
    // Load acknowledgment status
    const ackRes = await fetch(`/api/disciplinary-actions/${id}/acknowledge`)
    if (ackRes.ok) setAckStatus(await ackRes.json())

    // Load appeal status
    const appealRes = await fetch(`/api/disciplinary-actions/${id}/appeal`)
    if (appealRes.ok) setAppealStatus(await appealRes.json())

    // Load HR review status
    const hrRes = await fetch(`/api/disciplinary-actions/${id}/hr-review`)
    if (hrRes.ok) setHrReviewStatus(await hrRes.json())

    // Load Super Admin status
    const saRes = await fetch(`/api/disciplinary-actions/${id}/super-admin-approve`)
    if (saRes.ok) setSuperAdminStatus(await saRes.json())
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await DisciplinaryActionsApi.get(id)
        setAction(data)
        await loadAllStatuses()
      } catch (e: any) {
        setError(e.message || 'Failed to load record')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleAcknowledge() {
    setAcknowledging(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/acknowledge`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to acknowledge')
      }
      const data = await res.json()
      setAction(data)
      setSuccess('Violation acknowledged successfully')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAcknowledging(false)
    }
  }

  async function handleHRReview(approved: boolean) {
    setHrReviewing(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/hr-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, notes: hrReviewNotes.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit HR review')
      }
      const data = await res.json()
      setAction(data.action)
      setSuccess(approved ? 'Approved and sent to Super Admin for final approval' : 'Violation rejected')
      setShowHRReviewForm(false)
      setHrReviewNotes('')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setHrReviewing(false)
    }
  }

  async function handleSAApproval(approved: boolean) {
    setSaApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/super-admin-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, notes: saApprovalNotes.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit approval')
      }
      const data = await res.json()
      setAction(data.action)
      setSuccess(approved ? 'Approved - Employee and Manager have been notified' : 'Violation rejected')
      setShowSAApprovalForm(false)
      setSaApprovalNotes('')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaApproving(false)
    }
  }

  async function handleSubmitAppeal() {
    if (appealReason.trim().length < 10) {
      setError('Appeal reason must be at least 10 characters')
      return
    }
    setAppealing(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealReason: appealReason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit appeal')
      }
      const data = await res.json()
      setAction(data)
      setSuccess('Appeal submitted successfully. HR will review your appeal.')
      setShowAppealForm(false)
      setAppealReason('')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAppealing(false)
    }
  }

  async function handleHRAppealReview(forwardToSuperAdmin: boolean) {
    setResolving(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hrReview: {
            forwardToSuperAdmin,
            notes: appealResolutionText.trim() || null,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process appeal')
      }
      const data = await res.json()
      setAction(data)
      setSuccess('Appeal forwarded to Super Admin for final decision')
      setShowResolveForm(false)
      setAppealResolutionText('')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setResolving(false)
    }
  }

  async function handleSAAppealDecision() {
    if (!appealResolutionText.trim()) {
      setError('Resolution explanation is required')
      return
    }
    setResolving(true)
    setError(null)
    try {
      const res = await fetch(`/api/disciplinary-actions/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          superAdminDecision: true,
          appealStatus: appealResolutionStatus,
          appealResolution: appealResolutionText.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to resolve appeal')
      }
      const data = await res.json()
      setAction(data)
      setSuccess('Appeal resolved successfully')
      setShowResolveForm(false)
      setAppealResolutionText('')
      await loadAllStatuses()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setResolving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this disciplinary record?')) return
    setDeleting(true)
    try {
      await DisciplinaryActionsApi.delete(id)
      router.push('/performance/disciplinary')
    } catch (e: any) {
      setError(e.message || 'Failed to delete record')
      setDeleting(false)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Violation Record"
          description="Loading..."
          icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-6 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          </Card>
        </div>
      </>
    )
  }

  if (!action) {
    return (
      <>
        <PageHeader
          title="Violation Record"
          description="Not Found"
          icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Record not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  const canShowHRReview = action.status === 'PENDING_HR_REVIEW' && hrReviewStatus?.canReview
  const canShowSAApproval = action.status === 'PENDING_SUPER_ADMIN' && superAdminStatus?.canApprove
  const canShowAppealHRReview = action.status === 'APPEAL_PENDING_HR' && hrReviewStatus?.canReview
  const canShowAppealSADecision = action.status === 'APPEAL_PENDING_SUPER_ADMIN' && superAdminStatus?.canApprove

  return (
    <>
      <PageHeader
        title="Violation Record"
        description={`${action.employee?.firstName} ${action.employee?.lastName}`}
        icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Workflow Progress */}
        <Card padding="lg">
          <WorkflowStepper status={action.status} appealStatus={appealStatus?.appealStatus} />

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {action.employee?.firstName} {action.employee?.lastName}
              </h2>
              <p className="text-sm text-slate-500">
                {action.employee?.position} • {action.employee?.department}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={action.severity} />
              <CustomStatusBadge status={action.status} />
            </div>
          </div>
        </Card>

        {/* HR Review Section */}
        {canShowHRReview && (
          <Card padding="lg" className="border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-medium text-slate-900">HR Review Required</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This violation requires your review. Please approve to forward to Super Admin for final approval, or reject to dismiss.
            </p>

            {!showHRReviewForm ? (
              <Button onClick={() => setShowHRReviewForm(true)}>Review Violation</Button>
            ) : (
              <div className="space-y-4 p-4 bg-white rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={hrReviewNotes}
                    onChange={(e) => setHrReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Add any notes about your review..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowHRReviewForm(false)}>Cancel</Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleHRReview(false)}
                    loading={hrReviewing}
                    icon={<XIcon className="h-4 w-4" />}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleHRReview(true)}
                    loading={hrReviewing}
                    icon={<CheckIcon className="h-4 w-4" />}
                  >
                    Approve & Forward
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Super Admin Approval Section */}
        {canShowSAApproval && (
          <Card padding="lg" className="border-2 border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircleIcon className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-medium text-slate-900">Final Approval Required</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              HR has approved this violation. As Super Admin, please provide final approval to notify the employee, or reject to dismiss.
            </p>

            {!showSAApprovalForm ? (
              <Button onClick={() => setShowSAApprovalForm(true)}>Review & Decide</Button>
            ) : (
              <div className="space-y-4 p-4 bg-white rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={saApprovalNotes}
                    onChange={(e) => setSaApprovalNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Add any notes about your decision..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowSAApprovalForm(false)}>Cancel</Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleSAApproval(false)}
                    loading={saApproving}
                    icon={<XIcon className="h-4 w-4" />}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleSAApproval(true)}
                    loading={saApproving}
                    icon={<CheckIcon className="h-4 w-4" />}
                  >
                    Approve & Notify
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Appeal HR Review Section */}
        {canShowAppealHRReview && (
          <Card padding="lg" className="border-2 border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-medium text-slate-900">Appeal Review Required</h3>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              The employee has submitted an appeal. Please review and forward to Super Admin for final decision.
            </p>
            {appealStatus?.appealReason && (
              <div className="bg-white p-3 rounded border border-slate-200 mb-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Employee&apos;s Appeal:</p>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealReason}</p>
              </div>
            )}

            {!showResolveForm ? (
              <Button onClick={() => setShowResolveForm(true)}>Review Appeal</Button>
            ) : (
              <div className="space-y-4 p-4 bg-white rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HR Notes (Optional)</label>
                  <textarea
                    value={appealResolutionText}
                    onChange={(e) => setAppealResolutionText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Add notes for Super Admin..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowResolveForm(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleHRAppealReview(true)}
                    loading={resolving}
                    icon={<CheckIcon className="h-4 w-4" />}
                  >
                    Forward to Super Admin
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Appeal Super Admin Decision Section */}
        {canShowAppealSADecision && (
          <Card padding="lg" className="border-2 border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircleIcon className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-medium text-slate-900">Appeal Final Decision Required</h3>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              HR has reviewed the appeal. As Super Admin, please make the final decision.
            </p>
            {appealStatus?.appealReason && (
              <div className="bg-white p-3 rounded border border-slate-200 mb-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Employee&apos;s Appeal:</p>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealReason}</p>
              </div>
            )}

            {!showResolveForm ? (
              <Button onClick={() => setShowResolveForm(true)}>Make Decision</Button>
            ) : (
              <div className="space-y-4 p-4 bg-white rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
                  <select
                    value={appealResolutionStatus}
                    onChange={(e) => setAppealResolutionStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="UPHELD">Upheld - Original decision stands</option>
                    <option value="MODIFIED">Modified - Reduce action/severity</option>
                    <option value="OVERTURNED">Overturned - Dismiss violation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Explanation (Required)</label>
                  <textarea
                    value={appealResolutionText}
                    onChange={(e) => setAppealResolutionText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Explain your decision..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowResolveForm(false)}>Cancel</Button>
                  <Button onClick={handleSAAppealDecision} loading={resolving}>
                    Submit Decision
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Violation Details */}
        <Card padding="lg">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Violation Details</h3>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Violation Type" value={VIOLATION_TYPE_LABELS[action.violationType] || action.violationType} />
            <DetailRow label="Specific Reason" value={VIOLATION_REASON_LABELS[action.violationReason] || action.violationReason} />
            <DetailRow label="Incident Date" value={formatDate(action.incidentDate)} />
            <DetailRow label="Reported Date" value={formatDate(action.reportedDate)} />
            <DetailRow label="Reported By" value={action.reportedBy} />
          </dl>
        </Card>

        <Card padding="lg">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Incident Details</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-slate-500 mb-1">Description</dt>
              <dd className="text-sm text-slate-900 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">{action.description}</dd>
            </div>
            {action.witnesses && (
              <div>
                <dt className="text-sm font-medium text-slate-500 mb-1">Witnesses</dt>
                <dd className="text-sm text-slate-900">{action.witnesses}</dd>
              </div>
            )}
            {action.evidence && (
              <div>
                <dt className="text-sm font-medium text-slate-500 mb-1">Evidence</dt>
                <dd className="text-sm text-slate-900">{action.evidence}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card padding="lg">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Action Taken</h3>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Action Type" value={ACTION_LABELS[action.actionTaken] || action.actionTaken} />
            <DetailRow label="Action Date" value={formatDate(action.actionDate)} />
            {action.actionDetails && (
              <div className="py-3">
                <dt className="text-sm font-medium text-slate-500 mb-1">Action Details</dt>
                <dd className="text-sm text-slate-900 whitespace-pre-wrap">{action.actionDetails}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Employee Response Card - Only show when pending acknowledgment */}
        {action.status === 'PENDING_ACKNOWLEDGMENT' && (
          <Card padding="lg">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Employee Response</h3>

            {/* Show appeal info if appealed */}
            {appealStatus?.hasAppealed && (
              <div className="mb-6">
                <div className={`p-4 rounded-lg border ${appealStatus.appealResolved ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-slate-900">Appeal Submitted</span>
                    </div>
                    {appealStatus.appealStatus && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${APPEAL_STATUS_COLORS[appealStatus.appealStatus] || 'bg-slate-100 text-slate-700'}`}>
                        {APPEAL_STATUS_LABELS[appealStatus.appealStatus] || appealStatus.appealStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-2">Submitted on {formatDate(appealStatus.appealedAt)}</p>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-1">Employee&apos;s Appeal:</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealReason}</p>
                  </div>

                  {appealStatus.appealResolved && appealStatus.appealResolution && (
                    <div className="mt-4 bg-white p-3 rounded border border-slate-200">
                      <p className="text-sm font-medium text-slate-700 mb-1">Decision ({formatDate(appealStatus.appealResolvedAt)}):</p>
                      <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealResolution}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show acknowledge/appeal options if employee hasn't responded yet */}
            {!appealStatus?.hasAppealed && ackStatus && (
              <div className="space-y-4">
                {ackStatus.canAcknowledgeAsEmployee && appealStatus?.canAppeal && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-slate-900">Action Required</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      You must respond to this violation. You can either acknowledge the violation or submit an appeal if you believe it is incorrect.
                    </p>

                    {!showAppealForm ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={handleAcknowledge}
                          loading={acknowledging}
                          icon={<CheckCircleIcon className="h-4 w-4" />}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setShowAppealForm(true)}
                          icon={<XCircleIcon className="h-4 w-4" />}
                        >
                          Appeal
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Why are you appealing this violation?
                          </label>
                          <textarea
                            value={appealReason}
                            onChange={(e) => setAppealReason(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            placeholder="Explain why you believe this violation is incorrect or unfair..."
                          />
                          <p className="text-xs text-slate-500 mt-1">Minimum 10 characters required</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setShowAppealForm(false)
                              setAppealReason('')
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSubmitAppeal} loading={appealing}>
                            Submit Appeal
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {ackStatus.employeeAcknowledged && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Employee Acknowledged</p>
                        <p className="text-xs text-slate-500">
                          Acknowledged on {formatDate(ackStatus.employeeAcknowledgedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Manager Acknowledgment Section */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-900 mb-4">Manager Acknowledgment</h4>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {ackStatus?.managerAcknowledged ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <ClockIcon className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {ackStatus?.managerAcknowledged ? 'Acknowledged' : 'Pending'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ackStatus?.managerAcknowledged
                        ? `Acknowledged on ${formatDate(ackStatus?.managerAcknowledgedAt)}`
                        : 'Awaiting manager review'}
                    </p>
                  </div>
                </div>
                {ackStatus?.canAcknowledgeAsManager && (
                  <Button
                    size="sm"
                    onClick={handleAcknowledge}
                    loading={acknowledging}
                    icon={<CheckCircleIcon className="h-4 w-4" />}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Show appeal info for appeal statuses */}
        {['APPEALED', 'APPEAL_PENDING_HR', 'APPEAL_PENDING_SUPER_ADMIN', 'CLOSED', 'DISMISSED'].includes(action.status) && appealStatus?.hasAppealed && (
          <Card padding="lg">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Appeal Information</h3>
            <div className={`p-4 rounded-lg border ${appealStatus.appealResolved ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-slate-900">Appeal Submitted</span>
                </div>
                {appealStatus.appealStatus && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${APPEAL_STATUS_COLORS[appealStatus.appealStatus] || 'bg-slate-100 text-slate-700'}`}>
                    {APPEAL_STATUS_LABELS[appealStatus.appealStatus] || appealStatus.appealStatus}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-2">Submitted on {formatDate(appealStatus.appealedAt)}</p>
              <div className="bg-white p-3 rounded border border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-1">Employee&apos;s Appeal:</p>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealReason}</p>
              </div>

              {appealStatus.appealResolved && appealStatus.appealResolution && (
                <div className="mt-4 bg-white p-3 rounded border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-1">Final Decision ({formatDate(appealStatus.appealResolvedAt)}):</p>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealResolution}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {(action.followUpDate || action.followUpNotes || action.resolution) && (
          <Card padding="lg">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Follow-up & Resolution</h3>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Follow-up Date" value={formatDate(action.followUpDate)} />
              {action.followUpNotes && (
                <div className="py-3">
                  <dt className="text-sm font-medium text-slate-500 mb-1">Follow-up Notes</dt>
                  <dd className="text-sm text-slate-900 whitespace-pre-wrap">{action.followUpNotes}</dd>
                </div>
              )}
              {action.resolution && (
                <div className="py-3">
                  <dt className="text-sm font-medium text-slate-500 mb-1">Resolution</dt>
                  <dd className="text-sm text-slate-900 whitespace-pre-wrap">{action.resolution}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleDelete}
            loading={deleting}
            icon={<TrashIcon className="h-4 w-4" />}
          >
            Delete
          </Button>
          <Button
            href={`/performance/disciplinary/${id}/edit`}
            icon={<PencilIcon className="h-4 w-4" />}
          >
            Edit Record
          </Button>
        </div>
      </div>
    </>
  )
}
