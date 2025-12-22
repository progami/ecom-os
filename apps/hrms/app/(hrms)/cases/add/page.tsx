'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CasesApi, EmployeesApi, MeApi, type Employee, type Me } from '@/lib/api-client'
import { ExclamationTriangleIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormActions, FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'

const caseTypeOptions = [
  { value: 'VIOLATION', label: 'Violation' },
  { value: 'GRIEVANCE', label: 'Grievance' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'REQUEST', label: 'Request' },
  { value: 'OTHER', label: 'Other' },
]

const severityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

export default function AddCasePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [meData, employeesData] = await Promise.all([
          MeApi.get(),
          EmployeesApi.listManageable(),
        ])
        setMe(meData)
        setEmployees(employeesData.items || [])
      } catch (e) {
        console.error('Failed to load form dependencies', e)
      } finally {
        setLoadingEmployees(false)
      }
    }
    load()
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      const created = await CasesApi.create({
        caseType: String(payload.caseType),
        severity: String(payload.severity),
        subjectEmployeeId: payload.subjectEmployeeId ? String(payload.subjectEmployeeId) : null,
        assignedToId: payload.assignedToId ? String(payload.assignedToId) : null,
        title: String(payload.title),
        description: payload.description ? String(payload.description) : null,
      })
      router.push(`/cases/${created.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create case')
    } finally {
      setSubmitting(false)
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
  }))

  const canAssign = Boolean(me?.isHR || me?.isSuperAdmin)

  return (
    <>
      <PageHeader
        title="New Case"
        description="Performance"
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <Card padding="lg">
        {error && (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          <FormSection title="Case Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SelectField
                label="Case Type"
                name="caseType"
                required
                options={caseTypeOptions}
                defaultValue="VIOLATION"
              />

              <SelectField
                label="Severity"
                name="severity"
                required
                options={severityOptions}
                defaultValue="MEDIUM"
              />

              <div className="sm:col-span-2">
                <SelectField
                  label="Subject Employee"
                  name="subjectEmployeeId"
                  required
                  options={employeeOptions}
                  placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                />
              </div>

              {canAssign && (
                <div className="sm:col-span-2">
                  <SelectField
                    label="Assign To (optional)"
                    name="assignedToId"
                    options={employeeOptions}
                    placeholder={loadingEmployees ? 'Loading employees...' : 'Select assignee...'}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <FormField
                  label="Title"
                  name="title"
                  required
                  placeholder="Brief summary of the case"
                />
              </div>

              <div className="sm:col-span-2">
                <TextareaField
                  label="Description"
                  name="description"
                  rows={5}
                  placeholder="Add context, dates, and relevant details..."
                />
              </div>
            </div>
          </FormSection>

          <FormActions>
            <Button variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Creating...' : 'Create Case'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </>
  )
}

