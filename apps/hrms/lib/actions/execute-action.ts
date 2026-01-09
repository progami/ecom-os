import {
  LeavesApi,
  PerformanceReviewsApi,
  PolicyAcknowledgementsApi,
  TasksApi,
  getApiBase,
} from '@/lib/api-client';
import type { ActionId } from '@/lib/contracts/action-ids';
import type { WorkItemEntity } from '@/lib/contracts/work-items';
import type { ActionInput } from '@/components/workflow/ActionInputModal';

function buildApiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    let message = payload?.error || payload?.message || `${res.status} ${res.statusText}`;
    if (
      Array.isArray(payload?.details) &&
      payload.details.some((d: unknown) => typeof d === 'string' && d.trim())
    ) {
      message = `${message}: ${payload.details.filter((d: unknown) => typeof d === 'string' && d.trim()).join(', ')}`;
    }
    throw new Error(message);
  }
  return payload as T;
}

export async function executeAction(
  actionId: ActionId,
  entity: WorkItemEntity,
  input?: ActionInput,
): Promise<void> {
  switch (actionId) {
    case 'policy.acknowledge': {
      if (entity.type !== 'POLICY') throw new Error('Invalid action target');
      await PolicyAcknowledgementsApi.acknowledge(entity.id);
      return;
    }

    case 'review.start': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await PerformanceReviewsApi.start(entity.id);
      return;
    }

    case 'review.submit': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await PerformanceReviewsApi.submit(entity.id);
      return;
    }

    case 'review.hrApprove': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: true,
        notes: input?.notes || null,
      });
      return;
    }

    case 'review.hrReject': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: false,
        notes: input?.notes || null,
      });
      return;
    }

    case 'review.superAdminApprove': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/super-admin-review`, {
        approved: true,
        notes: input?.notes || null,
      });
      return;
    }

    case 'review.superAdminReject': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await postJson(`/api/performance-reviews/${encodeURIComponent(entity.id)}/super-admin-review`, {
        approved: false,
        notes: input?.notes || null,
      });
      return;
    }

    case 'review.acknowledge': {
      if (entity.type !== 'PERFORMANCE_REVIEW') throw new Error('Invalid action target');
      await PerformanceReviewsApi.acknowledge(entity.id);
      return;
    }

    case 'leave.approve': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target');
      const leave = await LeavesApi.get(entity.id);

      if (leave.permissions?.canManagerApprove || ['PENDING', 'PENDING_MANAGER'].includes(leave.status)) {
        await LeavesApi.managerApprove(entity.id, { approved: true });
        return;
      }

      if (leave.permissions?.canHRApprove || leave.status === 'PENDING_HR') {
        await LeavesApi.hrApprove(entity.id, { approved: true });
        return;
      }

      if (leave.permissions?.canSuperAdminApprove || leave.status === 'PENDING_SUPER_ADMIN') {
        await LeavesApi.superAdminApprove(entity.id, { approved: true });
        return;
      }

      throw new Error('You do not have permission to approve this leave request.');
    }

    case 'leave.reject': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target');

      const leave = await LeavesApi.get(entity.id);
      const notes = input?.notes || undefined;

      if (leave.permissions?.canManagerApprove || ['PENDING', 'PENDING_MANAGER'].includes(leave.status)) {
        await LeavesApi.managerApprove(entity.id, { approved: false, notes });
        return;
      }

      if (leave.permissions?.canHRApprove || leave.status === 'PENDING_HR') {
        await LeavesApi.hrApprove(entity.id, { approved: false, notes });
        return;
      }

      if (leave.permissions?.canSuperAdminApprove || leave.status === 'PENDING_SUPER_ADMIN') {
        await LeavesApi.superAdminApprove(entity.id, { approved: false, notes });
        return;
      }

      throw new Error('You do not have permission to reject this leave request.');
    }

    case 'leave.cancel': {
      if (entity.type !== 'LEAVE_REQUEST') throw new Error('Invalid action target');
      await LeavesApi.update(entity.id, { status: 'CANCELLED' });
      return;
    }

    case 'task.markDone': {
      if (entity.type !== 'TASK') throw new Error('Invalid action target');
      await TasksApi.update(entity.id, { status: 'DONE' });
      return;
    }

    case 'task.markInProgress': {
      if (entity.type !== 'TASK') throw new Error('Invalid action target');
      await TasksApi.update(entity.id, { status: 'IN_PROGRESS' });
      return;
    }

    case 'disciplinary.hrApprove': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: true,
        notes: input?.notes || null,
      });
      return;
    }

    case 'disciplinary.hrReject': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/hr-review`, {
        approved: false,
        notes: input?.notes || null,
      });
      return;
    }

    case 'disciplinary.superAdminApprove': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/super-admin-review`, {
        approved: true,
        notes: input?.notes || null,
      });
      return;
    }

    case 'disciplinary.superAdminReject': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/super-admin-review`, {
        approved: false,
        notes: input?.notes || null,
      });
      return;
    }

    case 'disciplinary.acknowledge': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/acknowledge`);
      return;
    }

    case 'disciplinary.appeal': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      if (!input?.notes || input.notes.length < 10) {
        throw new Error('Appeal reason must be at least 10 characters.');
      }
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/appeal`, {
        appealReason: input.notes,
      });
      return;
    }

    case 'disciplinary.appeal.hrDecide': {
      if (entity.type !== 'DISCIPLINARY_ACTION') throw new Error('Invalid action target');
      if (!input?.appealStatus || !['UPHELD', 'MODIFIED', 'OVERTURNED'].includes(input.appealStatus)) {
        throw new Error('Invalid decision. Use UPHELD, MODIFIED, or OVERTURNED.');
      }
      if (!input?.notes) {
        throw new Error('Decision explanation is required.');
      }
      await postJson(`/api/disciplinary-actions/${encodeURIComponent(entity.id)}/appeal`, {
        hrDecision: true,
        appealStatus: input.appealStatus,
        appealResolution: input.notes,
      });
      return;
    }

    default:
      throw new Error(`Action not supported yet: ${actionId}`);
  }
}
