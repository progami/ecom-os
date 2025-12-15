'use client'

import { useState } from 'react'
import { LeavesApi } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

const LEAVE_TYPES = [
  { value: 'PTO', label: 'PTO (Paid Time Off)' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'PATERNITY', label: 'Paternity Leave' },
  { value: 'PARENTAL', label: 'Parental Leave' },
  { value: 'BEREAVEMENT_IMMEDIATE', label: 'Bereavement (Immediate Family)' },
  { value: 'BEREAVEMENT_EXTENDED', label: 'Bereavement (Extended Family)' },
  { value: 'JURY_DUTY', label: 'Jury Duty' },
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

type LeaveRequestFormProps = {
  employeeId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function LeaveRequestForm({ employeeId, onSuccess, onCancel }: LeaveRequestFormProps) {
  const [leaveType, setLeaveType] = useState('PTO')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalDays = calculateBusinessDays(startDate, endDate)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      setError('Please select start and end dates')
      return
    }
    if (totalDays <= 0) {
      setError('End date must be after start date')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await LeavesApi.create({
        employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: reason || undefined,
      })
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Leave Type
        </label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          {LEAVE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      {totalDays > 0 && (
        <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
          Total: <span className="font-medium">{totalDays} business day{totalDays !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          placeholder="Briefly describe the reason for your leave..."
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || totalDays <= 0}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  )
}
