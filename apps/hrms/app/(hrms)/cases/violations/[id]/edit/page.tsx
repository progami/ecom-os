'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DisciplinaryActionsApi, type DisciplinaryAction } from '@/lib/api-client'
import { ShieldExclamationIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  CheckboxGroupField,
  FormActions,
  FormField,
  FormSection,
  SelectField,
  TextareaField,
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
  SUBSTANCE_ABUSE: [{ value: 'SUBSTANCE_USE_AT_WORK', label: 'Substance Use at Work' }],
  INSUBORDINATION: [
    { value: 'FAILURE_TO_FOLLOW_INSTRUCTIONS', label: 'Failure to Follow Instructions' },
    { value: 'DISRUPTIVE_CONDUCT', label: 'Disruptive Conduct' },
  ],
  OTHER: [{ value: 'OTHER', label: 'Other' }],
}

const coreValueBreachedOptions = [
  { value: 'BREACH_OF_DETAIL', label: 'Attention to Detail' },
  { value: 'BREACH_OF_COURAGE', label: 'Courage' },
  { value: 'BREACH_OF_HONESTY', label: 'Honesty' },
  { value: 'BREACH_OF_INTEGRITY', label: 'Integrity' },
]

const severityOptions = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
]

const actionOptions = [
  { value: 'VERBAL_WARNING', label: 'Verbal Warning' },
  { value: 'WRITTEN_WARNING', label: 'Written Warning' },
  { value: 'FINAL_WARNING', label: 'Final Warning' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'TERMINATION', label: 'Termination' },
]

function formatDateForInput(dateStr?: string | null) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0]
}

export default function EditViolationPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { goBack } = useNavigationHistory()

  const [record, setRecord] = useState<DisciplinaryAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedViolationType, setSelectedViolationType] = useState('')
  const [selectedValuesBreached, setSelectedValuesBreached] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await DisciplinaryActionsApi.get(id)
        setRecord(data)
        setSelectedViolationType(data.violationType)
        setSelectedValuesBreached(data.valuesBreached || [])
      } catch (e: any) {
        setError(e.message || 'Failed to load violation record')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const isEditable = record?.status === 'PENDING_HR_REVIEW'

  const reasonOptions = useMemo(() => {
    if (!selectedViolationType) return [{ value: '', label: 'Select violation type first' }]
    return violationReasonOptions[selectedViolationType] || [{ value: 'OTHER', label: 'Other' }]
  }, [selectedViolationType])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!record) return
    if (!isEditable) return

    if (selectedValuesBreached.length === 0) {
      setError('Please select at least one core value that was breached')
      return
    }

    setSaving(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      const updated = await DisciplinaryActionsApi.update(id, {
        violationType: String(payload.violationType),
        violationReason: String(payload.violationReason),
        valuesBreached: selectedValuesBreached,
        severity: String(payload.severity),
        incidentDate: String(payload.incidentDate),
        reportedBy: String(payload.reportedBy),
        description: String(payload.description),
        witnesses: payload.witnesses || null,
        evidence: payload.evidence || null,
        actionTaken: String(payload.actionTaken),
      })
      setRecord(updated)

      if (updated.caseId) {
        router.push(`/cases/${updated.caseId}`)
        return
      }

      router.push('/cases?caseType=VIOLATION')
    } catch (e: any) {
      setError(e.message || 'Failed to update violation record')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Violation"
          description="Loading..."
          icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </Card>
        </div>
      </>
    )
  }

  if (!record) {
    return (
      <>
        <PageHeader
          title="Edit Violation"
          description="Not Found"
          icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Violation record not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Edit Violation"
        description={`${record.employee?.firstName ?? ''} ${record.employee?.lastName ?? ''}`.trim()}
        icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!isEditable && (
          <Alert variant="warning">
            Editing is locked once HR review begins. Current status: {record.status.replace(/_/g, ' ')}.
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <Card padding="lg" className="mb-6">
            <FormSection title="Employee">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">Employee</label>
                  <div className="px-4 py-3 bg-muted border border-border rounded-lg text-sm text-foreground">
                    {record.employee
                      ? `${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeId})`
                      : record.employeeId}
                  </div>
                </div>
              </div>
            </FormSection>
          </Card>

          <Card padding="lg">
            <FormSection title="Incident Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SelectField
                  label="Violation Type"
                  name="violationType"
                  required
                  options={violationTypeOptions}
                  value={selectedViolationType}
                  onChange={(e) => setSelectedViolationType(e.target.value)}
                  disabled={!isEditable}
                />
                <SelectField
                  key={selectedViolationType}
                  label="Specific Reason"
                  name="violationReason"
                  required
                  options={reasonOptions}
                  placeholder="Select reason..."
                  defaultValue={record.violationReason}
                  disabled={!isEditable}
                />
                <div className="sm:col-span-2">
                  <CheckboxGroupField
                    label="Core Values Breached"
                    name="valuesBreached"
                    required
                    options={coreValueBreachedOptions}
                    value={selectedValuesBreached}
                    onChange={setSelectedValuesBreached}
                  />
                </div>
                <SelectField label="Severity" name="severity" required options={severityOptions} defaultValue={record.severity} disabled={!isEditable} />
                <SelectField
                  label="Recommended Action"
                  name="actionTaken"
                  required
                  options={actionOptions}
                  defaultValue={record.actionTaken}
                  disabled={!isEditable}
                />
                <FormField
                  label="Incident Date"
                  name="incidentDate"
                  type="date"
                  required
                  defaultValue={formatDateForInput(record.incidentDate)}
                  disabled={!isEditable}
                />
                <FormField label="Reported By" name="reportedBy" required defaultValue={record.reportedBy} disabled={!isEditable} />
              </div>
            </FormSection>

            <CardDivider />

            <FormSection title="Incident Description">
              <div className="space-y-5">
                <TextareaField label="Description" name="description" required rows={4} defaultValue={record.description} disabled={!isEditable} />
                <FormField
                  label="Witnesses"
                  name="witnesses"
                  placeholder="Names of witnesses (if any)"
                  defaultValue={record.witnesses || ''}
                  disabled={!isEditable}
                />
                <FormField
                  label="Evidence"
                  name="evidence"
                  placeholder="Reference to evidence (file names, locations)"
                  defaultValue={record.evidence || ''}
                  disabled={!isEditable}
                />
              </div>
            </FormSection>

            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} disabled={!isEditable}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              {!isEditable && (
                <Button href={record.caseId ? `/cases/${record.caseId}` : '/cases?caseType=VIOLATION'} variant="secondary">
                  View Record
                </Button>
              )}
            </FormActions>
          </Card>
        </form>
      </div>
    </>
  )
}

