'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LeavesApi, MeApi, type LeaveRequest, type Me } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import { TextareaField } from '@/components/ui/FormField'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function LeaveRequestPage() {
  const params = useParams()
  const id = params.id as string

  const [me, setMe] = useState<Me | null>(null)
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [leaveData, meData] = await Promise.all([
          LeavesApi.get(id),
          MeApi.get(),
        ])
        setLeave(leaveData)
        setMe(meData)
      } catch (e: any) {
        setError(e.message || 'Failed to load leave request')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function updateStatus(status: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    if (!leave) return
    setSaving(true)
    setError(null)
    try {
      const updated = await LeavesApi.update(leave.id, {
        status,
        reviewNotes: status === 'REJECTED' ? (reviewNotes ? reviewNotes : undefined) : undefined,
      })
      setLeave(updated)
    } catch (e: any) {
      setError(e.message || 'Failed to update leave request')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Leave Request" description="People" icon={<CalendarDaysIcon className="h-6 w-6 text-white" />} showBack />
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </Card>
      </>
    )
  }

  if (!leave) {
    return (
      <>
        <PageHeader title="Leave Request" description="People" icon={<CalendarDaysIcon className="h-6 w-6 text-white" />} showBack />
        <Card padding="lg">
          <p className="text-sm text-gray-600">Leave request not found.</p>
        </Card>
      </>
    )
  }

  const isOwner = Boolean(me && me.id === leave.employeeId)
  const canAct = leave.status === 'PENDING'

  return (
    <>
      <PageHeader
        title="Leave Request"
        description="People"
        icon={<CalendarDaysIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="space-y-6 max-w-4xl">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'Employee'} • {leave.leaveType.replaceAll('_', ' ')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(leave.startDate)} → {formatDate(leave.endDate)} • {leave.totalDays} days
              </p>
              {leave.reason && (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{leave.reason}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={leave.status} />
            </div>
          </div>
        </Card>

        {canAct && !isOwner && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Manager Review</h3>
            <TextareaField
              label="Review Notes (optional)"
              name="reviewNotes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => updateStatus('REJECTED')} loading={saving} disabled={saving}>
                Reject
              </Button>
              <Button onClick={() => updateStatus('APPROVED')} loading={saving} disabled={saving}>
                Approve
              </Button>
            </div>
          </Card>
        )}

        {canAct && isOwner && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              You can cancel a pending request.
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => updateStatus('CANCELLED')} loading={saving} disabled={saving}>
                Cancel Request
              </Button>
            </div>
          </Card>
        )}

        {(leave.reviewNotes || leave.reviewedAt) && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Decision</h3>
            {leave.reviewedAt && (
              <p className="text-sm text-gray-600">
                Reviewed on {formatDate(leave.reviewedAt)}
              </p>
            )}
            {leave.reviewNotes && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{leave.reviewNotes}</p>
            )}
          </Card>
        )}
      </div>
    </>
  )
}

