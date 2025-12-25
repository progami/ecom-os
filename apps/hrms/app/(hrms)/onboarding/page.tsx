'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { UsersIcon, ClipboardDocumentCheckIcon } from '@/components/ui/Icons'
import { Avatar } from '@/components/ui/Avatar'
import { OnboardingApi, ChecklistsApi, type ChecklistInstanceSummary } from '@/lib/api-client'

type OnboardingOverview = Awaited<ReturnType<typeof OnboardingApi.overview>>

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function OnboardingPage() {
  const router = useRouter()

  const [data, setData] = useState<OnboardingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | undefined>(undefined)
  const [startingEmployeeId, setStartingEmployeeId] = useState<string | null>(null)

  const templates = data?.templates ?? []
  const instances = data?.instances ?? []
  const employeesWithoutOnboarding = data?.employeesWithoutOnboarding ?? []

  const inProgress = useMemo(() => {
    return instances.filter((i) => i.progress.done < i.progress.total)
  }, [instances])

  const completed = useMemo(() => {
    return instances.filter((i) => i.progress.total > 0 && i.progress.done === i.progress.total)
  }, [instances])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const next = await OnboardingApi.overview()
        if (cancelled) return
        setData(next)
        setTemplateId((prev) => prev ?? next.templates[0]?.id)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Failed to load onboarding overview'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function startOnboarding(employeeId: string) {
    try {
      setStartingEmployeeId(employeeId)
      setError(null)
      const res = await ChecklistsApi.create({
        employeeId,
        lifecycleType: 'ONBOARDING',
        templateId,
      })
      router.push(`/checklists/${res.instanceId}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start onboarding'
      setError(message)
    } finally {
      setStartingEmployeeId(null)
    }
  }

  return (
    <>
      <ListPageHeader
        title="Onboarding"
        description="Start and track onboarding checklists."
        icon={<UsersIcon className="h-6 w-6 text-white" />}
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Card padding="lg">
          <p className="text-sm text-gray-600">Loading…</p>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card padding="md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Template</h2>
                <p className="text-xs text-gray-500 mt-1">Choose which onboarding checklist template to use when starting onboarding.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={templateId ?? ''}
                  onChange={(e) => setTemplateId(e.target.value || undefined)}
                  disabled={templates.length === 0}
                >
                  {templates.length === 0 ? (
                    <option value="">No active onboarding templates</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (v{t.version})
                      </option>
                    ))
                  )}
                </select>
                <Button href="/admin/checklists" variant="secondary" icon={<ClipboardDocumentCheckIcon className="h-4 w-4" />}>
                  Manage templates
                </Button>
              </div>
            </div>
          </Card>

          <Section
            title="In progress"
            description="Active onboarding checklists that still have open items."
            items={inProgress}
          />

          <Section
            title="Completed"
            description="Recently completed onboarding checklists."
            items={completed.slice(0, 10)}
            emptyText="No completed onboarding checklists yet."
          />

          <Card padding="md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Start onboarding</h2>
                <p className="text-xs text-gray-500 mt-1">Employees who do not have an onboarding checklist yet.</p>
              </div>
            </div>

            {templates.length === 0 ? (
              <Alert variant="warning" className="mt-4">
                No onboarding templates are active. Create or enable a template to start onboarding.
              </Alert>
            ) : employeesWithoutOnboarding.length === 0 ? (
              <p className="text-sm text-gray-600 mt-4">Everyone already has an onboarding checklist.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Join date</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-0 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeesWithoutOnboarding.map((e) => (
                      <tr key={e.id}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={e.avatar ?? undefined} alt={`${e.firstName} ${e.lastName}`} size="sm" />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {e.firstName} {e.lastName}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{e.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{formatDate(e.joinDate)}</td>
                        <td className="py-3 pr-4 text-gray-700">{e.department}</td>
                        <td className="py-3 pr-4 text-gray-700">{e.position}</td>
                        <td className="py-3 pr-0 text-right">
                          <Button
                            onClick={() => startOnboarding(e.id)}
                            disabled={startingEmployeeId === e.id}
                          >
                            {startingEmployeeId === e.id ? 'Starting…' : 'Start'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

function Section({
  title,
  description,
  items,
  emptyText,
}: {
  title: string
  description: string
  items: ChecklistInstanceSummary[]
  emptyText?: string
}) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-600 mt-4">{emptyText ?? 'Nothing here yet.'}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Template</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-0 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={i.employee.avatar ?? undefined}
                        alt={`${i.employee.firstName} ${i.employee.lastName}`}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {i.employee.firstName} {i.employee.lastName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{i.employee.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {i.progress.done}/{i.progress.total} ({i.progress.percentDone}%)
                    {i.progress.blocked > 0 ? <span className="text-xs text-amber-700 ml-2">• {i.progress.blocked} blocked</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {i.template.name} (v{i.template.version})
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{formatDate(i.createdAt)}</td>
                  <td className="py-3 pr-0 text-right">
                    <Link
                      href={`/checklists/${i.id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

