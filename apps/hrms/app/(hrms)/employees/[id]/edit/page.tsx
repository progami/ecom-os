'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { EmployeesApi, type Employee } from '@/lib/api-client'
import { UsersIcon } from '@/components/ui/Icons'
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

const employmentTypeOptions = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
]

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
]

export default function EditEmployeePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const params = useParams()
  const id = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await EmployeesApi.get(id)
        setEmployee(data)
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
      })
      router.push(`/employees/${id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
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
                <FormField
                  label="Department"
                  name="department"
                  required
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
