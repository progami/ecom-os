'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { EmployeesApi, DepartmentsApi, ProjectsApi, type Employee, type Department, type Project } from '@/lib/api-client'
import { UsersIcon, PlusIcon, XIcon, LockClosedIcon, BuildingIcon, FolderIcon, UserIcon } from '@/components/ui/Icons'
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
import { employmentTypeOptions, statusOptions, regionOptions } from '@/lib/constants'

type FieldPermissions = Record<string, { canEdit: boolean; permission: string; reason?: string }>

function LockedFieldBadge({ reason }: { reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 ml-2" title={reason}>
      <LockClosedIcon className="h-3 w-3" />
      {reason === 'This field is synced from Google Admin and cannot be edited' ? 'Google' : 'Locked'}
    </span>
  )
}

function SectionIcon({ icon: Icon, color }: { icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className={`p-1.5 rounded-lg ${color}`}>
      <Icon className="h-4 w-4 text-white" />
    </div>
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
  const [projectMemberships, setProjectMemberships] = useState<{ projectId: string; role: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Department head state
  const [isDepartmentHead, setIsDepartmentHead] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')

  // Project lead state - track which projects this employee leads
  const [projectLeadIds, setProjectLeadIds] = useState<Set<string>>(new Set())

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
            role: m.role || '',
          }))
        )
        setPermissions({
          isEditingSelf: permsRes.isEditingSelf,
          isManager: permsRes.isManager,
          isSuperAdmin: permsRes.isSuperAdmin,
          fieldPermissions: permsRes.fieldPermissions,
          editableFields: permsRes.editableFields,
        })

        // Set initial department
        setSelectedDepartment(data.department || '')

        // Check if employee is department head
        const empDept = deptsRes.items.find((d: Department) => d.name === data.department)
        if (empDept && empDept.headId === id) {
          setIsDepartmentHead(true)
        }

        // Check which projects this employee leads
        const leadProjectIds = new Set<string>()
        for (const proj of projectsRes.items) {
          if (proj.leadId === id) {
            leadProjectIds.add(proj.id)
          }
        }
        setProjectLeadIds(leadProjectIds)
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

  // Permission checks
  const canEditPersonHierarchy = canEdit('reportsToId') || canEdit('position') || canEdit('employmentType') || canEdit('status') || canEdit('joinDate') || canEdit('region')
  const canEditDepartment = canEdit('department')
  const canEditProjects = canEdit('department') || canEdit('reportsToId') // Use organization permission for projects
  const canEditPersonal = canEdit('phone') || canEdit('address') || canEdit('dateOfBirth')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, any> = {}

    // Personal fields
    if (canEdit('phone')) payload.phone = fd.get('phone') ? String(fd.get('phone')) : undefined
    if (canEdit('address')) payload.address = fd.get('address') ? String(fd.get('address')) : undefined
    if (canEdit('city')) payload.city = fd.get('city') ? String(fd.get('city')) : undefined
    if (canEdit('country')) payload.country = fd.get('country') ? String(fd.get('country')) : undefined
    if (canEdit('postalCode')) payload.postalCode = fd.get('postalCode') ? String(fd.get('postalCode')) : undefined
    if (canEdit('emergencyContact')) payload.emergencyContact = fd.get('emergencyContact') ? String(fd.get('emergencyContact')) : undefined
    if (canEdit('emergencyPhone')) payload.emergencyPhone = fd.get('emergencyPhone') ? String(fd.get('emergencyPhone')) : undefined
    if (canEdit('dateOfBirth')) payload.dateOfBirth = fd.get('dateOfBirth') ? String(fd.get('dateOfBirth')) : undefined

    // Person hierarchy fields
    if (canEdit('position')) payload.position = fd.get('position') ? String(fd.get('position')) : undefined
    if (canEdit('joinDate')) payload.joinDate = fd.get('joinDate') ? String(fd.get('joinDate')) : undefined
    if (canEdit('employmentType')) payload.employmentType = fd.get('employmentType') ? String(fd.get('employmentType')) : undefined
    if (canEdit('status')) payload.status = fd.get('status') ? String(fd.get('status')) : undefined
    if (canEdit('region')) payload.region = fd.get('region') ? String(fd.get('region')) : undefined
    if (canEdit('reportsToId')) {
      const reportsToId = fd.get('reportsToId')
      payload.reportsToId = reportsToId ? String(reportsToId) : null
    }

    // Department
    if (canEdit('department')) {
      payload.department = selectedDepartment || undefined
    }

    try {
      // Update employee info
      await EmployeesApi.update(id, payload)

      // Update department head if changed
      if (canEditDepartment && selectedDepartment) {
        const dept = departments.find(d => d.name === selectedDepartment)
        if (dept) {
          const currentlyHead = dept.headId === id
          if (isDepartmentHead && !currentlyHead) {
            // Make this employee the department head
            await DepartmentsApi.update(dept.id, { headId: id })
          } else if (!isDepartmentHead && currentlyHead) {
            // Remove this employee as department head
            await DepartmentsApi.update(dept.id, { headId: '' })
          }
        }
      }

      // Update project memberships
      if (canEditProjects) {
        await EmployeesApi.updateProjectMemberships(
          id,
          projectMemberships
            .filter((m) => m.projectId)
            .map((m) => ({
              projectId: m.projectId,
              role: m.role || undefined,
            }))
        )

        // Update project leads
        for (const proj of projects) {
          const isMember = projectMemberships.some(m => m.projectId === proj.id)
          const shouldBeLead = projectLeadIds.has(proj.id)
          const currentlyLead = proj.leadId === id

          if (isMember && shouldBeLead && !currentlyLead) {
            // Make this employee the project lead
            await ProjectsApi.update(proj.id, { leadId: id })
          } else if (currentlyLead && !shouldBeLead) {
            // Remove this employee as project lead
            await ProjectsApi.update(proj.id, { leadId: '' })
          }
        }
      }

      router.push(`/employees/${id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
  }

  function addProjectMembership() {
    setProjectMemberships([...projectMemberships, { projectId: '', role: '' }])
  }

  function removeProjectMembership(index: number) {
    const membership = projectMemberships[index]
    if (membership.projectId) {
      // Remove from lead set if they were lead
      setProjectLeadIds(prev => {
        const next = new Set(prev)
        next.delete(membership.projectId)
        return next
      })
    }
    setProjectMemberships(projectMemberships.filter((_, i) => i !== index))
  }

  function updateProjectMembership(index: number, field: 'projectId' | 'role', value: string) {
    const updated = [...projectMemberships]
    const oldProjectId = updated[index].projectId
    updated[index] = { ...updated[index], [field]: value }
    setProjectMemberships(updated)

    // If project changed, remove old project from lead set
    if (field === 'projectId' && oldProjectId !== value) {
      setProjectLeadIds(prev => {
        const next = new Set(prev)
        next.delete(oldProjectId)
        return next
      })
    }
  }

  function toggleProjectLead(projectId: string) {
    setProjectLeadIds(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const availableProjects = (index: number) => {
    const assignedProjectIds = projectMemberships
      .filter((_, i) => i !== index)
      .map((m) => m.projectId)
    return projects.filter((p) => !assignedProjectIds.includes(p.id))
  }

  // Get current department info
  const currentDepartment = departments.find(d => d.name === selectedDepartment)
  const currentDepartmentHead = currentDepartment?.head

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
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
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

  // If not editing self and not a manager/admin, redirect to view page
  const hasAnyEditPermission = permissions.editableFields.length > 0
  if (!permissions.isEditingSelf && !permissions.isManager && !permissions.isSuperAdmin && !hasAnyEditPermission) {
    router.replace(`/employees/${id}`)
    return null
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

            {/* Personal Information */}
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
                <h4 className="text-sm font-medium text-gray-700 mb-3">Emergency Contact</h4>
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

            {/* ========== BY PERSON (Person Hierarchy) ========== */}
            {canEditPersonHierarchy && (
              <>
                <CardDivider />
                <FormSection
                  title={
                    <span className="flex items-center gap-2">
                      <SectionIcon icon={UserIcon} color="bg-blue-600" />
                      By Person
                    </span>
                  }
                  description="Reporting hierarchy and employment details (as shown in Person view of Organogram)"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                    {canEdit('position') && (
                      <FormField
                        label="Position"
                        name="position"
                        required
                        defaultValue={employee.position}
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
                    {canEdit('joinDate') && (
                      <FormField
                        label="Join Date"
                        name="joinDate"
                        type="date"
                        required
                        defaultValue={joinDateFormatted}
                      />
                    )}
                    {canEdit('region') && (
                      <SelectField
                        label="Region"
                        name="region"
                        required
                        options={regionOptions}
                        defaultValue={(employee as any).region || 'PAKISTAN'}
                      />
                    )}
                  </div>
                </FormSection>
              </>
            )}

            {/* ========== BY DEPARTMENT ========== */}
            {canEditDepartment && (
              <>
                <CardDivider />
                <FormSection
                  title={
                    <span className="flex items-center gap-2">
                      <SectionIcon icon={BuildingIcon} color="bg-purple-600" />
                      By Department
                    </span>
                  }
                  description="Department assignment and leadership (as shown in Department view of Organogram)"
                >
                  <div className="space-y-5">
                    <SelectField
                      label="Department"
                      name="department"
                      required
                      options={departments.map((dept) => ({
                        value: dept.name,
                        label: dept.name,
                      }))}
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value)
                        // Reset department head status when department changes
                        const newDept = departments.find(d => d.name === e.target.value)
                        setIsDepartmentHead(newDept?.headId === id)
                      }}
                    />

                    {selectedDepartment && (
                      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Department Head</label>
                            {currentDepartmentHead && currentDepartmentHead.id !== id && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Current: {currentDepartmentHead.firstName} {currentDepartmentHead.lastName}
                              </p>
                            )}
                            {!currentDepartmentHead && !isDepartmentHead && (
                              <p className="text-xs text-gray-500 mt-0.5">No head assigned</p>
                            )}
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isDepartmentHead}
                              onChange={(e) => setIsDepartmentHead(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            <span className="ml-2 text-sm font-medium text-gray-700">
                              {isDepartmentHead ? 'Yes' : 'No'}
                            </span>
                          </label>
                        </div>
                        {isDepartmentHead && (
                          <p className="text-xs text-purple-600">
                            {employee.firstName} will be set as the head of {selectedDepartment}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </FormSection>
              </>
            )}

            {/* ========== BY PROJECT ========== */}
            {canEditProjects && (
              <>
                <CardDivider />
                <FormSection
                  title={
                    <span className="flex items-center gap-2">
                      <SectionIcon icon={FolderIcon} color="bg-amber-600" />
                      By Project
                    </span>
                  }
                  description="Project assignments and leadership (as shown in Project view of Organogram)"
                >
                  <div className="space-y-3">
                    {projectMemberships.map((membership, index) => {
                      const project = projects.find(p => p.id === membership.projectId)
                      const isLead = projectLeadIds.has(membership.projectId)
                      const currentLead = project?.lead

                      return (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <select
                                value={membership.projectId}
                                onChange={(e) => updateProjectMembership(index, 'projectId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
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
                            <div className="w-32">
                              <select
                                value={membership.role}
                                onChange={(e) => updateProjectMembership(index, 'role', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                              >
                                <option value="">Role...</option>
                                <option value="Lead">Lead</option>
                                <option value="Member">Member</option>
                                <option value="Contributor">Contributor</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProjectMembership(index)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove project"
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>

                          {membership.projectId && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Project Lead</span>
                                {currentLead && currentLead.id !== id && (
                                  <p className="text-xs text-gray-500">
                                    Current: {currentLead.firstName} {currentLead.lastName}
                                  </p>
                                )}
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isLead}
                                  onChange={() => toggleProjectLead(membership.projectId)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                <span className="ml-2 text-sm font-medium text-gray-700">
                                  {isLead ? 'Yes' : 'No'}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {projects.length > 0 && projectMemberships.length < projects.length && (
                      <button
                        type="button"
                        onClick={addProjectMembership}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Project
                      </button>
                    )}

                    {projectMemberships.length === 0 && projects.length > 0 && (
                      <p className="text-sm text-gray-500">
                        No projects assigned.{' '}
                        <button
                          type="button"
                          onClick={addProjectMembership}
                          className="text-amber-600 hover:text-amber-700 font-medium"
                        >
                          Add one
                        </button>
                      </p>
                    )}

                    {projects.length === 0 && (
                      <p className="text-sm text-gray-500">No projects exist yet.</p>
                    )}
                  </div>
                </FormSection>
              </>
            )}

            {/* No editable fields message */}
            {!canEditPersonHierarchy && !canEditDepartment && !canEditProjects && !canEditPersonal && (
              <>
                <CardDivider />
                <div className="py-8 text-center">
                  <LockClosedIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">You don't have permission to edit this employee's profile.</p>
                </div>
              </>
            )}

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              {(canEditPersonHierarchy || canEditDepartment || canEditProjects || canEditPersonal) && (
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
