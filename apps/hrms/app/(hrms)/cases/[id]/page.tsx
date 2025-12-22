'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CasesApi,
  MeApi,
  type Case,
  type CaseNote,
  type Me,
} from '@/lib/api-client'
import { ExclamationTriangleIcon, PlusIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import { FormField, SelectField, TextareaField } from '@/components/ui/FormField'

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

const visibilityOptionsHR = [
  { value: 'INTERNAL_HR', label: 'Internal (HR only)' },
  { value: 'MANAGER_VISIBLE', label: 'Manager visible' },
  { value: 'EMPLOYEE_VISIBLE', label: 'Employee visible' },
]

const visibilityOptionsManager = [
  { value: 'MANAGER_VISIBLE', label: 'Manager visible' },
  { value: 'EMPLOYEE_VISIBLE', label: 'Employee visible' },
]

function formatDate(isoString: string | null | undefined) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [c, setC] = useState<Case | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = useMemo(() => {
    if (!me || !c) return false
    if (me.isSuperAdmin) return true
    if (me.isHR) return true
    if (c.createdById === me.id) return true
    return c.assignedToId === me.id
  }, [me, c])

  const visibilityOptions = useMemo(() => {
    if (me?.isSuperAdmin || me?.isHR) return visibilityOptionsHR
    if (canEdit) return visibilityOptionsManager
    return [{ value: 'EMPLOYEE_VISIBLE', label: 'Employee visible' }]
  }, [me, canEdit])

  const [caseForm, setCaseForm] = useState({
    status: 'OPEN',
    description: '',
  })

  const [noteForm, setNoteForm] = useState({
    body: '',
    visibility: 'EMPLOYEE_VISIBLE',
  })

  const [attachmentForm, setAttachmentForm] = useState({
    title: '',
    fileUrl: '',
  })

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [caseData, meData] = await Promise.all([
          CasesApi.get(id),
          MeApi.get(),
        ])
        setC(caseData)
        setMe(meData)
        setCaseForm({
          status: caseData.status,
          description: caseData.description ?? '',
        })
        setNoteForm((prev) => ({
          ...prev,
          visibility: meData.isHR || meData.isSuperAdmin ? 'INTERNAL_HR' : 'EMPLOYEE_VISIBLE',
        }))
      } catch (e: any) {
        setError(e.message || 'Failed to load case')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function refreshNotes() {
    const notes = await CasesApi.listNotes(id)
    setC((prev) => {
      if (!prev) return prev
      return { ...prev, notes: notes.items }
    })
  }

  async function refreshAttachments() {
    const attachments = await CasesApi.listAttachments(id)
    setC((prev) => {
      if (!prev) return prev
      return { ...prev, attachments: attachments.items }
    })
  }

  async function updateCase() {
    if (!c) return
    setSaving(true)
    setError(null)
    try {
      const updated = await CasesApi.update(c.id, {
        status: caseForm.status,
        description: caseForm.description ? caseForm.description : null,
      })
      setC((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (e: any) {
      setError(e.message || 'Failed to update case')
    } finally {
      setSaving(false)
    }
  }

  async function addNote() {
    if (!noteForm.body.trim()) return
    setNoteSaving(true)
    setError(null)
    try {
      await CasesApi.addNote(id, {
        body: noteForm.body,
        visibility: noteForm.visibility,
      })
      setNoteForm((p) => ({ ...p, body: '' }))
      await refreshNotes()
    } catch (e: any) {
      setError(e.message || 'Failed to add note')
    } finally {
      setNoteSaving(false)
    }
  }

  async function addAttachment() {
    if (!attachmentForm.fileUrl.trim()) return
    setSaving(true)
    setError(null)
    try {
      await CasesApi.addAttachment(id, {
        title: attachmentForm.title ? attachmentForm.title : null,
        fileUrl: attachmentForm.fileUrl,
      })
      setAttachmentForm({ title: '', fileUrl: '' })
      await refreshAttachments()
    } catch (e: any) {
      setError(e.message || 'Failed to add attachment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Case"
          description="Performance"
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </Card>
      </>
    )
  }

  if (!c) {
    return (
      <>
        <PageHeader
          title="Case"
          description="Performance"
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <p className="text-sm text-gray-600">Case not found.</p>
        </Card>
      </>
    )
  }

  const canAddAttachment = Boolean(me?.isSuperAdmin || me?.isHR)

  return (
    <>
      <PageHeader
        title={`Case #${c.caseNumber}`}
        description="Performance"
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        showBack
        actions={(
          <Button variant="secondary" onClick={() => router.push('/cases/add')} icon={<PlusIcon className="h-4 w-4" />}>
            New Case
          </Button>
        )}
      />

      <div className="space-y-6 max-w-5xl">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{c.title}</h2>
              <p className="text-sm text-gray-600">
                {c.caseType.toLowerCase()} • Severity: {c.severity.toLowerCase()}
              </p>
              {c.subjectEmployee && (
                <p className="text-xs text-gray-500 mt-1">
                  Subject: {c.subjectEmployee.firstName} {c.subjectEmployee.lastName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={c.status} />
              <span className="text-xs text-gray-500">Updated {formatDate(c.updatedAt)}</span>
            </div>
          </div>
        </Card>

        {(canEdit || canAddAttachment) && (
          <Card padding="lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <SelectField
                  label="Status"
                  name="status"
                  options={statusOptions}
                  value={caseForm.status}
                  onChange={(e) => setCaseForm((p) => ({ ...p, status: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-end justify-end">
                <Button onClick={updateCase} loading={saving} disabled={!canEdit || saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <div className="sm:col-span-2">
                <TextareaField
                  label="Description"
                  name="description"
                  value={caseForm.description}
                  onChange={(e) => setCaseForm((p) => ({ ...p, description: e.target.value }))}
                  rows={5}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Participants */}
        {c.participants && c.participants.length > 0 && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Participants</h3>
            <div className="flex flex-wrap gap-2">
              {c.participants.map((p) => (
                <span key={p.id} className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
                  {p.employee.firstName} {p.employee.lastName} • {p.role.toLowerCase()}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card padding="md">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes</h3>

          <div className="space-y-3">
            {(c.notes || []).length === 0 ? (
              <p className="text-sm text-gray-600">No notes yet.</p>
            ) : (
              (c.notes as CaseNote[]).map((note) => (
                <div key={note.id} className="p-4 rounded-lg border border-gray-200 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {note.author.firstName} {note.author.lastName}
                      <span className="ml-2 text-xs text-gray-500">
                        • {note.visibility.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    </p>
                    <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{note.body}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <SelectField
                label="Visibility"
                name="visibility"
                options={visibilityOptions}
                value={noteForm.visibility}
                onChange={(e) => setNoteForm((p) => ({ ...p, visibility: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <TextareaField
                label="Add Note"
                name="noteBody"
                value={noteForm.body}
                onChange={(e) => setNoteForm((p) => ({ ...p, body: e.target.value }))}
                rows={3}
                placeholder="Write a note..."
              />
              <div className="flex justify-end mt-3">
                <Button onClick={addNote} loading={noteSaving} disabled={noteSaving}>
                  {noteSaving ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Attachments */}
        {canAddAttachment && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Attachments</h3>

            <div className="space-y-3">
              {(c.attachments || []).length === 0 ? (
                <p className="text-sm text-gray-600">No attachments.</p>
              ) : (
                (c.attachments || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.title || 'Attachment'}</p>
                      <p className="text-xs text-gray-500">{formatDate(a.createdAt)}</p>
                    </div>
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Open
                    </a>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <FormField
                  label="Title (optional)"
                  name="attachmentTitle"
                  value={attachmentForm.title}
                  onChange={(e) => setAttachmentForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <FormField
                  label="File URL"
                  name="fileUrl"
                  value={attachmentForm.fileUrl}
                  onChange={(e) => setAttachmentForm((p) => ({ ...p, fileUrl: e.target.value }))}
                  placeholder="https://..."
                />
                <div className="flex justify-end mt-3">
                  <Button onClick={addAttachment} loading={saving} disabled={saving}>
                    Add Attachment
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tasks */}
        {c.tasks && c.tasks.length > 0 && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tasks</h3>
            <div className="space-y-2">
              {c.tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500">
                      {t.category.toLowerCase()} • due {formatDate(t.dueDate ?? null)}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

