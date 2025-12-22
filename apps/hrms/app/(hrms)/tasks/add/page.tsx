'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TasksApi, EmployeesApi, type Employee } from '@/lib/api-client'
import { CheckCircleIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormActions, FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'

const categoryOptions = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'OFFBOARDING', label: 'Offboarding' },
  { value: 'CASE', label: 'Case' },
  { value: 'POLICY', label: 'Policy' },
]

export default function AddTaskPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await EmployeesApi.listManageable()
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
      const created = await TasksApi.create({
        title: String(payload.title),
        description: payload.description ? String(payload.description) : null,
        category: payload.category ? String(payload.category) : undefined,
        dueDate: payload.dueDate ? String(payload.dueDate) : null,
        assignedToId: payload.assignedToId ? String(payload.assignedToId) : null,
        subjectEmployeeId: payload.subjectEmployeeId ? String(payload.subjectEmployeeId) : null,
      })
      router.push(`/tasks/${created.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create task')
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
        title="New Task"
        description="Work"
        icon={<CheckCircleIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <Card padding="lg">
        {error && (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-8">
          <FormSection title="Task Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <FormField
                  label="Title"
                  name="title"
                  required
                  placeholder="e.g., Collect signed NDA"
                />
              </div>

              <SelectField
                label="Category"
                name="category"
                options={categoryOptions}
                defaultValue="GENERAL"
              />

              <FormField
                label="Due Date"
                name="dueDate"
                type="date"
              />

              <SelectField
                label="Assigned To"
                name="assignedToId"
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
              />

              <SelectField
                label="Subject Employee (optional)"
                name="subjectEmployeeId"
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
              />

              <div className="sm:col-span-2">
                <TextareaField
                  label="Description"
                  name="description"
                  rows={4}
                  placeholder="Add more detail..."
                />
              </div>
            </div>
          </FormSection>

          <FormActions>
            <Button variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Saving...' : 'Create Task'}
            </Button>
          </FormActions>
        </form>
      </Card>
    </>
  )
}

