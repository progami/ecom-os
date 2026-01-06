'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DisciplinaryActionsApi, EmployeesApi, MeApi, type Employee, type Me } from '@/lib/api-client'
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const VIOLATION_TYPES = [
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'OTHER', label: 'Other' },
]

const SEVERITY_LEVELS = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'CRITICAL', label: 'Critical' },
]

const ACTION_TYPES = [
  { value: 'VERBAL_WARNING', label: 'Verbal Warning' },
  { value: 'WRITTEN_WARNING', label: 'Written Warning' },
  { value: 'FINAL_WARNING', label: 'Final Warning' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'OTHER', label: 'Other' },
]

const COMPANY_VALUES = [
  'Integrity',
  'Respect',
  'Teamwork',
  'Excellence',
  'Accountability',
  'Innovation',
]

const ViolationSchema = z.object({
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

type FormData = z.infer<typeof ViolationSchema>

function AddViolationContent() {
  const router = useRouter()
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
    resolver: zodResolver(ViolationSchema),
    defaultValues: {
      employeeId: preselectedEmployeeId ?? '',
      violationType: '',
      severity: '',
      actionTaken: '',
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
      router.push(`/performance/violations/${created.id}`)
    } catch (e: any) {
      setError('root', { message: e.message })
    }
  }

  const canCreate = Boolean(me?.isHR || me?.isSuperAdmin)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </Card>
      </div>
    )
  }

  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <Alert variant="error">You do not have permission to create violations.</Alert>
          <div className="mt-4">
            <Button variant="secondary" href="/performance/violations">Back to Violations</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/performance/violations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Violations
      </Link>

      {/* Main card */}
      <Card padding="lg">
        {/* Header */}
        <div className="flex items-start gap-3 pb-6 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-100">
            <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Record Violation</h1>
            <p className="text-sm text-muted-foreground">
              Document a workplace policy violation
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="py-6 space-y-6">
          {errors.root && (
            <Alert variant="error" onDismiss={() => setError('root', { message: '' })}>
              {errors.root.message}
            </Alert>
          )}

          {/* Employee & Type */}
          <div>
            <Label htmlFor="employeeId">Employee</Label>
            <NativeSelect
              {...register('employeeId')}
              className={cn('mt-1.5', errors.employeeId && 'border-destructive')}
            >
              <option value="">Select employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.department})
                </option>
              ))}
            </NativeSelect>
            {errors.employeeId && (
              <p className="text-xs text-destructive mt-1">{errors.employeeId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="violationType">Violation Type</Label>
              <NativeSelect
                {...register('violationType')}
                className={cn('mt-1.5', errors.violationType && 'border-destructive')}
              >
                <option value="">Select type...</option>
                {VIOLATION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
              {errors.violationType && (
                <p className="text-xs text-destructive mt-1">{errors.violationType.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <NativeSelect
                {...register('severity')}
                className={cn('mt-1.5', errors.severity && 'border-destructive')}
              >
                <option value="">Select severity...</option>
                {SEVERITY_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
              {errors.severity && (
                <p className="text-xs text-destructive mt-1">{errors.severity.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="incidentDate">Incident Date</Label>
              <Input
                {...register('incidentDate')}
                type="date"
                className={cn('mt-1.5', errors.incidentDate && 'border-destructive')}
              />
              {errors.incidentDate && (
                <p className="text-xs text-destructive mt-1">{errors.incidentDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="reportedBy">Reported By</Label>
              <Input
                {...register('reportedBy')}
                className={cn('mt-1.5', errors.reportedBy && 'border-destructive')}
              />
              {errors.reportedBy && (
                <p className="text-xs text-destructive mt-1">{errors.reportedBy.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="violationReason">Violation Reason</Label>
            <Input
              {...register('violationReason')}
              placeholder="Brief reason for the violation"
              className={cn('mt-1.5', errors.violationReason && 'border-destructive')}
            />
            {errors.violationReason && (
              <p className="text-xs text-destructive mt-1">{errors.violationReason.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Full Description</Label>
            <Textarea
              {...register('description')}
              rows={4}
              placeholder="Describe the incident in detail..."
              className={cn('mt-1.5 resize-none', errors.description && 'border-destructive')}
            />
            {errors.description && (
              <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Values Breached */}
          <div>
            <Label>Company Values Breached (optional)</Label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMPANY_VALUES.map((value) => (
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

          {/* Evidence & Witnesses */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="witnesses">Witnesses (optional)</Label>
              <Input
                {...register('witnesses')}
                placeholder="Names of witnesses"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="actionTaken">Action Taken</Label>
              <NativeSelect
                {...register('actionTaken')}
                className={cn('mt-1.5', errors.actionTaken && 'border-destructive')}
              >
                <option value="">Select action...</option>
                {ACTION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </NativeSelect>
              {errors.actionTaken && (
                <p className="text-xs text-destructive mt-1">{errors.actionTaken.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="evidence">Evidence (optional)</Label>
            <Textarea
              {...register('evidence')}
              rows={2}
              placeholder="Describe any evidence collected..."
              className="mt-1.5 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <Button type="button" variant="secondary" href="/performance/violations">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Violation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default function AddViolationPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto">
          <Card padding="lg">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </Card>
        </div>
      }
    >
      <AddViolationContent />
    </Suspense>
  )
}
