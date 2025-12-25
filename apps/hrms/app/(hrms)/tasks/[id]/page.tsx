'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EmployeesApi, MeApi, TasksApi, type Employee, type Me, type Task } from '@/lib/api-client'
import { CheckCircleIcon, TrashIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FormField, FormSection, SelectField, TextareaField } from '@/components/ui/FormField'
import { StatusBadge } from '@/components/ui/Badge'

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const categoryOptions = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'OFFBOARDING', label: 'Offboarding' },
  { value: 'CASE', label: 'Case' },
  { value: 'POLICY', label: 'Policy' },
]

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = (params as Record<string, string | string[] | undefined> | null)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [task, setTask] = useState<Task | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = useMemo(() => {
    if (!me || !task) return false
    if (me.isSuperAdmin) return true
    if (me.isHR) return true
    return task.createdById === me.id
  }, [me, task])

  const canUpdateStatus = useMemo(() => {
    if (!me || !task) return false
    if (me.isSuperAdmin) return true
    if (me.isHR) return true
    if (task.createdById === me.id) return true
    return task.assignedToId === me.id
  }, [me, task])

  const employeeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const seen = new Set<string>()

    if (me) {
      options.push({ value: me.id, label: `Me (${me.employeeId})` })
      seen.add(me.id)
    }

    for (const e of employees) {
      if (seen.has(e.id)) continue
      options.push({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeId})` })
      seen.add(e.id)
    }

    if (task?.assignedTo && !seen.has(task.assignedTo.id)) {
      options.push({
        value: task.assignedTo.id,
        label: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
      })
      seen.add(task.assignedTo.id)
    }

    if (task?.subjectEmployee && !seen.has(task.subjectEmployee.id)) {
      options.push({
        value: task.subjectEmployee.id,
        label: `${task.subjectEmployee.firstName} ${task.subjectEmployee.lastName}`,
      })
      seen.add(task.subjectEmployee.id)
    }

    return options
  }, [employees, me, task])

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'OPEN',
    category: 'GENERAL',
    dueDate: '',
    assignedToId: '',
    subjectEmployeeId: '',
  })

  useEffect(() => {
    async function load() {
      if (!id) {
        setError('Invalid task id')
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const [taskData, meData] = await Promise.all([
          TasksApi.get(id),
          MeApi.get(),
        ])
        setTask(taskData)
        setMe(meData)
        setForm({
          title: taskData.title,
          description: taskData.description ?? '',
          status: taskData.status,
          category: taskData.category,
          dueDate: taskData.dueDate ? taskData.dueDate.slice(0, 10) : '',
          assignedToId: taskData.assignedToId ?? '',
          subjectEmployeeId: taskData.subjectEmployeeId ?? '',
        })

        const canEditNow = meData.isSuperAdmin || meData.isHR || taskData.createdById === meData.id
        if (canEditNow) {
          setLoadingEmployees(true)
          try {
            const list = await EmployeesApi.listManageable()
            setEmployees(list.items || [])
          } finally {
            setLoadingEmployees(false)
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load task')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function save(patch: Partial<typeof form>) {
    if (!task) return
    setSaving(true)
    setError(null)
    try {
      const next = { ...form, ...patch }
      const updated = await TasksApi.update(task.id, {
        title: canEdit ? next.title : undefined,
        description: canEdit ? (next.description ? next.description : null) : undefined,
        status: canUpdateStatus ? next.status : undefined,
        category: canEdit ? next.category : undefined,
        dueDate: canEdit ? (next.dueDate ? next.dueDate : null) : undefined,
        assignedToId: canEdit ? (next.assignedToId ? next.assignedToId : null) : undefined,
        subjectEmployeeId: canEdit ? (next.subjectEmployeeId ? next.subjectEmployeeId : null) : undefined,
      })
      setTask(updated)
      setForm({
        title: updated.title,
        description: updated.description ?? '',
        status: updated.status,
        category: updated.category,
        dueDate: updated.dueDate ? updated.dueDate.slice(0, 10) : '',
        assignedToId: updated.assignedToId ?? '',
        subjectEmployeeId: updated.subjectEmployeeId ?? '',
      })
    } catch (e: any) {
      setError(e.message || 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask() {
    if (!task) return
    setSaving(true)
    setError(null)
    try {
      await TasksApi.delete(task.id)
      router.push('/tasks')
    } catch (e: any) {
      setError(e.message || 'Failed to delete task')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Task"
          description="Work"
          icon={<CheckCircleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        </Card>
      </>
    )
  }

  if (!task) {
    return (
      <>
        <PageHeader
          title="Task"
          description="Work"
          icon={<CheckCircleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <p className="text-sm text-gray-600">Task not found.</p>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={task.title}
        description="Work"
        icon={<CheckCircleIcon className="h-6 w-6 text-white" />}
        showBack
        actions={(
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => save({ status: 'IN_PROGRESS' })}
              disabled={!canUpdateStatus || saving}
            >
              Start
            </Button>
            <Button
              onClick={() => save({ status: 'DONE' })}
              disabled={!canUpdateStatus || saving}
            >
              Mark Done
            </Button>
            <Button
              variant="danger"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={deleteTask}
              disabled={!canEdit || saving}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <div className="space-y-6 max-w-4xl">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card padding="md">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <StatusBadge status={task.status} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due</p>
              <p className="text-sm text-gray-900">{formatDate(task.dueDate ?? null)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assigned</p>
              <p className="text-sm text-gray-900">
                {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Completed</p>
              <p className="text-sm text-gray-900">{formatDate(task.completedAt ?? null)}</p>
            </div>
          </div>

          {(task.subjectEmployee || task.case) && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {task.subjectEmployee && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subject</p>
                  <p className="text-sm text-gray-900">
                    {task.subjectEmployee.firstName} {task.subjectEmployee.lastName}
                  </p>
                </div>
              )}
              {task.case && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Case</p>
                  <a className="text-sm text-blue-700 hover:text-blue-800" href={`/cases/${task.case.id}`}>
                    Case #{task.case.caseNumber}: {task.case.title}
                  </a>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card padding="lg">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save({})
            }}
            className="space-y-8"
          >
            <FormSection title="Edit Task" description={canEdit ? 'Update details and status.' : 'You can update status only.'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <FormField
                    label="Title"
                    name="title"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    disabled={!canEdit}
                  />
                </div>

                {canEdit && (
                  <>
                    <SelectField
                      label="Assigned To"
                      name="assignedToId"
                      options={employeeOptions}
                      placeholder={loadingEmployees ? 'Loading employees...' : 'Unassigned'}
                      value={form.assignedToId}
                      onChange={(e) => setForm((p) => ({ ...p, assignedToId: e.target.value }))}
                      disabled={saving || !canEdit}
                    />

                    <SelectField
                      label="Subject Employee (optional)"
                      name="subjectEmployeeId"
                      options={employeeOptions}
                      placeholder={loadingEmployees ? 'Loading employees...' : 'None'}
                      value={form.subjectEmployeeId}
                      onChange={(e) => setForm((p) => ({ ...p, subjectEmployeeId: e.target.value }))}
                      disabled={saving || !canEdit}
                    />
                  </>
                )}

                <SelectField
                  label="Status"
                  name="status"
                  options={statusOptions}
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  disabled={!canUpdateStatus}
                />

                <SelectField
                  label="Category"
                  name="category"
                  options={categoryOptions}
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  disabled={!canEdit}
                />

                <FormField
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  disabled={!canEdit}
                />

                <div className="sm:col-span-2">
                  <TextareaField
                    label="Description"
                    name="description"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={4}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </FormSection>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <Button type="submit" loading={saving} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
