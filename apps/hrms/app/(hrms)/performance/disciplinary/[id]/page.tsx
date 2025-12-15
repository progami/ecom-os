'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DisciplinaryActionsApi, type DisciplinaryAction } from '@/lib/api-client'
import { ShieldExclamationIcon, PencilIcon, TrashIcon } from '@/components/ui/Icons'
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

export default function ViewDisciplinaryPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [action, setAction] = useState<DisciplinaryAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await DisciplinaryActionsApi.get(id)
        setAction(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load record')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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
