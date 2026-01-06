'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DashboardApi, LeavesApi } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { ArrowLeftIcon } from '@/components/ui/Icons'
import { NativeSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const LEAVE_TYPES = [
  { value: 'PTO', label: 'PTO (Paid Time Off)' },
  { value: 'PARENTAL', label: 'Parental Leave' },
  { value: 'BEREAVEMENT_IMMEDIATE', label: 'Bereavement' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
]

const LeaveRequestSchema = z.object({
  leaveType: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
})

type FormData = z.infer<typeof LeaveRequestSchema>

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

export default function LeaveRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<{
    id: string
    firstName: string
    lastName: string
    avatar?: string | null
    department?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<FormData>({
    resolver: zodResolver(LeaveRequestSchema),
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

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await DashboardApi.get()
        if (dashboard.currentEmployee) {
          setEmployee({
            id: dashboard.currentEmployee.id,
            firstName: dashboard.currentEmployee.firstName,
            lastName: dashboard.currentEmployee.lastName,
            avatar: dashboard.currentEmployee.avatar,
            department: dashboard.currentEmployee.department,
          })
        }
      } catch (e) {
        setError('Failed to load employee data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const onSubmit = async (data: FormData) => {
    if (!employee) return

    if (totalDays <= 0) {
      setFormError('endDate', { message: 'End date must be after start date' })
      return
    }

    try {
      await LeavesApi.create({
        employeeId: employee.id,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
        reason: data.reason,
      })
      router.push('/leave')
    } catch (err) {
      setFormError('root', {
        message: err instanceof Error ? err.message : 'Failed to submit leave request',
      })
    }
  }

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

  if (!employee) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <p className="text-sm font-medium text-foreground">Unable to load employee data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" href="/leave">Back to Leave</Button>
          </div>
        </Card>
      </div>
    )
  }

  const employeeName = `${employee.firstName} ${employee.lastName}`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/leave"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Leave
      </Link>

      {/* Main card */}
      <Card padding="lg">
        {/* Header */}
        <div className="flex items-start gap-3 pb-6 border-b border-border">
          <Avatar
            src={employee.avatar}
            alt={employeeName}
            size="lg"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Request Leave</h1>
            <p className="text-sm text-muted-foreground">
              {employeeName}
              {employee.department && ` • ${employee.department}`}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="py-6 space-y-6">
          {errors.root && (
            <Alert variant="error">{errors.root.message}</Alert>
          )}

          <div>
            <Label htmlFor="leaveType">Leave Type</Label>
            <NativeSelect {...register('leaveType')} className="mt-1.5">
              {LEAVE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                {...register('startDate')}
                type="date"
                className={cn('mt-1.5', errors.startDate && 'border-destructive')}
              />
              {errors.startDate && (
                <p className="text-xs text-destructive mt-1">{errors.startDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                {...register('endDate')}
                type="date"
                min={startDate}
                className={cn('mt-1.5', errors.endDate && 'border-destructive')}
              />
              {errors.endDate && (
                <p className="text-xs text-destructive mt-1">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {totalDays > 0 && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
              Total: <span className="font-medium text-foreground">{totalDays} business day{totalDays !== 1 ? 's' : ''}</span>
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              {...register('reason')}
              rows={3}
              className="mt-1.5 resize-none"
              placeholder="Briefly describe the reason for your leave..."
            />
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <Button type="button" variant="secondary" href="/leave">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={totalDays <= 0}>
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
