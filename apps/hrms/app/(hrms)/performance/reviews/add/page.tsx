'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PerformanceReviewsApi, EmployeesApi, type Employee } from '@/lib/api-client'
import { ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons'
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

const reviewTypeOptions = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'PIP', label: 'Performance Improvement Plan' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
]

function RatingInput({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            {star <= value ? (
              <StarFilledIcon className="h-6 w-6 text-amber-400" />
            ) : (
              <StarIcon className="h-6 w-6 text-slate-300 hover:text-amber-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500">{value}/5</span>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}

export default function AddReviewPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  // Rating states
  const [overallRating, setOverallRating] = useState(3)
  const [qualityOfWork, setQualityOfWork] = useState(3)
  const [productivity, setProductivity] = useState(3)
  const [communication, setCommunication] = useState(3)
  const [teamwork, setTeamwork] = useState(3)
  const [initiative, setInitiative] = useState(3)
  const [attendance, setAttendance] = useState(3)

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
      await PerformanceReviewsApi.create({
        employeeId: String(payload.employeeId),
        reviewType: String(payload.reviewType),
        reviewPeriod: String(payload.reviewPeriod),
        reviewDate: String(payload.reviewDate),
        reviewerName: String(payload.reviewerName),
        overallRating: parseInt(payload.overallRating, 10),
        qualityOfWork: parseInt(payload.qualityOfWork, 10),
        productivity: parseInt(payload.productivity, 10),
        communication: parseInt(payload.communication, 10),
        teamwork: parseInt(payload.teamwork, 10),
        initiative: parseInt(payload.initiative, 10),
        attendance: parseInt(payload.attendance, 10),
        strengths: payload.strengths || null,
        areasToImprove: payload.areasToImprove || null,
        goals: payload.goals || null,
        comments: payload.comments || null,
        status: String(payload.status),
      })
      router.push('/performance/reviews')
    } catch (e: any) {
      setError(e.message || 'Failed to create review')
    } finally {
      setSubmitting(false)
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
  }))

  return (
    <>
      <PageHeader
        title="New Performance Review"
        description="Performance"
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        backHref="/performance/reviews"
      />

      <div className="max-w-3xl">
        <Card padding="lg">
          {error && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-8">
            <FormSection title="Review Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <SelectField
                    label="Employee"
                    name="employeeId"
                    required
                    options={employeeOptions}
                    placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                  />
                </div>
                <SelectField
                  label="Review Type"
                  name="reviewType"
                  required
                  options={reviewTypeOptions}
                  defaultValue="ANNUAL"
                />
                <FormField
                  label="Review Period"
                  name="reviewPeriod"
                  required
                  placeholder="e.g., Q4 2025, Annual 2025"
                />
                <FormField
                  label="Review Date"
                  name="reviewDate"
                  type="date"
                  required
                />
                <FormField
                  label="Reviewer Name"
                  name="reviewerName"
                  required
                  placeholder="Manager name"
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue="DRAFT"
                />
              </div>
            </FormSection>

            <CardDivider />

            <FormSection title="Performance Ratings" description="Rate the employee on a scale of 1-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <RatingInput name="overallRating" label="Overall Rating" value={overallRating} onChange={setOverallRating} />
                </div>
                <RatingInput name="qualityOfWork" label="Quality of Work" value={qualityOfWork} onChange={setQualityOfWork} />
                <RatingInput name="productivity" label="Productivity" value={productivity} onChange={setProductivity} />
                <RatingInput name="communication" label="Communication" value={communication} onChange={setCommunication} />
                <RatingInput name="teamwork" label="Teamwork" value={teamwork} onChange={setTeamwork} />
                <RatingInput name="initiative" label="Initiative" value={initiative} onChange={setInitiative} />
                <RatingInput name="attendance" label="Attendance" value={attendance} onChange={setAttendance} />
              </div>
            </FormSection>

            <CardDivider />

            <FormSection title="Feedback" description="Detailed comments and goals">
              <div className="space-y-5">
                <TextareaField
                  label="Strengths"
                  name="strengths"
                  rows={3}
                  placeholder="Key strengths demonstrated..."
                />
                <TextareaField
                  label="Areas to Improve"
                  name="areasToImprove"
                  rows={3}
                  placeholder="Areas that need development..."
                />
                <TextareaField
                  label="Goals for Next Period"
                  name="goals"
                  rows={3}
                  placeholder="Objectives and targets..."
                />
                <TextareaField
                  label="Additional Comments"
                  name="comments"
                  rows={3}
                  placeholder="Any other observations..."
                />
              </div>
            </FormSection>

            <FormActions>
              <Button variant="secondary" href="/performance/reviews">
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Review'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
