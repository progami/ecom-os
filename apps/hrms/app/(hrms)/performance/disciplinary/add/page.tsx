'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DisciplinaryActionsApi, EmployeesApi, type Employee } from '@/lib/api-client'
import { ShieldExclamationIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  FormField,
  SelectField,
  TextareaField,
  FormSection,
  FormActions,
} from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'

const violationTypeOptions = [
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'INSUBORDINATION', label: 'Insubordination' },
  { value: 'THEFT_FRAUD', label: 'Theft/Fraud' },
  { value: 'SUBSTANCE_ABUSE', label: 'Substance Abuse' },
  { value: 'OTHER', label: 'Other' },
]

const violationReasonOptions: Record<string, { value: string; label: string }[]> = {
  ATTENDANCE: [
    { value: 'EXCESSIVE_ABSENCES', label: 'Excessive Absences' },
    { value: 'TARDINESS', label: 'Tardiness' },
    { value: 'UNAUTHORIZED_LEAVE', label: 'Unauthorized Leave' },
    { value: 'NO_CALL_NO_SHOW', label: 'No Call/No Show' },
  ],
  CONDUCT: [
    { value: 'UNPROFESSIONAL_BEHAVIOR', label: 'Unprofessional Behavior' },
    { value: 'DISRUPTIVE_CONDUCT', label: 'Disruptive Conduct' },
    { value: 'INAPPROPRIATE_LANGUAGE', label: 'Inappropriate Language' },
    { value: 'DRESS_CODE_VIOLATION', label: 'Dress Code Violation' },
  ],
  PERFORMANCE: [
    { value: 'POOR_QUALITY_WORK', label: 'Poor Quality Work' },
    { value: 'MISSED_DEADLINES', label: 'Missed Deadlines' },
    { value: 'FAILURE_TO_FOLLOW_INSTRUCTIONS', label: 'Failure to Follow Instructions' },
    { value: 'NEGLIGENCE', label: 'Negligence' },
  ],
  POLICY_VIOLATION: [
    { value: 'CONFIDENTIALITY_BREACH', label: 'Confidentiality Breach' },
    { value: 'DATA_SECURITY_VIOLATION', label: 'Data Security Violation' },
    { value: 'EXPENSE_POLICY_VIOLATION', label: 'Expense Policy Violation' },
    { value: 'IT_POLICY_VIOLATION', label: 'IT Policy Violation' },
  ],
  SAFETY: [
    { value: 'SAFETY_PROTOCOL_VIOLATION', label: 'Safety Protocol Violation' },
    { value: 'EQUIPMENT_MISUSE', label: 'Equipment Misuse' },
  ],
  HARASSMENT: [
    { value: 'HARASSMENT_DISCRIMINATION', label: 'Harassment/Discrimination' },
    { value: 'WORKPLACE_VIOLENCE', label: 'Workplace Violence' },
  ],
  THEFT_FRAUD: [
    { value: 'THEFT', label: 'Theft' },
    { value: 'FRAUD', label: 'Fraud' },
    { value: 'FALSIFICATION', label: 'Falsification of Records' },
  ],
  SUBSTANCE_ABUSE: [
    { value: 'SUBSTANCE_USE_AT_WORK', label: 'Substance Use at Work' },
  ],
  INSUBORDINATION: [
    { value: 'FAILURE_TO_FOLLOW_INSTRUCTIONS', label: 'Failure to Follow Instructions' },
    { value: 'DISRUPTIVE_CONDUCT', label: 'Disruptive Conduct' },
  ],
  OTHER: [
    { value: 'OTHER', label: 'Other' },
  ],
}

const severityOptions = [
  { value: 'MINOR', label: 'Minor - Verbal Warning' },
  { value: 'MODERATE', label: 'Moderate - Written Warning' },
  { value: 'MAJOR', label: 'Major - Final Warning/Suspension' },
  { value: 'CRITICAL', label: 'Critical - Termination Consideration' },
]

