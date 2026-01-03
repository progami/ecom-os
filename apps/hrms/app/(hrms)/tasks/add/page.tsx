'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MeApi, TasksApi, EmployeesApi, type Employee, type Me } from '@/lib/api-client'
import { CheckCircleIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormActions, FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'

const categoryOptions = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CASE', label: 'Case' },
  { value: 'POLICY', label: 'Policy' },
]

type TaskTemplateId = '' | 'POLICY_FOLLOW_UP'

type TaskTemplate = {
  title: string
  description: string
  category: string
  dueInDays?: number
}

const TASK_TEMPLATES: Record<Exclude<TaskTemplateId, ''>, TaskTemplate> = {
  POLICY_FOLLOW_UP: {
    title: 'Policy: Follow up on acknowledgement',
    description: 'Ensure the required policy is read and acknowledged.',
    category: 'POLICY',
    dueInDays: 3,
  },
}

const templateOptions = [
  { value: '', label: 'None (blank task)' },
  { value: 'POLICY_FOLLOW_UP', label: 'Policy follow-up (starter)' },
]

function addDaysISO(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function AddTaskPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  const [templateId, setTemplateId] = useState<TaskTemplateId>('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    dueDate: '',
    assignedToId: '',
    subjectEmployeeId: '',
  })

  useEffect(() => {
    async function loadEmployees() {
      try {
        const [meData, data] = await Promise.all([MeApi.get(), EmployeesApi.listManageable()])
        setMe(meData)
        setEmployees(data.items || [])
        setForm((p) => (p.assignedToId ? p : { ...p, assignedToId: meData.id }))
      } catch (e) {
        console.error('Failed to load employees:', e)
      } finally {
        setLoadingEmployees(false)
      }
    }
    loadEmployees()
  }, [])

  function applyTemplate(nextTemplateId: TaskTemplateId) {
    setTemplateId(nextTemplateId)

    if (!nextTemplateId) return

    const tpl = TASK_TEMPLATES[nextTemplateId]
    setForm((p) => ({
      ...p,
      title: tpl.title,
      description: tpl.description,
      category: tpl.category,
      dueDate: tpl.dueInDays ? addDaysISO(tpl.dueInDays) : p.dueDate,
    }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const created = await TasksApi.create({
        title: form.title,
        description: form.description ? form.description : null,
        category: form.category ? form.category : undefined,
        dueDate: form.dueDate ? form.dueDate : null,
        assignedToId: form.assignedToId ? form.assignedToId : null,
        subjectEmployeeId: form.subjectEmployeeId ? form.subjectEmployeeId : null,
      })
      router.push(`/tasks/${created.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const employeeOptions: { value: string; label: string }[] = []
  if (me) {
    employeeOptions.push({
      value: me.id,
      label: `Me (${me.employeeId})`,
    })
  }
  for (const e of employees) {
    employeeOptions.push({
      value: e.id,
      label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
    })
  }

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
                <SelectField
                  label="Template (optional)"
                  name="templateId"
                  options={templateOptions}
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value as TaskTemplateId)}
                />
              </div>

              <div className="sm:col-span-2">
                <FormField
                  label="Title"
                  name="title"
                  required
                  placeholder="e.g., Collect signed NDA"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <SelectField
                label="Category"
                name="category"
                options={categoryOptions}
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />

              <FormField
                label="Due Date"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              />

              <SelectField
                label="Assigned To"
                name="assignedToId"
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'Unassigned'}
                value={form.assignedToId}
                onChange={(e) => setForm((p) => ({ ...p, assignedToId: e.target.value }))}
              />

              <SelectField
                label="Subject Employee (optional)"
                name="subjectEmployeeId"
                options={employeeOptions}
                placeholder={loadingEmployees ? 'Loading employees...' : 'None'}
                value={form.subjectEmployeeId}
                onChange={(e) => setForm((p) => ({ ...p, subjectEmployeeId: e.target.value }))}
              />

              <div className="sm:col-span-2">
                <TextareaField
                  label="Description"
                  name="description"
                  rows={4}
                  placeholder="Add more detail..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
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
