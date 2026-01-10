'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LeavesApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormField, SelectField, TextareaField } from '@/components/ui/FormField'
import { CreateLeaveRequestSchema } from '@/lib/validations'
import { LEAVE_TYPE_OPTIONS } from '@/lib/domain/leave/constants'
import { calculateBusinessDaysUtcFromDateOnly } from '@/lib/domain/leave/dates'

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
  const totalDays = calculateBusinessDaysUtcFromDateOnly(startDate, endDate)

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
        options={[...LEAVE_TYPE_OPTIONS]}
        required
        error={errors.leaveType?.message}
        {...register('leaveType')}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Start Date"
          type="date"
          required
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <FormField
          label="End Date"
          type="date"
          required
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>

      {totalDays > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          Total: <span className="font-medium">{totalDays} business day{totalDays !== 1 ? 's' : ''}</span>
        </div>
      )}

      <TextareaField
        label="Reason (optional)"
        rows={3}
        resizable={false}
        placeholder="Briefly describe the reason for your leave..."
        {...register('reason')}
      />

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
