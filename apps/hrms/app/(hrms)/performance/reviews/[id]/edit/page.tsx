'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ApiError,
  MeApi,
  PerformanceReviewsApi,
  type Me,
  type PerformanceReview,
} from '@/lib/api-client';
import { ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { FormField, SelectField, TextareaField } from '@/components/ui/FormField';
import { useNavigationHistory } from '@/lib/navigation-history';
import {
  REVIEW_PERIOD_TYPES,
  REVIEW_PERIOD_TYPE_LABELS,
  getAllowedReviewPeriodTypes,
  inferReviewPeriodParts,
} from '@/lib/review-period';
import { UpdatePerformanceReviewSchema } from '@/lib/validations';

type FormData = z.infer<typeof UpdatePerformanceReviewSchema>;

// Simplified for small team (15-20 people)
const reviewTypeOptions = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DRAFT: 'Draft',
  PENDING_HR_REVIEW: 'Pending HR Review',
  PENDING_SUPER_ADMIN: 'Pending Admin Approval',
  PENDING_ACKNOWLEDGMENT: 'Pending Acknowledgment',
  ACKNOWLEDGED: 'Acknowledged',
  COMPLETED: 'Completed',
};

const reviewPeriodTypeOptions = REVIEW_PERIOD_TYPES.map((value) => ({
  value,
  label: REVIEW_PERIOD_TYPE_LABELS[value],
}));

