'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ApiError,
  DisciplinaryActionsApi,
  MeApi,
  getApiBase,
  type DisciplinaryAction,
  type Me,
} from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DISCIPLINARY_ACTION_TYPE_LABELS,
  VALUE_BREACH_LABELS,
  VIOLATION_REASON_LABELS,
  VIOLATION_TYPE_LABELS,
} from '@/lib/domain/disciplinary/constants'

type NotesDialogState = {
  actionId:
    | 'disciplinary.hrApprove'
    | 'disciplinary.hrReject'
    | 'disciplinary.superAdminApprove'
    | 'disciplinary.superAdminReject'
  title: string
  description: string
  approved: boolean
  required: boolean
}

type AppealDecision = 'UPHELD' | 'MODIFIED' | 'OVERTURNED'

function buildApiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function postJson(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = payload?.error || payload?.message || `${res.status} ${res.statusText}`
    throw new ApiError(msg, res.status, payload)
  }

  return payload
}

function toLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replaceAll('_', ' ')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function NoteSection({
  title,
  status,
  when,
  note,
}: {
  title: string
  status: string
  when: string
  note?: string | null
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{when}</p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold tracking-wide">
          {status}
        </span>
      </div>
      {note ? <p className="mt-3 text-sm text-foreground whitespace-pre-line">{note}</p> : null}
    </div>
  )
}

