'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiError, PerformanceReviewsApi } from '@/lib/api-client';
import type { ActionId } from '@/lib/contracts/action-ids';
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record';
import { executeAction } from '@/lib/actions/execute-action';
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StarFilledIcon } from '@/components/ui/Icons';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function RatingDisplay({ label, value }: { label: string; value: number | null | undefined }) {
  const hasRating = value != null && value > 0;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {hasRating ? (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarFilledIcon
              key={star}
              className={`h-4 w-4 ${star <= (value ?? 0) ? 'text-warning-400' : 'text-muted'}`}
            />
          ))}
          <span className="ml-2 text-sm font-medium text-foreground">{value}/5</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Not rated</span>
      )}
    </div>
  );
}

export default function PerformanceReviewWorkflowPage() {
  const params = useParams();
  const id = params.id as string;

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null);
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workflow, raw] = await Promise.all([
        PerformanceReviewsApi.getWorkflowRecord(id),
        PerformanceReviewsApi.get(id),
      ]);
      setDto(workflow);
      setReview(raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load performance review';
      setError(message);
      setDto(null);
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAction = useCallback(
    async (actionId: ActionId) => {
      setError(null);
      setErrorDetails(null);
      try {
        await executeAction(actionId, { type: 'PERFORMANCE_REVIEW', id });
        await load();
      } catch (e) {
        if (e instanceof ApiError && Array.isArray(e.body?.details)) {
          setError(e.body?.error || 'Validation failed');
          setErrorDetails(e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()));
          return;
        }

        const message = e instanceof Error ? e.message : 'Failed to complete action';
        setError(message);
      }
    },
    [id, load],
  );

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (!dto) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Performance review</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
      </Card>
    );
  }

  return (
    <>
      {error ? (
        <Alert
          variant="error"
          className="mb-6"
          title={errorDetails?.length ? error : undefined}
          onDismiss={() => {
            setError(null);
            setErrorDetails(null);
          }}
        >
          {errorDetails?.length ? (
            <div className="space-y-3">
              <ul className="list-disc pl-5 space-y-1">
                {errorDetails.map((d, idx) => (
                  <li key={`${idx}:${d}`}>{d}</li>
                ))}
              </ul>
              <div>
                <Button variant="secondary" href={`/performance/reviews/${id}/edit`}>
                  Edit review
                </Button>
              </div>
            </div>
          ) : (
            error
          )}
        </Alert>
      ) : null}

      <WorkflowRecordLayout data={dto} onAction={onAction} backHref="/performance/reviews">
        {review ? (
          <div className="space-y-6">
            <div className="flex items-center justify-end">
              <Button variant="secondary" href={`/performance/reviews/${id}/edit`}>
                Edit review
              </Button>
            </div>

            <Card padding="lg">
              <h3 className="text-sm font-semibold text-foreground mb-3">Review details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Review type</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {review.reviewType?.replaceAll('_', ' ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Period</p>
                  <p className="text-sm text-foreground mt-0.5">{review.reviewPeriod || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Role</p>
                  <p className="text-sm text-foreground mt-0.5">{review.roleTitle || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Review date</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(review.reviewDate)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Manager</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {review.assignedReviewer
                      ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}${review.assignedReviewer.position ? ` (${review.assignedReviewer.position})` : ''}`
                      : review.reviewerName}
                  </p>
                </div>
              </div>
            </Card>

            <Card padding="lg">
              <h3 className="text-sm font-semibold text-foreground mb-3">Ratings</h3>
              <div className="divide-y divide-border">
                <RatingDisplay label="Overall" value={review.overallRating} />
                <RatingDisplay label="Quality of work" value={review.qualityOfWork} />
                <RatingDisplay label="Productivity" value={review.productivity} />
                <RatingDisplay label="Communication" value={review.communication} />
                <RatingDisplay label="Teamwork" value={review.teamwork} />
                <RatingDisplay label="Initiative" value={review.initiative} />
                <RatingDisplay label="Attendance" value={review.attendance} />
              </div>
            </Card>

            {review.strengths || review.areasToImprove || review.goals || review.comments ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Feedback</h3>
                <div className="space-y-4 text-sm">
                  {review.strengths ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Strengths</p>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">
                        {review.strengths}
                      </p>
                    </div>
                  ) : null}
                  {review.areasToImprove ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Areas to improve</p>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">
                        {review.areasToImprove}
                      </p>
                    </div>
                  ) : null}
                  {review.goals ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Goals</p>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">
                        {review.goals}
                      </p>
                    </div>
                  ) : null}
                  {review.comments ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Additional comments</p>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">
                        {review.comments}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </WorkflowRecordLayout>
    </>
  );
}
