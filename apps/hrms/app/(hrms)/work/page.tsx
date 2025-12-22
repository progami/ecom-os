'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkItemsApi, type WorkItem } from '@/lib/api-client'
import { BellIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

function formatWhen(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDue(dueAt: string | null) {
  if (!dueAt) return '—'
  return formatWhen(dueAt)
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    TASK_ASSIGNED: 'Task',
    POLICY_ACK_REQUIRED: 'Policy',
    LEAVE_APPROVAL_REQUIRED: 'Leave',
    REVIEW_DUE: 'Review',
    REVIEW_PENDING_HR: 'HR Review',
    REVIEW_PENDING_SUPER_ADMIN: 'Final Approval',
    REVIEW_ACK_REQUIRED: 'Ack',
    VIOLATION_PENDING_HR: 'HR Review',
    VIOLATION_PENDING_SUPER_ADMIN: 'Final Approval',
    VIOLATION_ACK_REQUIRED: 'Ack',
    CASE_ASSIGNED: 'Case',
  }
  return map[type] ?? type
}

export default function WorkQueuePage() {
  const router = useRouter()
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await WorkItemsApi.list()
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load work items', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Work Queue"
        description="Your pending actions across HRMS"
        icon={<BellIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-6">
        <Card padding="md">
          <p className="text-sm text-gray-600">
            Review items that need your attention (approvals, acknowledgements, assigned tasks).
          </p>
        </Card>

        <ResultsCount count={items.length} singular="item" plural="items" loading={loading} />

        <Table>
          <TableHeader>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Created</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={4}
                icon={<BellIcon className="h-10 w-10" />}
                title="You're all caught up"
                description="No work items are pending for you right now."
              />
            ) : (
              items.map((item) => (
                <TableRow key={item.id} onClick={() => router.push(item.href)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{getTypeLabel(item.type)}</TableCell>
                  <TableCell className="text-gray-600">{formatDue(item.dueAt)}</TableCell>
                  <TableCell className="text-gray-600">{formatWhen(item.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