export default function ViolationWorkflowPage() {
  const params = useParams()
  const id = params.id as string

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [record, setRecord] = useState<DisciplinaryAction | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null)

  const [submitting, setSubmitting] = useState(false)

  const [notesDialog, setNotesDialog] = useState<NotesDialogState | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [notesError, setNotesError] = useState<string | null>(null)

  const [appealOpen, setAppealOpen] = useState(false)
  const [appealDraft, setAppealDraft] = useState('')
  const [appealError, setAppealError] = useState<string | null>(null)

  const [appealDecisionOpen, setAppealDecisionOpen] = useState(false)
  const [appealDecision, setAppealDecision] = useState<AppealDecision>('UPHELD')
  const [appealDecisionDraft, setAppealDecisionDraft] = useState('')
  const [appealDecisionError, setAppealDecisionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetails(null)

    try {
      const [workflow, raw, meData] = await Promise.all([
        DisciplinaryActionsApi.getWorkflowRecord(id),
        DisciplinaryActionsApi.get(id),
        MeApi.get().catch(() => null),
      ])

      setDto(workflow)
      setRecord(raw)
      setMe(meData)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load violation'
      setError(message)
      setErrorDetails(null)
      setDto(null)
      setRecord(null)
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = useMemo(() => {
    if (!me || !record) return false
    return Boolean(me.isHR || me.isSuperAdmin || (record.createdById && record.createdById === me.id))
  }, [me, record])

  const onAction = useCallback(
    async (actionId: ActionId) => {
      setError(null)
      setErrorDetails(null)

      if (!record) return

      const fail = (e: unknown) => {
        if (e instanceof ApiError && Array.isArray(e.body?.details)) {
          setError(e.body?.error || 'Validation failed')
          setErrorDetails(
            e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()),
          )
          return
        }

        const message = e instanceof Error ? e.message : 'Failed to complete action'
        setError(message)
      }

      try {
        if (actionId === 'disciplinary.acknowledge') {
          setSubmitting(true)
          await postJson(`/api/disciplinary-actions/${encodeURIComponent(id)}/acknowledge`)
          await load()
          return
        }

        if (actionId === 'disciplinary.appeal') {
          setAppealError(null)
          setAppealDraft(record.appealReason ?? '')
          setAppealOpen(true)
          return
        }

        if (actionId === 'disciplinary.appeal.hrDecide') {
          setAppealDecisionError(null)
          setAppealDecision('UPHELD')
          setAppealDecisionDraft('')
          setAppealDecisionOpen(true)
          return
        }

        if (
          actionId === 'disciplinary.hrApprove' ||
          actionId === 'disciplinary.hrReject' ||
          actionId === 'disciplinary.superAdminApprove' ||
          actionId === 'disciplinary.superAdminReject'
        ) {
          const isHr = actionId.startsWith('disciplinary.hr')
          const approved = actionId.endsWith('Approve')
          const required = !approved

          setNotesError(null)
          setNotesDraft('')
          setNotesDialog({
            actionId,
            approved,
            required,
            title: approved
              ? isHr
                ? 'Approve as HR'
                : 'Final approval'
              : isHr
                ? 'Request changes (HR)'
                : 'Request changes (Admin)',
            description: approved
              ? 'Optionally leave short notes for the record.'
              : 'Write what needs to be fixed before you can approve.',
          })
          return
        }
      } catch (e) {
        fail(e)
      } finally {
        setSubmitting(false)
      }
    },
    [id, load, record],
  )

  const submitNotes = useCallback(async () => {
    if (!notesDialog) return

    const notes = notesDraft.trim()
    if (notesDialog.required && !notes) {
      setNotesError('Notes are required.')
      return
    }

    setNotesError(null)
    setSubmitting(true)
    setError(null)
    setErrorDetails(null)

    try {
      const endpoint =
        notesDialog.actionId === 'disciplinary.hrApprove' || notesDialog.actionId === 'disciplinary.hrReject'
          ? 'hr-review'
          : 'super-admin-review'

      await postJson(
        `/api/disciplinary-actions/${encodeURIComponent(id)}/${endpoint}`,
        {
          approved: notesDialog.approved,
          notes: notes ? notes : null,
        },
      )

      setNotesDialog(null)
      setNotesDraft('')
      await load()
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        setError(e.body?.error || 'Validation failed')
        setErrorDetails(
          e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()),
        )
        return
      }

      const message = e instanceof Error ? e.message : 'Failed to submit action'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [id, load, notesDialog, notesDraft])

  const submitAppeal = useCallback(async () => {
    const text = appealDraft.trim()
    if (text.length < 10) {
      setAppealError('Appeal text must be at least 10 characters.')
      return
    }

    setAppealError(null)
    setSubmitting(true)
    setError(null)
    setErrorDetails(null)

    try {
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(id)}/appeal`, {
        appealReason: text,
      })
      setAppealOpen(false)
      await load()
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        setAppealError(e.body?.error || 'Validation failed')
        return
      }

      const message = e instanceof Error ? e.message : 'Failed to submit appeal'
      setAppealError(message)
    } finally {
      setSubmitting(false)
    }
  }, [appealDraft, id, load])

  const decideAppeal = useCallback(async () => {
    const text = appealDecisionDraft.trim()
    if (!text) {
      setAppealDecisionError('Decision text is required.')
      return
    }

    setAppealDecisionError(null)
    setSubmitting(true)
    setError(null)
    setErrorDetails(null)

    try {
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(id)}/appeal`, {
        hrDecision: true,
        appealStatus: appealDecision,
        appealResolution: text,
      })
      setAppealDecisionOpen(false)
      await load()
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        setAppealDecisionError(e.body?.error || 'Validation failed')
        return
      }

      const message = e instanceof Error ? e.message : 'Failed to decide appeal'
      setAppealDecisionError(message)
    } finally {
      setSubmitting(false)
    }
  }, [appealDecision, appealDecisionDraft, id, load])

  const approvalBlocks = useMemo(() => {
    if (!record) return null

    const hrStatus =
      record.hrApproved === true ? 'Approved' : record.hrApproved === false ? 'Changes requested' : 'Pending'

    const adminStatus =
      record.superAdminApproved === true
        ? 'Approved'
        : record.superAdminApproved === false
          ? 'Changes requested'
          : 'Pending'

    const ackStatus = record.employeeAcknowledged && record.managerAcknowledged
      ? 'Complete'
      : record.employeeAcknowledged
        ? 'Waiting for manager'
        : record.managerAcknowledged
          ? 'Waiting for employee'
          : 'Waiting for acknowledgements'

    const appealStatus = record.appealedAt
      ? record.appealResolvedAt
        ? `Decided: ${record.appealStatus ?? '—'}`
        : 'Pending HR decision'
      : 'No appeal'

    return {
      hr: {
        status: hrStatus,
        when: record.hrReviewedAt ? formatWhen(record.hrReviewedAt) : '—',
        note: record.hrReviewNotes ?? null,
      },
      admin: {
        status: adminStatus,
        when: record.superAdminApprovedAt ? formatWhen(record.superAdminApprovedAt) : '—',
        note: record.superAdminNotes ?? null,
      },
      ack: {
        status: ackStatus,
        when: record.employeeAcknowledgedAt ? formatWhen(record.employeeAcknowledgedAt) : '—',
        note: null,
      },
      appeal: {
        status: appealStatus,
        when: record.appealedAt ? formatWhen(record.appealedAt) : '—',
        note: record.appealReason ?? null,
      },
    }
  }, [record])

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </Card>
    )
  }

  if (!dto || !record) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Violation</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
        <div className="mt-4">
          <Button variant="secondary" href="/performance/violations">
            Back to Violations
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      {error ? (
        <Alert
          variant="error"
          className="mb-6"
          title={errorDetails?.length ? error : undefined}
          onDismiss={() => {
            setError(null)
            setErrorDetails(null)
          }}
        >
          {errorDetails?.length ? (
            <div className="space-y-3">
              <ul className="list-disc pl-5 space-y-1">
                {errorDetails.map((d, idx) => (
                  <li key={`${idx}:${d}`}>{d}</li>
                ))}
              </ul>
              {canEdit ? (
                <div>
                  <Button variant="secondary" href={`/performance/violations/${id}/edit`}>
                    Edit record
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            error
          )}
        </Alert>
      ) : null}

      <WorkflowRecordLayout
        data={dto}
        backHref="/performance/violations"
        onAction={onAction}
        headerActions={
          canEdit ? (
            <Button variant="secondary" href={`/performance/violations/${id}/edit`}>
              Edit
            </Button>
          ) : null
        }
      >
        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Card padding="lg" className="relative overflow-hidden border-danger-200/60">
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(239,68,68,0.10)_0%,transparent_55%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.2em] text-danger-700 uppercase">
                    Violation file
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {record.employee?.firstName} {record.employee?.lastName}
                    </span>{' '}
                    • {record.employee?.position} • {record.employee?.department}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-muted-foreground">Record ID</p>
                  <p className="mt-1 font-mono text-xs text-foreground">{record.id}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Type</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {toLabel(VIOLATION_TYPE_LABELS as Record<string, string>, record.violationType)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {toLabel(VIOLATION_REASON_LABELS as Record<string, string>, record.violationReason)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Severity</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {record.severity.replaceAll('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(15,23,42,0.08)_0%,transparent_55%)]" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground">Narrative</p>
                <p className="text-xs text-muted-foreground">
                  Incident: <span className="text-foreground">{formatDate(record.incidentDate)}</span>
                </p>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line">{record.description}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Reported by</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {record.createdBy ? `${record.createdBy.firstName} ${record.createdBy.lastName}` : record.reportedBy}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Reported: {formatDate(record.reportedDate)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Action taken</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {toLabel(DISCIPLINARY_ACTION_TYPE_LABELS as Record<string, string>, record.actionTaken)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Action date: {record.actionDate ? formatDate(record.actionDate) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {record.valuesBreached?.length ? (
            <Card padding="lg">
              <p className="text-sm font-semibold text-foreground">Values breached</p>
              <p className="text-xs text-muted-foreground mt-1">
                Used for escalation rules and coaching focus.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {record.valuesBreached.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center rounded-full border border-danger-200 bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-800"
                  >
                    {toLabel(VALUE_BREACH_LABELS as Record<string, string>, value)}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          {(record.witnesses || record.evidence) ? (
            <Card padding="lg">
              <p className="text-sm font-semibold text-foreground">Evidence & witnesses</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Witnesses</p>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-line">
                    {record.witnesses || '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-line">
                    {record.evidence || '—'}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card padding="lg">
            <p className="text-sm font-semibold text-foreground">Approvals & appeal</p>
            <p className="text-xs text-muted-foreground mt-1">
              This record loops until it gets approved (or appeal overturns it).
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4">
              {approvalBlocks ? (
                <>
                  <NoteSection
                    title="HR review"
                    status={approvalBlocks.hr.status}
                    when={approvalBlocks.hr.when}
                    note={approvalBlocks.hr.note}
                  />
                  <NoteSection
                    title="Final approval"
                    status={approvalBlocks.admin.status}
                    when={approvalBlocks.admin.when}
                    note={approvalBlocks.admin.note}
                  />
                  <NoteSection
                    title="Acknowledgements"
                    status={approvalBlocks.ack.status}
                    when={approvalBlocks.ack.when}
                  />
                  <NoteSection
                    title="Appeal"
                    status={approvalBlocks.appeal.status}
                    when={approvalBlocks.appeal.when}
                    note={approvalBlocks.appeal.note}
                  />
                  {record.appealResolvedAt || record.appealResolution ? (
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <p className="text-sm font-semibold text-foreground">Appeal decision</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {record.appealResolvedAt ? formatWhen(record.appealResolvedAt) : '—'} •{' '}
                        {record.appealStatus ?? '—'}
                      </p>
                      {record.appealResolution ? (
                        <p className="mt-3 text-sm text-foreground whitespace-pre-line">
                          {record.appealResolution}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </Card>
        </div>
      </WorkflowRecordLayout>

      <Dialog
        open={Boolean(notesDialog)}
        onOpenChange={(open) => {
          if (submitting) return
          if (!open) {
            setNotesDialog(null)
            setNotesDraft('')
            setNotesError(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{notesDialog?.title ?? 'Update'}</DialogTitle>
            <DialogDescription>{notesDialog?.description ?? ''}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes {notesDialog?.required ? <span className="text-destructive">*</span> : null}</Label>
            <Textarea
              id="notes"
              value={notesDraft}
              onChange={(e) => {
                setNotesDraft(e.target.value)
                setNotesError(null)
              }}
              placeholder={notesDialog?.approved ? 'Optional…' : 'Be specific: what needs updating?'}
              className={cn(notesError && 'border-destructive')}
              rows={5}
            />
            {notesError ? <p className="text-xs text-destructive">{notesError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setNotesDialog(null)
                setNotesDraft('')
                setNotesError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              variant={notesDialog?.approved ? 'primary' : 'danger'}
              onClick={() => {
                void submitNotes()
              }}
            >
              {notesDialog?.approved ? 'Confirm' : 'Send back'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={appealOpen}
        onOpenChange={(open) => {
          if (submitting) return
          setAppealOpen(open)
          if (!open) {
            setAppealDraft('')
            setAppealError(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{record?.status === 'APPEAL_PENDING_HR' ? 'Update appeal' : 'Submit appeal'}</DialogTitle>
            <DialogDescription>
              Keep it factual. Include context, dates, and what outcome you’re requesting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="appealText">
              Appeal text <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="appealText"
              value={appealDraft}
              onChange={(e) => {
                setAppealDraft(e.target.value)
                setAppealError(null)
              }}
              placeholder="Write your appeal…"
              className={cn(appealError && 'border-destructive')}
              rows={7}
            />
            {appealError ? <p className="text-xs text-destructive">{appealError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" disabled={submitting} onClick={() => setAppealOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void submitAppeal()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={appealDecisionOpen}
        onOpenChange={(open) => {
          if (submitting) return
          setAppealDecisionOpen(open)
          if (!open) {
            setAppealDecision('UPHELD')
            setAppealDecisionDraft('')
            setAppealDecisionError(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Decide appeal (HR)</DialogTitle>
            <DialogDescription>
              If you uphold or modify the decision, the record returns to acknowledgement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="appealDecision">Decision</Label>
              <NativeSelect
                id="appealDecision"
                value={appealDecision}
                onChange={(e) => setAppealDecision(e.target.value as AppealDecision)}
              >
                <option value="UPHELD">Upheld (violation stands)</option>
                <option value="MODIFIED">Modified (adjust action/severity)</option>
                <option value="OVERTURNED">Overturned (dismiss violation)</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appealDecisionText">
                Decision text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="appealDecisionText"
                value={appealDecisionDraft}
                onChange={(e) => {
                  setAppealDecisionDraft(e.target.value)
                  setAppealDecisionError(null)
                }}
                placeholder="Explain the decision…"
                className={cn(appealDecisionError && 'border-destructive')}
                rows={6}
              />
              {appealDecisionError ? (
                <p className="text-xs text-destructive">{appealDecisionError}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" disabled={submitting} onClick={() => setAppealDecisionOpen(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void decideAppeal()}>
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {submitting ? (
        <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground shadow">
            Working…
          </div>
        </div>
      ) : null}
    </>
  )
}

