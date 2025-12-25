'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { ClipboardDocumentCheckIcon } from '@/components/ui/Icons'
import { ChecklistTemplatesApi, type ChecklistTemplate, type ChecklistOwnerType, type ChecklistTemplateItemInput } from '@/lib/api-client'

const OWNER_OPTIONS: Array<{ value: ChecklistOwnerType; label: string }> = [
  { value: 'HR', label: 'HR' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'IT', label: 'IT' },
  { value: 'EMPLOYEE', label: 'Employee' },
]

export default function ChecklistTemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [items, setItems] = useState<ChecklistTemplateItemInput[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const instancesCount = template?._count?.instances ?? 0
  const canEditItems = instancesCount === 0

  const title = useMemo(() => {
    if (!template) return 'Checklist template'
    return `${template.name}`
  }, [template])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const t = await ChecklistTemplatesApi.get(id)
      setTemplate(t)
      setName(t.name)
      setIsActive(t.isActive)
      const indexById = new Map<string, number>()
      for (let idx = 0; idx < (t.items ?? []).length; idx += 1) {
        const item = t.items[idx]!
        indexById.set(item.id, idx)
      }
      setItems(
        (t.items ?? []).map((i) => ({
          title: i.title,
          description: i.description ?? null,
          ownerType: i.ownerType,
          dueOffsetDays: i.dueOffsetDays,
          evidenceRequired: i.evidenceRequired,
          dependsOnIndex: i.dependsOnItemId ? (indexById.get(i.dependsOnItemId) ?? null) : null,
        }))
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load template'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!template) return
    setSaving(true)
    setError(null)
    try {
      const payload: { name?: string; isActive?: boolean; items?: ChecklistTemplateItemInput[] } = {}
      if (name.trim() && name.trim() !== template.name) payload.name = name.trim()
      if (isActive !== template.isActive) payload.isActive = isActive
      if (canEditItems) {
        payload.items = items.map((i) => ({
          ...i,
          title: i.title.trim(),
          description: i.description?.trim() || null,
        }))
      }

      const updated = await ChecklistTemplatesApi.update(template.id, payload)
      setTemplate(updated)
      setName(updated.name)
      setIsActive(updated.isActive)
      router.refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save template'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !template) {
    return (
      <>
        <ListPageHeader
          title="Checklist template"
          description="Loading…"
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        />
        <Card padding="lg">
          <p className="text-sm text-gray-600">Loading…</p>
        </Card>
      </>
    )
  }

  if (!template) {
    return (
      <>
        <ListPageHeader
          title="Checklist template"
          description="Not found"
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        />
        {error ? (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Card padding="lg">
          <p className="text-sm text-gray-600">Template not found.</p>
          <div className="mt-4">
            <Button href="/admin/checklists" variant="secondary">
              Back
            </Button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <ListPageHeader
        title={title}
        description={`${template.lifecycleType === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} • v${template.version}`}
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/admin/checklists" variant="secondary">
            Back to templates
          </Button>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-700">Name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
              <span className="text-xs text-gray-500">Instances: {instancesCount}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Items</h2>
              <p className="text-xs text-gray-500 mt-1">
                {canEditItems
                  ? 'Edit the checklist steps. Items are stored in order.'
                  : 'This template already has instances. Items are locked to prevent workflow drift; create a new template version instead.'}
              </p>
            </div>
            {!canEditItems ? (
              <Link href="/admin/checklists" className="text-sm text-blue-700 hover:underline">
                Create a new template
              </Link>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-700">Title</label>
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                      value={item.title}
                      disabled={!canEditItems}
                      onChange={(e) => {
                        const next = [...items]
                        next[idx] = { ...next[idx]!, title: e.target.value }
                        setItems(next)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Owner</label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                      value={item.ownerType}
                      disabled={!canEditItems}
                      onChange={(e) => {
                        const next = [...items]
                        next[idx] = { ...next[idx]!, ownerType: e.target.value as ChecklistOwnerType }
                        setItems(next)
                      }}
                    >
                      {OWNER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Due offset (days)</label>
                    <input
                      type="number"
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                      value={item.dueOffsetDays ?? 0}
                      disabled={!canEditItems}
                      min={0}
                      max={365}
                      onChange={(e) => {
                        const next = [...items]
                        next[idx] = { ...next[idx]!, dueOffsetDays: Number.parseInt(e.target.value || '0', 10) }
                        setItems(next)
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Description</label>
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                      value={item.description ?? ''}
                      disabled={!canEditItems}
                      onChange={(e) => {
                        const next = [...items]
                        next[idx] = { ...next[idx]!, description: e.target.value }
                        setItems(next)
                      }}
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={item.evidenceRequired ?? false}
                        disabled={!canEditItems}
                        onChange={(e) => {
                          const next = [...items]
                          next[idx] = { ...next[idx]!, evidenceRequired: e.target.checked }
                          setItems(next)
                        }}
                      />
                      Evidence required
                    </label>
                    {canEditItems ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const next = [...items]
                          next.splice(idx, 1)
                          setItems(next.length ? next : [{ title: '', ownerType: 'HR', dueOffsetDays: 0 }])
                        }}
                        disabled={items.length <= 1}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Depends on</label>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900"
                      value={item.dependsOnIndex ?? ''}
                      disabled={!canEditItems}
                      onChange={(e) => {
                        const next = [...items]
                        const value = e.target.value === '' ? null : Number.parseInt(e.target.value, 10)
                        next[idx] = { ...next[idx]!, dependsOnIndex: value }
                        setItems(next)
                      }}
                    >
                      <option value="">None</option>
                      {items.slice(0, idx).map((prev, prevIdx) => (
                        <option key={prevIdx} value={prevIdx}>
                          {prevIdx + 1}. {prev.title || 'Untitled'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <p className="text-xs text-gray-500">
                      If an item depends on a previous step, it will stay blocked until the prerequisite is completed.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {canEditItems ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setItems([...items, { title: '', ownerType: 'HR', dueOffsetDays: 0 }])}
                >
                  Add item
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  )
}
