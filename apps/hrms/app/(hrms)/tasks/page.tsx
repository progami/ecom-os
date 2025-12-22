'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TasksApi, type Task } from '@/lib/api-client'
import { CheckCircleIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
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
import { StatusBadge } from '@/components/ui/Badge'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TasksPage() {
  const router = useRouter()
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await TasksApi.list()
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load tasks', e)
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
        title="Tasks"
        description="Assigned tasks and action items"
        icon={<CheckCircleIcon className="h-6 w-6 text-white" />}
        action={(
          <Button href="/tasks/add" icon={<PlusIcon className="h-4 w-4" />}>
            Add Task
          </Button>
        )}
      />

      <div className="space-y-6">
        <Card padding="md">
          <p className="text-sm text-gray-600">
            Track onboarding/offboarding tasks, personal to-dos, and case-related tasks.
          </p>
        </Card>

        <ResultsCount count={items.length} singular="task" plural="tasks" loading={loading} />

        <Table>
          <TableHeader>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Due</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={4}
                icon={<CheckCircleIcon className="h-10 w-10" />}
                title="No tasks yet"
                description="Create a task to get started."
                action={{ label: 'Add Task', href: '/tasks/add' }}
              />
            ) : (
              items.map((t) => (
                <TableRow key={t.id} onClick={() => router.push(`/tasks/${t.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-gray-600">{t.category}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(t.dueDate ?? null)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

