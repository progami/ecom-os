'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { EmployeesApi, DepartmentsApi, ProjectsApi, type Employee, type Department, type Project, type EmployeeProjectMembership } from '@/lib/api-client'
import { UsersIcon, PlusIcon, XIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  FormField,
  SelectField,
  FormSection,
  FormActions,
} from '@/components/ui/FormField'
import { useNavigationHistory } from '@/lib/navigation-history'
import { employmentTypeOptions, statusOptions } from '@/lib/constants'

export default function EditEmployeePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const params = useParams()
  const id = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectMemberships, setProjectMemberships] = useState<{ projectId: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [data, employeesRes, deptsRes, projectsRes, membershipsRes] = await Promise.all([
          EmployeesApi.get(id),
          EmployeesApi.list({ take: 200 }),
          DepartmentsApi.list(),
          ProjectsApi.list(),
          EmployeesApi.getProjectMemberships(id),
        ])
        setEmployee(data)
        setAllEmployees(employeesRes.items)
        setDepartments(deptsRes.items)
        setProjects(projectsRes.items)
        setProjectMemberships(
          membershipsRes.items.map((m) => ({
            projectId: m.project.id,
          }))
        )
      } catch (e: any) {
        setError(e.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      // Update employee info
      await EmployeesApi.update(id, {
        firstName: String(payload.firstName),
        lastName: String(payload.lastName),
        email: String(payload.email),
        phone: payload.phone ? String(payload.phone) : undefined,
        department: String(payload.department || ''),
        position: String(payload.position),
        joinDate: String(payload.joinDate),
        employmentType: String(payload.employmentType || 'FULL_TIME'),
        status: String(payload.status || 'ACTIVE'),
        reportsToId: payload.reportsToId ? String(payload.reportsToId) : null,
      })

      // Update project memberships - use employee's position as role
      await EmployeesApi.updateProjectMemberships(
        id,
        projectMemberships
          .filter((m) => m.projectId) // Only include valid memberships
          .map((m) => ({
            projectId: m.projectId,
            role: String(payload.position), // Use employee's position
          }))
      )

      router.push(`/employees/${id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
  }

  function addProjectMembership() {
    setProjectMemberships([...projectMemberships, { projectId: '' }])
  }

  function removeProjectMembership(index: number) {
    setProjectMemberships(projectMemberships.filter((_, i) => i !== index))
  }

  function updateProjectMembership(index: number, projectId: string) {
    const updated = [...projectMemberships]
    updated[index] = { projectId }
    setProjectMemberships(updated)
  }

  // Get projects not already assigned
  const availableProjects = (index: number) => {
    const assignedProjectIds = projectMemberships
      .filter((_, i) => i !== index)
      .map((m) => m.projectId)
    return projects.filter((p) => !assignedProjectIds.includes(p.id))
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Employee"
          description="People"
          icon={<UsersIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-10 bg-slate-200 rounded" />
            </div>
          </Card>
        </div>
      </>
    )
  }

  if (!employee) {
    return (
      <>
        <PageHeader
          title="Edit Employee"
          description="People"
          icon={<UsersIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Employee not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  const joinDateFormatted = employee.joinDate ? employee.joinDate.split('T')[0] : ''

  return (
    <>
      <PageHeader
        title="Edit Employee"
        description="People"
        icon={<UsersIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl">
        <Card padding="lg">
          {error && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-8">
            {/* Basic Info */}
            <FormSection title="Basic Information" description="Personal details of the employee">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label="Employee ID"
                  name="employeeId"
                  defaultValue={employee.employeeId}
                  disabled
                  hint="Auto-generated, cannot be changed"
                />
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  required
                  defaultValue={employee.email}
                />
                <FormField
                  label="First Name"
                  name="firstName"
                  required
                  defaultValue={employee.firstName}
                />
                <FormField
                  label="Last Name"
                  name="lastName"
                  required
                  defaultValue={employee.lastName}
                />
                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  defaultValue={employee.phone || ''}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Work Info */}
            <FormSection title="Work Information" description="Job-related details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SelectField
                  label="Department"
                  name="department"
                  required
                  options={departments.map((dept) => ({
                    value: dept.name,
                    label: dept.name,
                  }))}
                  defaultValue={employee.department || ''}
                />
                <FormField
                  label="Position"
                  name="position"
                  required
                  defaultValue={employee.position}
                />
                <FormField
                  label="Join Date"
                  name="joinDate"
                  type="date"
                  required
                  defaultValue={joinDateFormatted}
                />
                <SelectField
                  label="Employment Type"
                  name="employmentType"
                  required
                  options={employmentTypeOptions}
                  defaultValue={employee.employmentType}
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue={employee.status}
                />
                <SelectField
                  label="Reports To"
                  name="reportsToId"
                  options={[
                    { value: '', label: 'No Manager (Top Level)' },
                    ...allEmployees
                      .filter((emp) => emp.id !== id)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName} (${emp.position})`,
                      })),
                  ]}
                  defaultValue={employee.reportsToId || ''}
                />
              </div>
            </FormSection>

            <CardDivider />

            {/* Project Assignments */}
            <FormSection title="Project Assignments" description="Assign this employee to projects">
              <div className="space-y-4">
                {projectMemberships.map((membership, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Project
                      </label>
                      <select
                        value={membership.projectId}
                        onChange={(e) => updateProjectMembership(index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      >
                        <option value="">Select project...</option>
                        {availableProjects(index).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.code ? `(${p.code})` : ''}
                          </option>
                        ))}
                        {/* Include current selection even if filtered out */}
                        {membership.projectId && !availableProjects(index).find((p) => p.id === membership.projectId) && (
                          <option value={membership.projectId}>
                            {projects.find((p) => p.id === membership.projectId)?.name || membership.projectId}
                          </option>
                        )}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProjectMembership(index)}
                      className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove project"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}

                {projects.length > 0 && projectMemberships.length < projects.length && (
                  <button
                    type="button"
                    onClick={addProjectMembership}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Project Assignment
                  </button>
                )}

                {projects.length === 0 && (
                  <p className="text-sm text-slate-500">No projects available. Create projects first.</p>
                )}

                {projectMemberships.length === 0 && projects.length > 0 && (
                  <p className="text-sm text-slate-500">
                    No projects assigned.{' '}
                    <button
                      type="button"
                      onClick={addProjectMembership}
                      className="text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Add one
                    </button>
                  </p>
                )}
              </div>
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