function RatingInput({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-danger-500 ml-1">*</span>}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => (disabled ? null : onChange(star))}
            disabled={disabled}
            className={`p-1 transition-transform ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-110'}`}
          >
            {star <= value ? (
              <StarFilledIcon className="h-6 w-6 text-warning-400" />
            ) : (
              <StarIcon className="h-6 w-6 text-muted-foreground/50 hover:text-warning-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function EditReviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { goBack } = useNavigationHistory();
  const currentYear = new Date().getFullYear();

  const [review, setReview] = useState<PerformanceReview | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const periodYearOptions = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx).map(
    (y) => ({
      value: String(y),
      label: String(y),
    }),
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<FormData>({
    resolver: zodResolver(UpdatePerformanceReviewSchema),
    defaultValues: {
      reviewType: 'ANNUAL',
      periodType: 'ANNUAL',
      periodYear: currentYear,
      overallRating: 3,
      qualityOfWork: 3,
      productivity: 3,
      communication: 3,
      teamwork: 3,
      initiative: 3,
      attendance: 3,
    },
  });

  const reviewType = watch('reviewType') ?? 'ANNUAL';
  const periodType = watch('periodType') ?? 'ANNUAL';
  const overallRating = watch('overallRating') ?? 3;
  const qualityOfWork = watch('qualityOfWork') ?? 3;
  const productivity = watch('productivity') ?? 3;
  const communication = watch('communication') ?? 3;
  const teamwork = watch('teamwork') ?? 3;
  const initiative = watch('initiative') ?? 3;
  const attendance = watch('attendance') ?? 3;
  const roleTitle = watch('roleTitle') ?? '';

  useEffect(() => {
    async function load() {
      try {
        const [data, meData] = await Promise.all([
          PerformanceReviewsApi.get(id),
          MeApi.get().catch(() => null),
        ]);
        setReview(data);
        setMe(meData);

        // Infer period parts from review
        const inferredPeriod = inferReviewPeriodParts(data.reviewPeriod);
        const formPeriodType = data.periodType || inferredPeriod.periodType || 'ANNUAL';
        const formPeriodYear = data.periodYear ?? inferredPeriod.periodYear ?? currentYear;

        // Reset form with loaded data
        reset({
          reviewType: (data.reviewType || 'ANNUAL') as 'PROBATION' | 'QUARTERLY' | 'ANNUAL',
          periodType: formPeriodType as any,
          periodYear: formPeriodYear,
          reviewDate: data.reviewDate ? new Date(data.reviewDate).toISOString().split('T')[0] : '',
          roleTitle: data.roleTitle || data.employee?.position || '',
          overallRating: data.overallRating || 3,
          qualityOfWork: data.qualityOfWork || 3,
          productivity: data.productivity || 3,
          communication: data.communication || 3,
          teamwork: data.teamwork || 3,
          initiative: data.initiative || 3,
          attendance: data.attendance || 3,
          strengths: data.strengths || '',
          areasToImprove: data.areasToImprove || '',
          goals: data.goals || '',
          comments: data.comments || '',
        });

        // Auto-start review if NOT_STARTED
        if (data.status === 'NOT_STARTED') {
          try {
            const started = await PerformanceReviewsApi.start(id);
            setReview(started);
            setSuccessMessage('Review started. Fill in the ratings and feedback below.');
          } catch (e: any) {
            console.error('Failed to auto-start review:', e);
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load review');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, currentYear, reset]);

  // Update periodType when reviewType changes
  useEffect(() => {
    const allowedTypes = getAllowedReviewPeriodTypes(reviewType);
    if (!allowedTypes.includes(periodType as any)) {
      setValue('periodType', allowedTypes[0] as any);
    }
  }, [reviewType, periodType, setValue]);

  const isDraft = Boolean(
    review && ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'].includes(review.status),
  );
  const isHrOrAdmin = Boolean(me?.isHR || me?.isSuperAdmin);
  const canEditMeta = Boolean(review) && (isDraft || isHrOrAdmin);
  const canEditContent = isDraft;

  async function onSave(data: FormData) {
    if (!review || !canEditMeta) return;

    setError(null);
    setSuccessMessage(null);

    try {
      const update: Record<string, unknown> = {};

      if (canEditMeta) {
        update.reviewType = data.reviewType;
        update.periodType = data.periodType;
        update.periodYear = data.periodYear;
        update.reviewDate = data.reviewDate;
        update.roleTitle = data.roleTitle;
      }

      if (canEditContent) {
        update.overallRating = data.overallRating;
        update.qualityOfWork = data.qualityOfWork;
        update.productivity = data.productivity;
        update.communication = data.communication;
        update.teamwork = data.teamwork;
        update.initiative = data.initiative;
        update.attendance = data.attendance;
        update.strengths = data.strengths || null;
        update.areasToImprove = data.areasToImprove || null;
        update.goals = data.goals || null;
        update.comments = data.comments || null;
      }

      const updated = await PerformanceReviewsApi.update(id, update);
      setReview(updated);
      setSuccessMessage(canEditContent ? 'Review saved as draft' : 'Review metadata updated');
    } catch (e: any) {
      setError(e.message || 'Failed to save review');
    }
  }

  async function handleSubmitForReview() {
    if (!review || !canEditContent) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Save first using current form values
      const formValues = watch();
      await PerformanceReviewsApi.update(id, {
        reviewType: formValues.reviewType,
        periodType: formValues.periodType,
        periodYear: formValues.periodYear,
        reviewDate: formValues.reviewDate,
        roleTitle: formValues.roleTitle,
        overallRating: formValues.overallRating,
        qualityOfWork: formValues.qualityOfWork,
        productivity: formValues.productivity,
        communication: formValues.communication,
        teamwork: formValues.teamwork,
        initiative: formValues.initiative,
        attendance: formValues.attendance,
        strengths: formValues.strengths || null,
        areasToImprove: formValues.areasToImprove || null,
        goals: formValues.goals || null,
        comments: formValues.comments || null,
      });

      // Then submit for review
      await PerformanceReviewsApi.submit(id);
      router.push('/performance/reviews');
    } catch (e: any) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        const details = e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim());
        setError(
          details.length
            ? details.join(', ')
            : e.body?.error || e.message || 'Failed to submit review',
        );
        return;
      }
      setError(e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Edit Performance Review"
          description="Loading..."
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (!review) {
    return (
      <>
        <PageHeader
          title="Edit Performance Review"
          description="Not Found"
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error || 'Review not found'}</Alert>
          </Card>
        </div>
      </>
    );
  }

  if (!canEditMeta) {
    router.replace(`/performance/reviews/${id}`);
    return null;
  }

  const allowedPeriodTypes = getAllowedReviewPeriodTypes(reviewType);
  const periodTypeOptions = reviewPeriodTypeOptions.filter((opt) =>
    allowedPeriodTypes.includes(opt.value as any),
  );

  return (
    <>
      <PageHeader
        title="Edit Performance Review"
        description={`${review.employee?.firstName} ${review.employee?.lastName}`}
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!canEditContent && (
          <Alert variant="info">
            This review is in workflow stage ({STATUS_LABELS[review.status] || review.status}). You
            can update review period and role metadata, but ratings and feedback are read-only.
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSave)}>
          {/* Employee Info Card */}
          <Card padding="lg" className="mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {review.employee?.firstName} {review.employee?.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {roleTitle} • {review.employee?.department}
                </p>
              </div>
              <StatusBadge status={STATUS_LABELS[review.status] || review.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Review Type"
                required
                options={reviewTypeOptions}
                disabled={!canEditMeta}
                error={errors.reviewType?.message}
                {...register('reviewType')}
              />
              <SelectField
                label="Review Period"
                required
                options={periodTypeOptions}
                disabled={!canEditMeta}
                error={errors.periodType?.message}
                {...register('periodType')}
              />
              <SelectField
                label="Year"
                required
                options={periodYearOptions}
                disabled={!canEditMeta}
                error={errors.periodYear?.message}
                {...register('periodYear')}
              />
              <FormField
                label="Role"
                required
                disabled={!canEditMeta}
                error={errors.roleTitle?.message}
                {...register('roleTitle')}
              />
              <FormField
                label="Review Date"
                type="date"
                required
                disabled={!canEditMeta}
                error={errors.reviewDate?.message}
                {...register('reviewDate')}
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">Manager</label>
                <div className="px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground">
                  {review.assignedReviewer
                    ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}`
                    : review.reviewerName}
                  {review.assignedReviewer?.position && (
                    <span className="text-muted-foreground ml-1">({review.assignedReviewer.position})</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Performance Ratings Card */}
          <Card padding="lg" className="mb-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Performance Ratings</h3>

            {/* Overall Rating - Highlighted */}
            <div className="bg-warning-50 rounded-lg p-4 mb-6">
              <RatingInput
                label="Overall Rating"
                value={overallRating}
                onChange={(v) => setValue('overallRating', v)}
                required
                disabled={!canEditContent}
                error={errors.overallRating?.message}
              />
            </div>

            {/* Individual Ratings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <RatingInput
                label="Quality of Work"
                value={qualityOfWork}
                onChange={(v) => setValue('qualityOfWork', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.qualityOfWork?.message}
              />
              <RatingInput
                label="Productivity"
                value={productivity}
                onChange={(v) => setValue('productivity', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.productivity?.message}
              />
              <RatingInput
                label="Communication"
                value={communication}
                onChange={(v) => setValue('communication', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.communication?.message}
              />
              <RatingInput
                label="Teamwork"
                value={teamwork}
                onChange={(v) => setValue('teamwork', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.teamwork?.message}
              />
              <RatingInput
                label="Initiative"
                value={initiative}
                onChange={(v) => setValue('initiative', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.initiative?.message}
              />
              <RatingInput
                label="Attendance"
                value={attendance}
                onChange={(v) => setValue('attendance', v)}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
                error={errors.attendance?.message}
              />
            </div>
          </Card>

          {/* Feedback Card */}
          <Card padding="lg" className="mb-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Feedback</h3>
            <div className="space-y-4">
              <TextareaField
                label="Strengths"
                rows={3}
                placeholder="Key strengths demonstrated..."
                disabled={!canEditContent}
                error={errors.strengths?.message}
                {...register('strengths')}
              />
              <TextareaField
                label="Areas to Improve"
                rows={3}
                placeholder="Areas that need development..."
                disabled={!canEditContent}
                error={errors.areasToImprove?.message}
                {...register('areasToImprove')}
              />
              <TextareaField
                label="Goals for Next Period"
                rows={3}
                placeholder="Objectives and targets..."
                disabled={!canEditContent}
                error={errors.goals?.message}
                {...register('goals')}
              />
              <TextareaField
                label="Additional Comments"
                rows={3}
                placeholder="Any other observations..."
                disabled={!canEditContent}
                error={errors.comments?.message}
                {...register('comments')}
              />
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={isSaving}>
              {canEditContent ? 'Save Draft' : 'Save Changes'}
            </Button>
            {canEditContent && (
              <Button type="button" onClick={handleSubmitForReview} loading={submitting}>
                Submit for Review
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
