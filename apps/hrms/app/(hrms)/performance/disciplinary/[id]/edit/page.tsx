'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DisciplinaryActionsApi, MeApi, type DisciplinaryAction, type Me } from '@/lib/api-client'
import { ExclamationTriangleIcon } from '@/components/ui/Icons'
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

const statusOptions = [
  { value: 'REPORTED', label: 'Reported' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'PENDING_HR_REVIEW', label: 'Pending HR Review' },
  { value: 'PENDING_ACKNOWLEDGMENT', label: 'Pending Acknowledgment' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const companyValues = [
  'Integrity',
  'Respect',
  'Teamwork',
  'Excellence',
  'Accountability',
  'Innovation',
]

const EditDisciplinarySchema = z.object({
  violationType: z.string().min(1, 'Violation type is required'),
  violationReason: z.string().min(1, 'Violation reason is required'),
  valuesBreached: z.array(z.string()).default([]),
  severity: z.string().min(1, 'Severity is required'),
  incidentDate: z.string().min(1, 'Incident date is required'),
  description: z.string().min(1, 'Description is required'),
  witnesses: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
  actionTaken: z.string().min(1, 'Action taken is required'),
  actionDate: z.string().optional().nullable(),
  actionDetails: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  followUpNotes: z.string().optional().nullable(),
  status: z.string().min(1, 'Status is required'),
  resolution: z.string().optional().nullable(),
})

type FormData = z.infer<typeof EditDisciplinarySchema>

export default function EditDisciplinaryPage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const params = useParams()
  const id = params.id as string

  const [action, setAction] = useState<DisciplinaryAction | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedValues, setSelectedValues] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(EditDisciplinarySchema),
  })

  useEffect(() => {
    async function load() {
      try {
        const [data, meData] = await Promise.all([
          DisciplinaryActionsApi.get(id),
          MeApi.get().catch(() => null),
        ])
        setAction(data)
        setMe(meData)
        setSelectedValues(data.valuesBreached ?? [])

        reset({
          violationType: data.violationType,
          violationReason: data.violationReason,
          valuesBreached: data.valuesBreached ?? [],
          severity: data.severity,
          incidentDate: data.incidentDate.split('T')[0],
          description: data.description,
          witnesses: data.witnesses,
          evidence: data.evidence,
          actionTaken: data.actionTaken,
          actionDate: data.actionDate?.split('T')[0] ?? '',
          actionDetails: data.actionDetails,
          followUpDate: data.followUpDate?.split('T')[0] ?? '',
          followUpNotes: data.followUpNotes,
          status: data.status,
          resolution: data.resolution,
        })
      } catch (e: any) {
        setError('root', { message: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, reset, setError])

  const toggleValue = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value]
    setSelectedValues(newValues)
    setValue('valuesBreached', newValues)
  }

  const onSubmit = async (data: FormData) => {
    try {
      await DisciplinaryActionsApi.update(id, {
        ...data,
        witnesses: data.witnesses ?? null,
        evidence: data.evidence ?? null,
        actionDate: data.actionDate ?? null,
        actionDetails: data.actionDetails ?? null,
        followUpDate: data.followUpDate ?? null,
        followUpNotes: data.followUpNotes ?? null,
        resolution: data.resolution ?? null,
      })
      router.push(`/performance/disciplinary/${id}`)
    } catch (e: any) {
      setError('root', { message: e.message })
    }
  }

  const canEdit = Boolean(me?.isHR || me?.isSuperAdmin)

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Violation"
          description="Loading..."
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
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
      </>
    )
  }

  if (!action) {
    return (
      <>
        <PageHeader
          title="Edit Violation"
          description="Not Found"
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{errors.root?.message ?? 'Violation not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  if (!canEdit) {
    router.replace(`/performance/disciplinary/${id}`)
    return null
  }

  return (
    <>
      <PageHeader
        title="Edit Violation"
        description={`${action.employee?.firstName} ${action.employee?.lastName}`}
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl">
        <Card padding="lg">
          {errors.root && (
            <Alert variant="error" className="mb-6" onDismiss={() => setError('root', { message: '' })}>
              {errors.root.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Employee Info (read-only) */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Employee</h3>
              <div className="px-3 py-2 bg-muted border border-border rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  {action.employee?.firstName} {action.employee?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {action.employee?.position} • {action.employee?.department}
                </p>
              </div>
            </div>

            <CardDivider />

            {/* Incident Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Incident Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="violationType">Violation Type <span className="text-destructive">*</span></Label>
                  <NativeSelect
                    {...register('violationType')}
                    className={cn(errors.violationType && 'border-destructive')}
                  >
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
                  <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                  <NativeSelect
                    {...register('status')}
                    className={cn(errors.status && 'border-destructive')}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.status && <p className="text-xs text-destructive">{errors.status.message}</p>}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="violationReason">Violation Reason <span className="text-destructive">*</span></Label>
                  <Input
                    {...register('violationReason')}
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
                  <Input {...register('witnesses')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence">Evidence</Label>
                  <Textarea {...register('evidence')} rows={3} />
                </div>
              </div>
            </div>

            <CardDivider />

            {/* Action Taken */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Action</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="actionTaken">Action Taken <span className="text-destructive">*</span></Label>
                  <NativeSelect
                    {...register('actionTaken')}
                    className={cn(errors.actionTaken && 'border-destructive')}
                  >
                    {actionTakenOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </NativeSelect>
                  {errors.actionTaken && <p className="text-xs text-destructive">{errors.actionTaken.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actionDate">Action Date</Label>
                  <Input {...register('actionDate')} type="date" />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="actionDetails">Action Details</Label>
                  <Textarea {...register('actionDetails')} rows={3} />
                </div>
              </div>
            </div>

            <CardDivider />

            {/* Follow-up */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Follow-up</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="followUpDate">Follow-up Date</Label>
                  <Input {...register('followUpDate')} type="date" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="followUpNotes">Follow-up Notes</Label>
                  <Textarea {...register('followUpNotes')} rows={3} />
                </div>
              </div>
            </div>

            <CardDivider />

            {/* Resolution */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Resolution</h3>
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution Notes</Label>
                <Textarea {...register('resolution')} rows={3} />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
              <Button type="button" variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
