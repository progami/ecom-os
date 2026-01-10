import type { PerformanceReview } from '@ecom-os/prisma-atlas';
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record';

export type PerformanceWorkflowRecordInput = PerformanceReview & {
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    position: string;
    avatar: string | null;
    reportsToId: string | null;
  };
  assignedReviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
  } | null;
};

export type PerformanceViewerContext = {
  employeeId: string;
  isHR: boolean;
  isSuperAdmin: boolean;
  canView: boolean;
};

function isValidRating(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10;
}

function missingRequiredRatings(review: PerformanceWorkflowRecordInput): string[] {
  const missing: string[] = [];

  if (!isValidRating(review.overallRating)) missing.push('Overall');

  if (review.reviewType === 'QUARTERLY') {
    const quarterly: Array<{ key: keyof PerformanceWorkflowRecordInput; label: string }> = [
      { key: 'qualityOfWork', label: 'Quality of work' },
      { key: 'productivity', label: 'Productivity' },
      { key: 'communication', label: 'Communication' },
      { key: 'teamwork', label: 'Teamwork' },
      { key: 'initiative', label: 'Initiative' },
      { key: 'attendance', label: 'Attendance' },
    ];

    for (const field of quarterly) {
      if (!isValidRating(review[field.key])) missing.push(field.label);
    }
  }

  return missing;
}

export function buildPerformanceReviewNextActions(
  review: PerformanceWorkflowRecordInput,
  viewer: PerformanceViewerContext,
): WorkflowRecordDTO['actions'] {
  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] };
  if (!viewer.canView) return actions;

  const isEmployee = viewer.employeeId === review.employeeId;
  const isReviewer = Boolean(
    review.assignedReviewerId && viewer.employeeId === review.assignedReviewerId,
  );

  switch (review.status) {
    case 'NOT_STARTED':
      if (isReviewer) {
        actions.primary = {
          id: 'review.start',
          label: 'Start review',
          variant: 'primary',
          disabled: false,
        };
      } else {
        actions.primary = {
          id: 'review.start',
          label: 'Waiting for manager',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the assigned reviewer can start this review.',
        };
      }
      return actions;

    case 'IN_PROGRESS':
    case 'DRAFT':
      if (isReviewer) {
        const missing = missingRequiredRatings(review);
        actions.primary = missing.length
          ? {
              id: 'review.submit',
              label: 'Submit to HR',
              variant: 'primary',
              disabled: true,
              disabledReason: `Complete required ratings before submitting (${missing.length} missing).`,
            }
          : { id: 'review.submit', label: 'Submit to HR', variant: 'primary', disabled: false };
      } else {
        actions.primary = {
          id: 'review.submit',
          label: 'Waiting for submission',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the assigned reviewer can submit this review.',
        };
      }
      return actions;

    case 'PENDING_HR_REVIEW':
      if (viewer.isHR) {
        actions.primary = {
          id: 'review.hrApprove',
          label: 'Approve (HR)',
          variant: 'primary',
          disabled: false,
        };
        actions.secondary = [
          { id: 'review.hrReject', label: 'Request changes', variant: 'secondary', disabled: false },
        ];
      } else {
        actions.primary = {
          id: 'review.hrApprove',
          label: 'Waiting for HR review',
          variant: 'primary',
          disabled: true,
          disabledReason: 'HR must review before final approval.',
        };
      }
      return actions;

    case 'PENDING_SUPER_ADMIN':
      if (viewer.isSuperAdmin) {
        actions.primary = {
          id: 'review.superAdminApprove',
          label: 'Final approve',
          variant: 'primary',
          disabled: false,
        };
        actions.secondary = [
          { id: 'review.superAdminReject', label: 'Request changes', variant: 'secondary', disabled: false },
        ];
      } else {
        actions.primary = {
          id: 'review.superAdminApprove',
          label: 'Waiting for final approval',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only Super Admin can give final approval.',
        };
      }
      return actions;

    case 'PENDING_ACKNOWLEDGMENT':
      if (isEmployee) {
        actions.primary = {
          id: 'review.acknowledge',
          label: 'Acknowledge',
          variant: 'primary',
          disabled: false,
        };
      } else {
        actions.primary = {
          id: 'review.acknowledge',
          label: 'Waiting for acknowledgement',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the employee can acknowledge this review.',
        };
      }
      return actions;

    default:
      return actions;
  }
}
