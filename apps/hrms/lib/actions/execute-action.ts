import {
  CasesApi,
  LeavesApi,
  PerformanceReviewsApi,
  PolicyAcknowledgementsApi,
  TasksApi,
  getApiBase,
} from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkItemEntity } from '@/lib/contracts/work-items'

function buildApiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = payload?.error || payload?.message || `${res.status} ${res.statusText}`
    throw new Error(message)
  }
  return payload as T
}

export async function executeAction(actionId: ActionId, entity: WorkItemEntity): Promise<void> {
  switch (actionId) {
    case 'policy.acknowledge': {
      if (entity.type !== 'POLICY') throw new Error('Invalid action target')
      await PolicyAcknowledgementsApi.acknowledge(entity.id)
      return
    }

    case 'review.start': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      await PerformanceReviewsApi.start(entity.id)
      return
    }

    case 'review.submit': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      await PerformanceReviewsApi.submit(entity.id)
      return
    }

    case 'review.hrApprove': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add HR notes.', '') ?? ''
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: true,
        notes: notes.trim() || null,
      })
      return
    }

    case 'review.hrReject': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add HR notes (helpful for the manager).', '') ?? ''
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: false,
        notes: notes.trim() || null,
      })
      return
    }

    case 'review.adminApprove': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add final approval notes.', '') ?? ''
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/super-admin-approve`, {
        approved: true,
        notes: notes.trim() || null,
      })
      return
    }

    case 'review.adminReject': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add rejection notes.', '') ?? ''
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/super-admin-approve`, {
        approved: false,
        notes: notes.trim() || null,
      })
      return
    }

    case 'leave.approve': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target')
      await LeavesApi.update(entity.id, { status: 'APPROVED' })
      return
    }

    case 'leave.reject': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add a short reason/notes for rejection (visible to requester).', '') ?? ''
      await LeavesApi.update(entity.id, { status: 'REJECTED', reviewNotes: notes.trim() || undefined })
      return
    }

    case 'leave.cancel': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target')
      await LeavesApi.update(entity.id, { status: 'CANCELLED' })
      return
    }

    case 'task.markDone': {
      if (entity.type !== 'TASK') throw new Error('Invalid action target')
      await TasksApi.update(entity.id, { status: 'DONE' })
      return
    }

    case 'task.markInProgress': {
      if (entity.type !== 'TASK') throw new Error('Invalid action target')
      await TasksApi.update(entity.id, { status: 'IN_PROGRESS' })
      return
    }

    case 'case.setStatus': {
      if (entity.type !== 'CASE') throw new Error('Invalid action target')
      const nextStatus = (window.prompt('New status: OPEN, IN_REVIEW, ON_HOLD, RESOLVED, CLOSED, DISMISSED', 'IN_REVIEW') ?? '').trim().toUpperCase()
      const allowed = new Set(['OPEN', 'IN_REVIEW', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'DISMISSED'])
      if (!allowed.has(nextStatus)) throw new Error('Invalid status.')

      let statusNote: string | null = null
      if (['RESOLVED', 'CLOSED', 'DISMISSED'].includes(nextStatus)) {
        const note = window.prompt('Status note (required for resolve/close/dismiss).', '') ?? ''
        if (!note.trim()) throw new Error('Status note is required for this status.')
        statusNote = note.trim()
      }

      await CasesApi.update(entity.id, {
        status: nextStatus,
        statusNote,
      })
      return
    }

    case 'review.acknowledge': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target')
      await PerformanceReviewsApi.acknowledge(entity.id)
      return
    }

    case 'disciplinary.hrApprove': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add HR review notes.', '') ?? ''
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: true,
        notes: notes.trim() || null,
      })
      return
    }

    case 'disciplinary.hrReject': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add rejection reason/notes.', '') ?? ''
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: false,
        notes: notes.trim() || null,
      })
      return
    }

    case 'disciplinary.adminApprove': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add final approval notes.', '') ?? ''
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/super-admin-approve`, {
        approved: true,
        notes: notes.trim() || null,
      })
      return
    }

    case 'disciplinary.adminReject': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add rejection reason/notes.', '') ?? ''
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/super-admin-approve`, {
        approved: false,
        notes: notes.trim() || null,
      })
      return
    }

    case 'disciplinary.acknowledge': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/acknowledge`)
      return
    }

    case 'disciplinary.appeal': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const appealReason = window.prompt('Explain your appeal (required).', '') ?? ''
      if (appealReason.trim().length < 10) throw new Error('Appeal reason must be at least 10 characters.')
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/appeal`, { appealReason: appealReason.trim() })
      return
    }

    case 'disciplinary.appeal.hrForward': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const notes = window.prompt('Optional: add HR notes for the Super Admin.', '') ?? ''
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/appeal`, {
        hrReview: {
          forwardToSuperAdmin: true,
          notes: notes.trim() || null,
        },
      })
      return
    }

    case 'disciplinary.appeal.adminDecide': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target')
      const decision = (window.prompt('Appeal decision: UPHELD, MODIFIED, or OVERTURNED', 'UPHELD') ?? '').trim().toUpperCase()
      if (!['UPHELD', 'MODIFIED', 'OVERTURNED'].includes(decision)) {
        throw new Error('Invalid decision. Use UPHELD, MODIFIED, or OVERTURNED.')
      }
      const explanation = window.prompt('Decision explanation (required).', '') ?? ''
      if (!explanation.trim()) throw new Error('Decision explanation is required.')

      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/appeal`, {
        superAdminDecision: true,
        appealStatus: decision,
        appealResolution: explanation.trim(),
      })
      return
    }

    default:
      throw new Error(`Action not supported yet: ${actionId}`)
  }
}
