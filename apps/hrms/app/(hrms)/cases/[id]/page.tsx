'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CaseAttachmentsApi,
  CasesApi,
  DisciplinaryActionsApi,
  EmployeesApi,
  MeApi,
  TasksApi,
  UploadsApi,
  type Case,
  type CaseNote,
  type Employee,
  type Me,
  type Task,
} from '@/lib/api-client'
import { PlusIcon } from '@/components/ui/Icons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/Badge'
import { FormField, SelectField, TextareaField } from '@/components/ui/FormField'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { executeAction } from '@/lib/actions/execute-action'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

const closingStatuses = new Set(['RESOLVED', 'CLOSED', 'DISMISSED'])

const participantRoleOptions = [
  { value: 'SUBJECT', label: 'Subject' },
  { value: 'ASSIGNEE', label: 'Assignee' },
  { value: 'REPORTER', label: 'Reporter' },
  { value: 'WITNESS', label: 'Witness' },
  { value: 'HR', label: 'HR' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'OTHER', label: 'Other' },
]

const addParticipantRoleOptions = participantRoleOptions.filter((opt) => opt.value !== 'SUBJECT' && opt.value !== 'ASSIGNEE')

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

  const [workflow, setWorkflow] = useState<WorkflowRecordDTO | null>(null)
  const [linkedDisciplinaryId, setLinkedDisciplinaryId] = useState<string | null>(null)
  const [c, setC] = useState<Case | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [participantSaving, setParticipantSaving] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
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

  const statusOptionsForActor = useMemo(() => {
    if (me?.isSuperAdmin || me?.isHR) return statusOptions
    return statusOptions.filter((opt) => !closingStatuses.has(opt.value))
  }, [me])

  const employeeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const seen = new Set<string>()

    if (me) {
      options.push({ value: me.id, label: `Me (${me.employeeId})` })
      seen.add(me.id)
    }

    for (const e of employees) {
      if (seen.has(e.id)) continue
      options.push({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeId})` })
      seen.add(e.id)
    }

    return options
  }, [employees, me])

  const [caseForm, setCaseForm] = useState({
    status: 'OPEN',
    description: '',
    statusNote: '',
  })

  const [noteForm, setNoteForm] = useState({
    body: '',
    visibility: 'EMPLOYEE_VISIBLE',
  })

  const [attachmentTitle, setAttachmentTitle] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentVisibility, setAttachmentVisibility] = useState<'INTERNAL_HR' | 'EMPLOYEE_AND_HR'>('INTERNAL_HR')

  const [participantForm, setParticipantForm] = useState({
    employeeId: '',
    role: 'WITNESS',
  })

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignedToId: '',
  })

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [caseData, meData, caseWorkflow] = await Promise.all([
        CasesApi.get(id),
        MeApi.get(),
        CasesApi.getWorkflowRecord(id),
      ])

      let workflowData: WorkflowRecordDTO = caseWorkflow
      let disciplinaryActionId: string | null = null

      if (caseData.caseType === 'VIOLATION') {
        const linked = await CasesApi.getLinkedDisciplinary(caseData.id)
        disciplinaryActionId = linked.disciplinaryActionId
        if (disciplinaryActionId) {
          workflowData = await DisciplinaryActionsApi.getWorkflowRecord(disciplinaryActionId)
        }
      }

      setC(caseData)
      setMe(meData)
      setWorkflow(workflowData)
      setLinkedDisciplinaryId(disciplinaryActionId)
      setCaseForm({
        status: caseData.status,
        description: caseData.description ?? '',
        statusNote: '',
      })
      setNoteForm((prev) => ({
        ...prev,
        visibility: meData.isHR || meData.isSuperAdmin ? 'INTERNAL_HR' : 'EMPLOYEE_VISIBLE',
      }))

      setTaskForm((p) => ({
        ...p,
        assignedToId: caseData.assignedToId ?? meData.id,
      }))

      if (meData.isHR || meData.isSuperAdmin) {
        setLoadingEmployees(true)
        try {
          const list = await EmployeesApi.listManageable()
          setEmployees(list.items || [])
        } finally {
          setLoadingEmployees(false)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load case')
      setC(null)
      setWorkflow(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

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
      const statusChanged = caseForm.status !== c.status
      const note = statusChanged ? caseForm.statusNote.trim() : ''
      const isClosing = statusChanged && closingStatuses.has(caseForm.status)

      if (isClosing && !note) {
        setError('A status note is required when resolving/closing/dismissing a case.')
        return
      }

      const updated = await CasesApi.update(c.id, {
        status: caseForm.status,
        description: caseForm.description ? caseForm.description : null,
        statusNote: statusChanged ? (note ? note : null) : null,
      })
      setC((prev) => (prev ? { ...prev, ...updated } : updated))
      setCaseForm((p) => ({ ...p, statusNote: '' }))

      try {
        const wf = linkedDisciplinaryId
          ? await DisciplinaryActionsApi.getWorkflowRecord(linkedDisciplinaryId)
          : await CasesApi.getWorkflowRecord(c.id)
        setWorkflow(wf)
      } catch {
        // Non-fatal: case updated but workflow header may be stale until refresh.
      }

      if (statusChanged && note) {
        await refreshNotes()
      }
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
    if (!attachmentFile) return
    setSaving(true)
    setError(null)
    try {
      const contentType = attachmentFile.type || 'application/octet-stream'
      const presign = await UploadsApi.presign({
        filename: attachmentFile.name,
        contentType,
        size: attachmentFile.size,
        target: { type: 'CASE', id },
        visibility: attachmentVisibility,
      })

      const put = await fetch(presign.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: attachmentFile,
      })

      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`)
      }

      await UploadsApi.finalize({
        key: presign.key,
        filename: attachmentFile.name,
        contentType,
        size: attachmentFile.size,
        target: { type: 'CASE', id },
        visibility: attachmentVisibility,
        title: attachmentTitle.trim() || null,
      })

      setAttachmentTitle('')
      setAttachmentFile(null)
      await refreshAttachments()
    } catch (e: any) {
      setError(e.message || 'Failed to add attachment')
    } finally {
      setSaving(false)
    }
  }

  async function downloadAttachment(attachmentId: string) {
    setError(null)
    try {
      const { url } = await CaseAttachmentsApi.getDownloadUrl(id, attachmentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      setError(e.message || 'Failed to download attachment')
    }
  }

  async function addParticipant() {
    if (!participantForm.employeeId) return

    setParticipantSaving(true)
    setError(null)
    try {
      const created = await CasesApi.addParticipant(id, {
        employeeId: participantForm.employeeId,
        role: participantForm.role,
      })

      setC((prev) => {
        if (!prev) return prev
        const existing = prev.participants || []
        const next = existing.some((p) => p.id === created.id)
          ? existing.map((p) => (p.id === created.id ? created : p))
          : [...existing, created]
        next.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
        return { ...prev, participants: next }
      })

      setParticipantForm((p) => ({ ...p, employeeId: '' }))
    } catch (e: any) {
      setError(e.message || 'Failed to add participant')
    } finally {
      setParticipantSaving(false)
    }
  }

  async function updateParticipantRole(participantId: string, role: string) {
    setParticipantSaving(true)
    setError(null)
    try {
      const updated = await CasesApi.updateParticipant(id, participantId, { role })
      setC((prev) => {
        if (!prev) return prev
        const existing = prev.participants || []
        const next = existing.map((p) => (p.id === participantId ? updated : p))
        return { ...prev, participants: next }
      })
    } catch (e: any) {
      setError(e.message || 'Failed to update participant')
    } finally {
      setParticipantSaving(false)
    }
  }

  async function removeParticipant(participantId: string) {
    setParticipantSaving(true)
    setError(null)
    try {
      await CasesApi.removeParticipant(id, participantId)
      setC((prev) => {
        if (!prev) return prev
        const existing = prev.participants || []
        return { ...prev, participants: existing.filter((p) => p.id !== participantId) }
      })
    } catch (e: any) {
      setError(e.message || 'Failed to remove participant')
    } finally {
      setParticipantSaving(false)
    }
  }

  async function addCaseTask() {
    if (!c) return
    if (!taskForm.title.trim()) return

    setTaskSaving(true)
    setError(null)
    try {
      const created = await TasksApi.create({
        title: taskForm.title.trim(),
        description: taskForm.description ? taskForm.description : null,
        category: 'CASE',
        dueDate: taskForm.dueDate ? taskForm.dueDate : null,
        assignedToId: taskForm.assignedToId ? taskForm.assignedToId : null,
        subjectEmployeeId: c.subjectEmployeeId ?? null,
        caseId: c.id,
      })

      setC((prev) => {
        if (!prev) return prev
        const existing = prev.tasks || []
        const next: Task[] = [created, ...existing]
        next.sort((a, b) => {
          const ad = a.dueDate ?? ''
          const bd = b.dueDate ?? ''
          if (ad !== bd) return ad.localeCompare(bd)
          return b.createdAt.localeCompare(a.createdAt)
        })
        return { ...prev, tasks: next }
      })

      setTaskForm((p) => ({ ...p, title: '', description: '', dueDate: '' }))
      setShowTaskForm(false)
    } catch (e: any) {
      setError(e.message || 'Failed to create task')
    } finally {
      setTaskSaving(false)
    }
  }

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </Card>
    )
  }

  if (!c) {
    return (
      <>
        <Card padding="lg">
          <p className="text-sm text-gray-600">Case not found.</p>
        </Card>
      </>
    )
  }

  const canAddAttachment = Boolean(me?.isSuperAdmin || me?.isHR)

  const onAction = useCallback(async (actionId: ActionId) => {
    setError(null)
    try {
      await executeAction(
        actionId,
        linkedDisciplinaryId
          ? { type: 'DISCIPLINARY_ACTION', id: linkedDisciplinaryId }
          : { type: 'CASE', id }
      )
      await loadAll()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [id, linkedDisciplinaryId, loadAll])

  return (
    <>
      {error && (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {workflow ? (
        <WorkflowRecordLayout data={workflow} onAction={onAction} backHref="/cases">
          <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-end">
              <Button variant="secondary" onClick={() => router.push('/cases/add')} icon={<PlusIcon className="h-4 w-4" />}>
                New Case
              </Button>
            </div>

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
                      options={statusOptionsForActor}
                      value={caseForm.status}
                      onChange={(e) => setCaseForm((p) => ({
                        ...p,
                        status: e.target.value,
                        statusNote: closingStatuses.has(e.target.value) ? p.statusNote : '',
                      }))}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button onClick={updateCase} loading={saving} disabled={!canEdit || saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {Boolean((me?.isHR || me?.isSuperAdmin) && caseForm.status !== c.status && closingStatuses.has(caseForm.status)) && (
                    <div className="sm:col-span-2">
                      <TextareaField
                        label="Status Note (required)"
                        name="statusNote"
                        value={caseForm.statusNote}
                        onChange={(e) => setCaseForm((p) => ({ ...p, statusNote: e.target.value }))}
                        rows={3}
                        placeholder="Add a brief explanation for the resolution/closure..."
                        disabled={!canEdit}
                      />
                    </div>
                  )}
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
            <Card padding="md">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Participants</h3>

          <div className="space-y-2">
            {(c.participants || []).map((p) => {
              const isProtected = p.role === 'SUBJECT' || p.role === 'ASSIGNEE'

              return (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                  <div className="text-sm text-gray-900">
                    {p.employee.firstName} {p.employee.lastName}
                    <span className="ml-2 text-xs text-gray-500">• {p.role.toLowerCase()}</span>
                  </div>

                  {(me?.isHR || me?.isSuperAdmin) && (
                    <div className="flex items-center gap-2">
                      <select
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={p.role}
                        onChange={(e) => updateParticipantRole(p.id, e.target.value)}
                        disabled={participantSaving}
                      >
                        {participantRoleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      <Button
                        variant="secondary"
                        onClick={() => removeParticipant(p.id)}
                        disabled={participantSaving || isProtected}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {(me?.isHR || me?.isSuperAdmin) && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectField
                  label="Add participant"
                  name="participantEmployeeId"
                  options={employeeOptions}
                  placeholder={loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                  value={participantForm.employeeId}
                  onChange={(e) => setParticipantForm((p) => ({ ...p, employeeId: e.target.value }))}
                  disabled={participantSaving}
                />

                <SelectField
                  label="Role"
                  name="participantRole"
                  options={addParticipantRoleOptions}
                  value={participantForm.role}
                  onChange={(e) => setParticipantForm((p) => ({ ...p, role: e.target.value }))}
                  disabled={participantSaving}
                />

                <div className="flex items-end justify-end">
                  <Button
                    onClick={addParticipant}
                    loading={participantSaving}
                    disabled={participantSaving || !participantForm.employeeId}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
            </Card>

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
                      <p className="text-xs text-gray-500">
                        {a.fileName ? `${a.fileName} • ` : ''}
                        {a.visibility ? `${a.visibility.replaceAll('_', ' ').toLowerCase()} • ` : ''}
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => downloadAttachment(a.id)}>
                      Download
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <FormField
                  label="Title (optional)"
                  name="attachmentTitle"
                  value={attachmentTitle}
                  onChange={(e) => setAttachmentTitle(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <SelectField
                  label="Visibility"
                  name="attachmentVisibility"
                  options={[
                    { value: 'INTERNAL_HR', label: 'Internal (HR only)' },
                    { value: 'EMPLOYEE_AND_HR', label: 'Employee visible' },
                  ]}
                  value={attachmentVisibility}
                  onChange={(e) => setAttachmentVisibility(e.target.value as any)}
                />
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-700">File</label>
                  <input
                    className="mt-1 block w-full text-sm text-gray-700"
                    type="file"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="flex justify-end mt-3">
                  <Button onClick={addAttachment} loading={saving} disabled={saving || !attachmentFile}>
                    Add Attachment
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tasks */}
        {(((c.tasks || []).length > 0) || Boolean(me?.isSuperAdmin || me?.isHR)) && (
          <Card padding="md">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
              {(me?.isSuperAdmin || me?.isHR) && (
                <Button
                  variant="secondary"
                  onClick={() => setShowTaskForm((p) => !p)}
                  disabled={taskSaving}
                >
                  {showTaskForm ? 'Cancel' : 'Add Task'}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {(c.tasks || []).length === 0 ? (
                <p className="text-sm text-gray-600">No case tasks.</p>
              ) : (
                (c.tasks || []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/tasks/${t.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">
                        {t.category.toLowerCase()}
                        {t.assignedTo ? ` • assigned to ${t.assignedTo.firstName} ${t.assignedTo.lastName}` : ''}
                        {` • due ${formatDate(t.dueDate ?? null)}`}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              )}
            </div>

            {(me?.isSuperAdmin || me?.isHR) && showTaskForm && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FormField
                      label="Title"
                      name="caseTaskTitle"
                      required
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                      disabled={taskSaving}
                      placeholder="e.g., Collect witness statement"
                    />
                  </div>

                  <FormField
                    label="Due Date"
                    name="caseTaskDueDate"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                    disabled={taskSaving}
                  />

                  <SelectField
                    label="Assigned To"
                    name="caseTaskAssignedToId"
                    options={employeeOptions}
                    placeholder={loadingEmployees ? 'Loading employees...' : 'Unassigned'}
                    value={taskForm.assignedToId}
                    onChange={(e) => setTaskForm((p) => ({ ...p, assignedToId: e.target.value }))}
                    disabled={taskSaving}
                  />

                  <div className="sm:col-span-2">
                    <TextareaField
                      label="Description (optional)"
                      name="caseTaskDescription"
                      value={taskForm.description}
                      onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      disabled={taskSaving}
                    />
                    <div className="flex justify-end mt-3">
                      <Button
                        onClick={addCaseTask}
                        loading={taskSaving}
                        disabled={taskSaving || !taskForm.title.trim()}
                      >
                        Create Task
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
          </div>
        </WorkflowRecordLayout>
      ) : (
        <Card padding="lg">
          <p className="text-sm text-gray-600">Unable to load workflow view.</p>
        </Card>
      )}
    </>
  )
}
