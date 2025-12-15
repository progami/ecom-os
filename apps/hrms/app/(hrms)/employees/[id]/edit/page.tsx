'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { EmployeesApi, DepartmentsApi, ProjectsApi, type Employee, type Department, type Project } from '@/lib/api-client'
import { UsersIcon, PlusIcon, XIcon, LockClosedIcon } from '@/components/ui/Icons'
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

type FieldPermissions = Record<string, { canEdit: boolean; permission: string; reason?: string }>

function LockedFieldBadge({ reason }: { reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 ml-2" title={reason}>
      <LockClosedIcon className="h-3 w-3" />
      {reason === 'This field is synced from Google Admin and cannot be edited' ? 'Google' : 'Locked'}
    </span>
  )
}

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
  const [additionalDepartments, setAdditionalDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Permission state
  const [permissions, setPermissions] = useState<{
    isEditingSelf: boolean
    isManager: boolean
    isSuperAdmin: boolean
    fieldPermissions: FieldPermissions
    editableFields: string[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [data, employeesRes, deptsRes, projectsRes, membershipsRes, permsRes] = await Promise.all([
          EmployeesApi.get(id),
          EmployeesApi.list({ take: 200 }),
          DepartmentsApi.list(),
          ProjectsApi.list(),
          EmployeesApi.getProjectMemberships(id),
          EmployeesApi.getPermissions(id),
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
        setPermissions({
          isEditingSelf: permsRes.isEditingSelf,
          isManager: permsRes.isManager,
          isSuperAdmin: permsRes.isSuperAdmin,
          fieldPermissions: permsRes.fieldPermissions,
          editableFields: permsRes.editableFields,
        })
      } catch (e: any) {
        setError(e.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const canEdit = (field: string) => permissions?.fieldPermissions[field]?.canEdit ?? false
  const getFieldReason = (field: string) => permissions?.fieldPermissions[field]?.reason

  // Check if user can edit any fields in a group
  const canEditGroup = (fields: string[]) => fields.some(f => canEdit(f))

  // Organization fields: department, reportsToId
  const canEditOrganization = canEdit('department') || canEdit('reportsToId')
  // Employment fields: position, joinDate, employmentType, status
  const canEditEmployment = canEdit('position') || canEdit('joinDate') || canEdit('employmentType') || canEdit('status')
  // Personal fields: phone, address, etc.
  const canEditPersonal = canEdit('phone') || canEdit('address') || canEdit('dateOfBirth')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, any> = {}

    // Only include fields the user can edit
    if (canEdit('phone')) payload.phone = fd.get('phone') ? String(fd.get('phone')) : undefined
    if (canEdit('address')) payload.address = fd.get('address') ? String(fd.get('address')) : undefined
    if (canEdit('city')) payload.city = fd.get('city') ? String(fd.get('city')) : undefined
    if (canEdit('country')) payload.country = fd.get('country') ? String(fd.get('country')) : undefined
    if (canEdit('postalCode')) payload.postalCode = fd.get('postalCode') ? String(fd.get('postalCode')) : undefined
    if (canEdit('emergencyContact')) payload.emergencyContact = fd.get('emergencyContact') ? String(fd.get('emergencyContact')) : undefined
    if (canEdit('emergencyPhone')) payload.emergencyPhone = fd.get('emergencyPhone') ? String(fd.get('emergencyPhone')) : undefined
    if (canEdit('dateOfBirth')) payload.dateOfBirth = fd.get('dateOfBirth') ? String(fd.get('dateOfBirth')) : undefined

    // Organization/Employment fields (manager only)
    if (canEdit('department')) payload.department = fd.get('department') ? String(fd.get('department')) : undefined
    if (canEdit('position')) payload.position = fd.get('position') ? String(fd.get('position')) : undefined
    if (canEdit('joinDate')) payload.joinDate = fd.get('joinDate') ? String(fd.get('joinDate')) : undefined
    if (canEdit('employmentType')) payload.employmentType = fd.get('employmentType') ? String(fd.get('employmentType')) : undefined
    if (canEdit('status')) payload.status = fd.get('status') ? String(fd.get('status')) : undefined
    if (canEdit('reportsToId')) {
      const reportsToId = fd.get('reportsToId')
      payload.reportsToId = reportsToId ? String(reportsToId) : null
    }

    try {
      // Update employee info
      await EmployeesApi.update(id, payload)

      // Update project memberships if user can manage
      if (canEditOrganization) {
        await EmployeesApi.updateProjectMemberships(
          id,
          projectMemberships
            .filter((m) => m.projectId)
            .map((m) => ({
              projectId: m.projectId,
              role: String(fd.get('position') || employee?.position),
            }))
        )
      }

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

  if (!employee || !permissions) {
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
        description={`${employee.firstName} ${employee.lastName}`}
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
            {/* Identity (Google Controlled - Always Read Only) */}
            <FormSection
              title="Identity"
              description="Synced from Google Workspace - cannot be edited here"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label={<>Employee ID <LockedFieldBadge reason="Auto-generated" /></>}
                  name="employeeId"
                  defaultValue={employee.employeeId}
                  disabled
                />
                <FormField
                  label={<>Email <LockedFieldBadge reason={getFieldReason('email')} /></>}
                  name="email"
                  type="email"
                  defaultValue={employee.email}
                  disabled
                />
                <FormField
                  label={<>First Name <LockedFieldBadge reason={getFieldReason('firstName')} /></>}
                  name="firstName"
                  defaultValue={employee.firstName}
                  disabled
                />
                <FormField
                  label={<>Last Name <LockedFieldBadge reason={getFieldReason('lastName')} /></>}
                  name="lastName"
                  defaultValue={employee.lastName}
                  disabled
                />
              </div>
            </FormSection>

            {/* Personal Information - Always visible, editable based on permissions */}
            <CardDivider />
            <FormSection
              title="Personal Information"
              description={canEditPersonal ? "Contact details and personal information" : "Contact details and personal information (view only)"}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label={<>Phone {!canEdit('phone') && <LockedFieldBadge reason={getFieldReason('phone')} />}</>}
                  name="phone"
                  type="tel"
                  defaultValue={(employee as any).phone || ''}
                  placeholder="+1 (555) 000-0000"
                  disabled={!canEdit('phone')}
                />
                <FormField
                  label={<>Date of Birth {!canEdit('dateOfBirth') && <LockedFieldBadge reason={getFieldReason('dateOfBirth')} />}</>}
                  name="dateOfBirth"
                  type="date"
                  defaultValue={(employee as any).dateOfBirth?.split('T')[0] || ''}
                  disabled={!canEdit('dateOfBirth')}
                />
                <div className="sm:col-span-2">
                  <FormField
                    label={<>Address {!canEdit('address') && <LockedFieldBadge reason={getFieldReason('address')} />}</>}
                    name="address"
                    defaultValue={(employee as any).address || ''}
                    disabled={!canEdit('address')}
                  />
                </div>
                <FormField
                  label={<>City {!canEdit('city') && <LockedFieldBadge reason={getFieldReason('city')} />}</>}
                  name="city"
                  defaultValue={(employee as any).city || ''}
                  disabled={!canEdit('city')}
                />
                <FormField
                  label={<>Country {!canEdit('country') && <LockedFieldBadge reason={getFieldReason('country')} />}</>}
                  name="country"
                  defaultValue={(employee as any).country || ''}
                  disabled={!canEdit('country')}
                />
                <FormField
                  label={<>Postal Code {!canEdit('postalCode') && <LockedFieldBadge reason={getFieldReason('postalCode')} />}</>}
                  name="postalCode"
                  defaultValue={(employee as any).postalCode || ''}
                  disabled={!canEdit('postalCode')}
                />
              </div>

              {/* Emergency Contact */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    label={<>Contact Name {!canEdit('emergencyContact') && <LockedFieldBadge reason={getFieldReason('emergencyContact')} />}</>}
                    name="emergencyContact"
                    defaultValue={(employee as any).emergencyContact || ''}
                    disabled={!canEdit('emergencyContact')}
                  />
                  <FormField
                    label={<>Contact Phone {!canEdit('emergencyPhone') && <LockedFieldBadge reason={getFieldReason('emergencyPhone')} />}</>}
                    name="emergencyPhone"
                    type="tel"
                    defaultValue={(employee as any).emergencyPhone || ''}
                    disabled={!canEdit('emergencyPhone')}
                  />
                </div>
              </div>
            </FormSection>

            {/* Organization Structure (Manager Editable) */}
            {canEditOrganization && (
              <>
                <CardDivider />
                <FormSection
                  title="Organization Structure"
                  description="Department assignments, projects, and reporting hierarchy"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {canEdit('department') && (
                      <SelectField
                        label="Primary Department"
                        name="department"
                        required
                        options={departments.map((dept) => ({
                          value: dept.name,
                          label: dept.name,
                        }))}
                        defaultValue={employee.department || ''}
                      />
                    )}
                    {canEdit('reportsToId') && (
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
                    )}
                  </div>

                  {/* Project Assignments */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Project Assignments</h4>
                    <div className="space-y-3">
                      {projectMemberships.map((membership, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <select
                              value={membership.projectId}
                              onChange={(e) => updateProjectMembership(index, e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            >
                              <option value="">Select project...</option>
                              {availableProjects(index).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.code ? `(${p.code})` : ''}
                                </option>
                              ))}
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
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove project"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {projects.length > 0 && projectMemberships.length < projects.length && (
                        <button
                          type="button"
                          onClick={addProjectMembership}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Project
                        </button>
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
                  </div>
                </FormSection>
              </>
            )}

            {/* Employment Details (Manager Editable) */}
            {canEditEmployment && (
              <>
                <CardDivider />
                <FormSection
                  title="Employment Details"
                  description="Job position and employment status"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {canEdit('position') && (
                      <FormField
                        label="Position"
                        name="position"
                        required
                        defaultValue={employee.position}
                      />
                    )}
                    {canEdit('joinDate') && (
                      <FormField
                        label="Join Date"
                        name="joinDate"
                        type="date"
                        required
                        defaultValue={joinDateFormatted}
                      />
                    )}
                    {canEdit('employmentType') && (
                      <SelectField
                        label="Employment Type"
                        name="employmentType"
                        required
                        options={employmentTypeOptions}
                        defaultValue={employee.employmentType}
                      />
                    )}
                    {canEdit('status') && (
                      <SelectField
                        label="Status"
                        name="status"
                        required
                        options={statusOptions}
                        defaultValue={employee.status}
                      />
                    )}
                  </div>
                </FormSection>
              </>
            )}

            {/* No editable fields message */}
            {!canEditOrganization && !canEditEmployment && !canEditPersonal && (
              <>
                <CardDivider />
                <div className="py-8 text-center">
                  <LockClosedIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">You don't have permission to edit this employee's profile.</p>
                </div>
              </>
            )}

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              {(canEditOrganization || canEditEmployment || canEditPersonal) && (
                <Button type="submit" loading={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
