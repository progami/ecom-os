'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DisciplinaryActionsApi, EmployeesApi, MeApi, type Employee, type Me } from '@/lib/api-client'
import { ExclamationTriangleIcon, SpinnerIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useNavigationHistory } from '@/lib/navigation-history'

const violationTypeOptions = [
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'OTHER', label: 'Other' },
]

const severityOptions = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
]

const actionTakenOptions = [
  { value: 'VERBAL_WARNING', label: 'Verbal Warning' },
  { value: 'WRITTEN_WARNING', label: 'Written Warning' },
  { value: 'FINAL_WARNING', label: 'Final Warning' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'OTHER', label: 'Other' },
]

const companyValues = [
  'Integrity',
  'Respect',
  'Teamwork',
  'Excellence',
  'Accountability',
  'Innovation',
]

const DisciplinarySchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  violationType: z.string().min(1, 'Violation type is required'),
  violationReason: z.string().min(1, 'Violation reason is required'),
  valuesBreached: z.array(z.string()).default([]),
  severity: z.string().min(1, 'Severity is required'),
  incidentDate: z.string().min(1, 'Incident date is required'),
  reportedBy: z.string().min(1, 'Reporter is required'),
  description: z.string().min(1, 'Description is required'),
  witnesses: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
  actionTaken: z.string().min(1, 'Action taken is required'),
})

type FormData = z.infer<typeof DisciplinarySchema>

function AddDisciplinaryContent() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const searchParams = useSearchParams()
  const preselectedEmployeeId = searchParams.get('employeeId')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedValues, setSelectedValues] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(DisciplinarySchema),
    defaultValues: {
      employeeId: preselectedEmployeeId ?? '',
      valuesBreached: [],
    },
  })

  useEffect(() => {
    async function load() {
      try {
        const [empRes, meData] = await Promise.all([
          EmployeesApi.list({ take: 200 }),
          MeApi.get().catch(() => null),
        ])
        setEmployees(empRes.items)
        setMe(meData)

        // Set reporter to current user's name
        if (meData) {
          setValue('reportedBy', `${meData.firstName} ${meData.lastName}`)
        }
      } catch (e: any) {
        setError('root', { message: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [setValue, setError])

  const toggleValue = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value]
    setSelectedValues(newValues)
    setValue('valuesBreached', newValues)
  }

  const onSubmit = async (data: FormData) => {
    try {
      const created = await DisciplinaryActionsApi.create({
        ...data,
        witnesses: data.witnesses ?? null,
        evidence: data.evidence ?? null,
      })
      router.push(`/performance/disciplinary/${created.id}`)
    } catch (e: any) {
      setError('root', { message: e.message })
    }
  }

  const canCreate = Boolean(me?.isHR || me?.isSuperAdmin)

  if (loading) {
    return (
      <div className="max-w-3xl">
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </Card>
      </div>
    )
  }

  if (!canCreate) {
    return (
      <div className="max-w-3xl">
        <Card padding="lg">
          <Alert variant="error">You do not have permission to create violations.</Alert>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <Card padding="lg">
        {errors.root && (
          <Alert variant="error" className="mb-6" onDismiss={() => setError('root', { message: '' })}>
            {errors.root.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Employee & Incident */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Incident Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="employeeId">Employee <span className="text-destructive">*</span></Label>
                <NativeSelect
                  {...register('employeeId')}
                  className={cn(errors.employeeId && 'border-destructive')}
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.department})
                    </option>
                  ))}
                </NativeSelect>
                {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="violationType">Violation Type <span className="text-destructive">*</span></Label>
                <NativeSelect
                  {...register('violationType')}
                  className={cn(errors.violationType && 'border-destructive')}
                >
                  <option value="">Select type...</option>
                  {violationTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </NativeSelect>
                {errors.violationType && <p className="text-xs text-destructive">{errors.violationType.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severity <span className="text-destructive">*</span></Label>
                <NativeSelect
                  {...register('severity')}
                  className={cn(errors.severity && 'border-destructive')}
                >
                  <option value="">Select severity...</option>
                  {severityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </NativeSelect>
                {errors.severity && <p className="text-xs text-destructive">{errors.severity.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentDate">Incident Date <span className="text-destructive">*</span></Label>
                <Input
                  {...register('incidentDate')}
                  type="date"
                  className={cn(errors.incidentDate && 'border-destructive')}
                />
                {errors.incidentDate && <p className="text-xs text-destructive">{errors.incidentDate.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportedBy">Reported By <span className="text-destructive">*</span></Label>
                <Input
                  {...register('reportedBy')}
                  className={cn(errors.reportedBy && 'border-destructive')}
                />
                {errors.reportedBy && <p className="text-xs text-destructive">{errors.reportedBy.message}</p>}
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="violationReason">Violation Reason <span className="text-destructive">*</span></Label>
                <Input
                  {...register('violationReason')}
                  placeholder="Brief reason for the violation"
                  className={cn(errors.violationReason && 'border-destructive')}
                />
                {errors.violationReason && <p className="text-xs text-destructive">{errors.violationReason.message}</p>}
              </div>
            </div>
          </div>

          <CardDivider />

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Description</h3>
            <div className="space-y-2">
              <Label htmlFor="description">Full Description <span className="text-destructive">*</span></Label>
              <Textarea
                {...register('description')}
                rows={4}
                placeholder="Describe the incident in detail..."
                className={cn(errors.description && 'border-destructive')}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
          </div>

          <CardDivider />

          {/* Values Breached */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Company Values Breached</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {companyValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedValues.includes(value)}
                    onCheckedChange={() => toggleValue(value)}
                  />
                  <span className="text-sm text-foreground">{value}</span>
                </label>
              ))}
            </div>
          </div>

          <CardDivider />

          {/* Evidence & Witnesses */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Evidence & Witnesses</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="witnesses">Witnesses</Label>
                <Input {...register('witnesses')} placeholder="Names of witnesses (optional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evidence">Evidence</Label>
                <Textarea
                  {...register('evidence')}
                  rows={3}
                  placeholder="Describe any evidence collected (optional)"
                />
              </div>
            </div>
          </div>

          <CardDivider />

          {/* Action Taken */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Action</h3>
            <div className="space-y-2">
              <Label htmlFor="actionTaken">Action Taken <span className="text-destructive">*</span></Label>
              <NativeSelect
                {...register('actionTaken')}
                className={cn(errors.actionTaken && 'border-destructive')}
              >
                <option value="">Select action...</option>
                {actionTakenOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
              {errors.actionTaken && <p className="text-xs text-destructive">{errors.actionTaken.message}</p>}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Button type="button" variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Violation'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default function AddDisciplinaryPage() {
  return (
    <>
      <PageHeader
        title="New Violation"
        description="Record a disciplinary action"
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <SpinnerIcon className="h-8 w-8 animate-spin text-accent" />
          </div>
        }
      >
        <AddDisciplinaryContent />
      </Suspense>
    </>
  )
}
