'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmployeesApi } from '@/lib/api-client'
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

export default function AddEmployeePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as any

    try {
      await EmployeesApi.create({
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
      router.push('/employees')
    } catch (e: any) {
      setError(e.message || 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add Employee"
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
                  label="First Name"
                  name="firstName"
                  required
                  placeholder="John"
                />
                <FormField
                  label="Last Name"
                  name="lastName"
                  required
                  placeholder="Doe"
                />
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  required
                  placeholder="employee@company.com"
                />
                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
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
                  placeholder="e.g., Engineering"
                />
                <FormField
                  label="Position"
                  name="position"
                  required
                  placeholder="e.g., Software Engineer"
                />
                <FormField
                  label="Join Date"
                  name="joinDate"
                  type="date"
                  required
                />
                <SelectField
                  label="Employment Type"
                  name="employmentType"
                  required
                  options={employmentTypeOptions}
                  defaultValue="FULL_TIME"
                />
                <SelectField
                  label="Status"
                  name="status"
                  required
                  options={statusOptions}
                  defaultValue="ACTIVE"
                />
              </div>
            </FormSection>

            {/* Actions */}
            <FormActions>
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Saving...' : 'Save Employee'}
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  )
}
