'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LeavesApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils'
import { CreateLeaveRequestSchema } from '@/lib/validations'

// Simplified leave types for small team
const LEAVE_TYPES = [
  { value: 'PTO', label: 'PTO (Paid Time Off)' },
  { value: 'PARENTAL', label: 'Parental Leave' },
  { value: 'BEREAVEMENT_IMMEDIATE', label: 'Bereavement' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
]

function calculateBusinessDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  if (start > end) return 0

  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

type FormData = z.infer<typeof CreateLeaveRequestSchema>

type LeaveRequestFormProps = {
  employeeId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function LeaveRequestForm({ employeeId, onSuccess, onCancel }: LeaveRequestFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(CreateLeaveRequestSchema),
    defaultValues: {
      leaveType: 'PTO',
      startDate: '',
      endDate: '',
      reason: '',
    },
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const totalDays = calculateBusinessDays(startDate, endDate)

  const onSubmit = async (data: FormData) => {
    if (totalDays <= 0) {
      setError('endDate', { message: 'End date must be after start date' })
      return
    }

    try {
      await LeavesApi.create({
        employeeId,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason ?? undefined,
      })
      onSuccess?.()
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to submit leave request' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && <Alert variant="error">{errors.root.message}</Alert>}

      <SelectField
        label="Leave Type"
        options={LEAVE_TYPES}
        {...register('leaveType')}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            {...register('startDate')}
            type="date"
            className={cn(errors.startDate && 'border-destructive')}
          />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            {...register('endDate')}
            type="date"
            min={startDate}
            className={cn(errors.endDate && 'border-destructive')}
          />
          {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      {totalDays > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          Total: <span className="font-medium">{totalDays} business day{totalDays !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          {...register('reason')}
          rows={3}
          className="resize-none"
          placeholder="Briefly describe the reason for your leave..."
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} disabled={totalDays <= 0}>
          Submit Request
        </Button>
      </div>
    </form>
  )
}
