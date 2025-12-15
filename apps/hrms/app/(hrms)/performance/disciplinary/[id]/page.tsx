'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DisciplinaryActionsApi, type DisciplinaryAction } from '@/lib/api-client'
import { ShieldExclamationIcon, PencilIcon, TrashIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, XCircleIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/Card'
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
  OPEN: 'Open',
  UNDER_INVESTIGATION: 'Under Investigation',
  ACTION_TAKEN: 'Action Taken',
  APPEALED: 'Appealed',
  CLOSED: 'Closed',
  DISMISSED: 'Dismissed',
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
  const [acknowledging, setAcknowledging] = useState(false)
  const [appealing, setAppealing] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [appealResolutionStatus, setAppealResolutionStatus] = useState('UPHELD')
  const [appealResolutionText, setAppealResolutionText] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await DisciplinaryActionsApi.get(id)
        setAction(data)

        // Load acknowledgment status
        const ackRes = await fetch(`/api/disciplinary-actions/${id}/acknowledge`)
        if (ackRes.ok) {
          setAckStatus(await ackRes.json())
        }

        // Load appeal status
        const appealRes = await fetch(`/api/disciplinary-actions/${id}/appeal`)
        if (appealRes.ok) {
          setAppealStatus(await appealRes.json())
        }
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
      const res = await fetch(`/api/disciplinary-actions/${id}/acknowledge`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to acknowledge')
      }
      const data = await res.json()
      setAction(data)
      setSuccess('Violation acknowledged successfully')

      // Reload statuses
      const ackRes = await fetch(`/api/disciplinary-actions/${id}/acknowledge`)
      if (ackRes.ok) setAckStatus(await ackRes.json())
      const appealRes = await fetch(`/api/disciplinary-actions/${id}/appeal`)
      if (appealRes.ok) setAppealStatus(await appealRes.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAcknowledging(false)
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

      // Reload statuses
      const ackRes = await fetch(`/api/disciplinary-actions/${id}/acknowledge`)
      if (ackRes.ok) setAckStatus(await ackRes.json())
      const appealRes = await fetch(`/api/disciplinary-actions/${id}/appeal`)
      if (appealRes.ok) setAppealStatus(await appealRes.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAppealing(false)
    }
  }

  async function handleResolveAppeal() {
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

      // Reload statuses
      const ackRes = await fetch(`/api/disciplinary-actions/${id}/acknowledge`)
      if (ackRes.ok) setAckStatus(await ackRes.json())
      const appealRes = await fetch(`/api/disciplinary-actions/${id}/appeal`)
      if (appealRes.ok) setAppealStatus(await appealRes.json())
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

        <Card padding="lg">
          <div className="flex items-start justify-between mb-6">
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
              <StatusBadge status={STATUS_LABELS[action.status] || action.status} />
            </div>
          </div>

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

        {/* Employee Response Card - Acknowledge OR Appeal */}
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

                {/* Appeal Resolution */}
                {appealStatus.appealResolved && appealStatus.appealResolution && (
                  <div className="mt-4 bg-white p-3 rounded border border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-1">HR Decision ({formatDate(appealStatus.appealResolvedAt)}):</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{appealStatus.appealResolution}</p>
                  </div>
                )}

                {/* Resolve Appeal Form */}
                {appealStatus.canResolveAppeal && !showResolveForm && (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowResolveForm(true)}
                  >
                    Resolve Appeal
                  </Button>
                )}

                {showResolveForm && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 space-y-4">
                    <h4 className="font-medium text-slate-900">Resolve Appeal</h4>
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Explanation</label>
                      <textarea
                        value={appealResolutionText}
                        onChange={(e) => setAppealResolutionText(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Explain the decision and reasoning..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowResolveForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleResolveAppeal}
                        loading={resolving}
                      >
                        Submit Decision
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show acknowledge/appeal options if employee hasn't responded yet */}
          {!appealStatus?.hasAppealed && ackStatus && (
            <div className="space-y-4">
              {/* Employee can acknowledge OR appeal */}
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
                          placeholder="Explain why you believe this violation is incorrect or unfair. Provide any relevant context or evidence..."
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
                        <Button
                          size="sm"
                          onClick={handleSubmitAppeal}
                          loading={appealing}
                        >
                          Submit Appeal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Employee has acknowledged */}
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