const actionTypeOptions = [
  { value: 'VERBAL_WARNING', label: 'Verbal Warning' },
  { value: 'WRITTEN_WARNING', label: 'Written Warning' },
  { value: 'FINAL_WARNING', label: 'Final Warning' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'DEMOTION', label: 'Demotion' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'PIP', label: 'Performance Improvement Plan' },
  { value: 'TRAINING_REQUIRED', label: 'Training Required' },
  { value: 'NO_ACTION', label: 'No Action (Investigation Only)' },
]

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'ACTION_TAKEN', label: 'Action Taken' },
  { value: 'APPEALED', label: 'Appealed' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

function AddDisciplinaryForm() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const searchParams = useSearchParams()
  const preselectedEmployeeId = searchParams.get('employeeId')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [selectedViolationType, setSelectedViolationType] = useState('')

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await EmployeesApi.list({ take: 100 })
        setEmployees(data.items || [])
      } catch (e) {
        console.error('Failed to load employees:', e)
      } finally {
        setLoadingEmployees(false)
      }
    }
    loadEmployees()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      await DisciplinaryActionsApi.create({
        employeeId: String(payload.employeeId),
        violationType: String(payload.violationType),
        violationReason: String(payload.violationReason),
        severity: String(payload.severity),
        incidentDate: String(payload.incidentDate),
        reportedBy: String(payload.reportedBy),
        description: String(payload.description),
        witnesses: payload.witnesses || null,
        evidence: payload.evidence || null,
        actionTaken: String(payload.actionTaken),
        actionDate: payload.actionDate || null,
        actionDetails: payload.actionDetails || null,
        followUpDate: payload.followUpDate || null,
        followUpNotes: payload.followUpNotes || null,
        status: String(payload.status),
        resolution: payload.resolution || null,
      })
      router.push('/performance/disciplinary')
    } catch (e: any) {
      setError(e.message || 'Failed to create disciplinary record')
    } finally {
      setSubmitting(false)
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
  }))

  const reasonOptions = selectedViolationType
    ? violationReasonOptions[selectedViolationType] || [{ value: 'OTHER', label: 'Other' }]
    : [{ value: '', label: 'Select violation type first' }]

  return (
    <Card padding="lg">
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        <FormSection title="Incident Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <SelectField
                label="Employee"
                name="employeeId"
                required
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                defaultValue={preselectedEmployeeId || undefined}
              />
            </div>
            <SelectField
              label="Violation Type"
              name="violationType"
              required
              options={violationTypeOptions}
              placeholder="Select type..."
              onChange={(e) => setSelectedViolationType(e.target.value)}
            />
            <SelectField
              label="Specific Reason"
              name="violationReason"
              required
              options={reasonOptions}
              placeholder="Select reason..."
            />
            <SelectField
              label="Severity"
              name="severity"
              required
              options={severityOptions}
              defaultValue="MODERATE"
            />
            <FormField
              label="Incident Date"
              name="incidentDate"
              type="date"
              required
            />
            <FormField
              label="Reported By"
              name="reportedBy"
              required
              placeholder="Manager or witness name"
            />
            <SelectField
              label="Status"
              name="status"
              required
              options={statusOptions}
              defaultValue="OPEN"
            />
          </div>
        </FormSection>

        <CardDivider />

        <FormSection title="Incident Description">
          <div className="space-y-5">
            <TextareaField
              label="Description"
              name="description"
              required
              rows={4}
              placeholder="Detailed description of the incident..."
            />
            <FormField
              label="Witnesses"
              name="witnesses"
              placeholder="Names of witnesses (if any)"
            />
            <FormField
              label="Evidence"
              name="evidence"
              placeholder="Reference to evidence (file names, locations)"
            />
          </div>
        </FormSection>

        <CardDivider />

        <FormSection title="Action Taken">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SelectField
              label="Action Type"
              name="actionTaken"
              required
              options={actionTypeOptions}
              defaultValue="VERBAL_WARNING"
            />
            <FormField
              label="Action Date"
              name="actionDate"
              type="date"
            />
            <div className="sm:col-span-2">
              <TextareaField
                label="Action Details"
                name="actionDetails"
                rows={3}
                placeholder="Details of the disciplinary action taken..."
              />
            </div>
          </div>
        </FormSection>

        <CardDivider />

        <FormSection title="Follow-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField
              label="Follow-up Date"
              name="followUpDate"
              type="date"
            />
            <div className="sm:col-span-2">
              <TextareaField
                label="Follow-up Notes"
                name="followUpNotes"
                rows={2}
                placeholder="Notes for follow-up review..."
              />
            </div>
            <div className="sm:col-span-2">
              <TextareaField
                label="Resolution"
                name="resolution"
                rows={2}
                placeholder="Final resolution (if closed)..."
              />
            </div>
          </div>
        </FormSection>

        <FormActions>
          <Button variant="secondary" onClick={goBack}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving...' : 'Save Record'}
          </Button>
        </FormActions>
      </form>
    </Card>
  )
}

export default function AddDisciplinaryPage() {
  return (
    <>
      <PageHeader
        title="Report Violation"
        description="Disciplinary"
        icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl">
        <Suspense fallback={
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
            </div>
          </Card>
        }>
          <AddDisciplinaryForm />
        </Suspense>
      </div>
    </>
  )
}
