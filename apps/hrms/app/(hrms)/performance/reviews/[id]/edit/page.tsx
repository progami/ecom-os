'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ApiError,
  MeApi,
  PerformanceReviewsApi,
  type Me,
  type PerformanceReview,
} from '@/lib/api-client';
import { ClipboardDocumentCheckIcon, StarIcon, StarFilledIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/ui/Badge';
import { FormField, SelectField, TextareaField } from '@/components/ui/FormField';
import { useNavigationHistory } from '@/lib/navigation-history';
import {
  REVIEW_PERIOD_TYPES,
  REVIEW_PERIOD_TYPE_LABELS,
  getAllowedReviewPeriodTypes,
  inferReviewPeriodParts,
} from '@/lib/review-period';

const reviewTypeOptions = [
  { value: 'PROBATION', label: 'Probation (90-day)' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'PIP', label: 'Performance Improvement Plan' },
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
  name,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
  disabled?: boolean;
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
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export default function EditReviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { goBack } = useNavigationHistory();

  const [review, setReview] = useState<PerformanceReview | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rating states
  const [overallRating, setOverallRating] = useState(3);
  const [qualityOfWork, setQualityOfWork] = useState(3);
  const [productivity, setProductivity] = useState(3);
  const [communication, setCommunication] = useState(3);
  const [teamwork, setTeamwork] = useState(3);
  const [initiative, setInitiative] = useState(3);
  const [attendance, setAttendance] = useState(3);
  const currentYear = new Date().getFullYear();
  const periodYearOptions = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx).map(
    (y) => ({
      value: String(y),
      label: String(y),
    }),
  );
  const [reviewType, setReviewType] = useState('ANNUAL');
  const [periodType, setPeriodType] = useState('ANNUAL');
  const [periodYear, setPeriodYear] = useState(String(currentYear));
  const [roleTitle, setRoleTitle] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [data, meData] = await Promise.all([
          PerformanceReviewsApi.get(id),
          MeApi.get().catch(() => null),
        ]);
        setReview(data);
        setMe(meData);

        // Initialize rating states from loaded data
        setOverallRating(data.overallRating || 3);
        setQualityOfWork(data.qualityOfWork || 3);
        setProductivity(data.productivity || 3);
        setCommunication(data.communication || 3);
        setTeamwork(data.teamwork || 3);
        setInitiative(data.initiative || 3);
        setAttendance(data.attendance || 3);

        // Auto-start review if NOT_STARTED
        if (data.status === 'NOT_STARTED') {
          try {
            const started = await PerformanceReviewsApi.start(id);
            setReview(started);
            setSuccessMessage('Review started. Fill in the ratings and feedback below.');
          } catch (e: any) {
            console.error('Failed to auto-start review:', e);
            // Non-fatal - continue with editing
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load review');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!review) return;
    setReviewType(review.reviewType);

    const inferredPeriod = inferReviewPeriodParts(review.reviewPeriod);
    const nextPeriodType = review.periodType || inferredPeriod.periodType || 'ANNUAL';
    const nextPeriodYear = review.periodYear ?? inferredPeriod.periodYear ?? currentYear;
    setPeriodType(nextPeriodType);
    setPeriodYear(String(nextPeriodYear));
    setRoleTitle(review.roleTitle || review.employee?.position || '');
  }, [currentYear, review]);

  const isDraft = Boolean(
    review && ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'].includes(review.status),
  );
  const isHrOrAdmin = Boolean(me?.isHR || me?.isSuperAdmin);

  // Managers can edit draft/in-progress reviews; HR/Admin can edit metadata in later stages.
  const canEditMeta = Boolean(review) && (isDraft || isHrOrAdmin);
  const canEditContent = isDraft;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!review || !canEditMeta) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as any;

    try {
      const update: Record<string, unknown> = {};

      if (canEditMeta) {
        update.reviewType = String(payload.reviewType);
        update.periodType = String(payload.periodType);
        update.periodYear = parseInt(String(payload.periodYear), 10);
        update.reviewDate = String(payload.reviewDate);
        update.roleTitle = String(payload.roleTitle);
      }

      if (canEditContent) {
        update.overallRating = parseInt(payload.overallRating, 10);
        update.qualityOfWork = parseInt(payload.qualityOfWork, 10);
        update.productivity = parseInt(payload.productivity, 10);
        update.communication = parseInt(payload.communication, 10);
        update.teamwork = parseInt(payload.teamwork, 10);
        update.initiative = parseInt(payload.initiative, 10);
        update.attendance = parseInt(payload.attendance, 10);
        update.strengths = payload.strengths || null;
        update.areasToImprove = payload.areasToImprove || null;
        update.goals = payload.goals || null;
        update.comments = payload.comments || null;
      }

      const updated = await PerformanceReviewsApi.update(id, update);
      setReview(updated);
      setSuccessMessage(canEditContent ? 'Review saved as draft' : 'Review metadata updated');
    } catch (e: any) {
      setError(e.message || 'Failed to save review');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!review || !canEditContent) return;

    // First save the current form state
    const form = document.querySelector('form') as HTMLFormElement;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries()) as any;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Save first
      await PerformanceReviewsApi.update(id, {
        reviewType: String(payload.reviewType),
        periodType: String(payload.periodType),
        periodYear: parseInt(String(payload.periodYear), 10),
        reviewDate: String(payload.reviewDate),
        roleTitle: String(payload.roleTitle),
        overallRating: parseInt(payload.overallRating, 10),
        qualityOfWork: parseInt(payload.qualityOfWork, 10),
        productivity: parseInt(payload.productivity, 10),
        communication: parseInt(payload.communication, 10),
        teamwork: parseInt(payload.teamwork, 10),
        initiative: parseInt(payload.initiative, 10),
        attendance: parseInt(payload.attendance, 10),
        strengths: payload.strengths || null,
        areasToImprove: payload.areasToImprove || null,
        goals: payload.goals || null,
        comments: payload.comments || null,
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

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

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

  // Non-editable for current viewer - redirect to view page
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

        <form onSubmit={handleSave}>
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
                name="reviewType"
                required
                options={reviewTypeOptions}
                value={reviewType}
                onChange={(e) => {
                  const nextReviewType = e.target.value;
                  setReviewType(nextReviewType);
                  const nextAllowed = getAllowedReviewPeriodTypes(nextReviewType);
                  if (!nextAllowed.includes(periodType as any)) {
                    setPeriodType(nextAllowed[0] ?? 'ANNUAL');
                  }
                }}
                disabled={!canEditMeta}
              />
              <SelectField
                label="Review Period"
                name="periodType"
                required
                options={periodTypeOptions}
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                disabled={!canEditMeta}
              />
              <SelectField
                label="Year"
                name="periodYear"
                required
                options={periodYearOptions}
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                disabled={!canEditMeta}
              />
              <FormField
                label="Role"
                name="roleTitle"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                disabled={!canEditMeta}
              />
              <FormField
                label="Review Date"
                name="reviewDate"
                type="date"
                required
                defaultValue={formatDateForInput(review.reviewDate)}
                disabled={!canEditMeta}
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
                name="overallRating"
                label="Overall Rating"
                value={overallRating}
                onChange={setOverallRating}
                required
                disabled={!canEditContent}
              />
            </div>

            {/* Individual Ratings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <RatingInput
                name="qualityOfWork"
                label="Quality of Work"
                value={qualityOfWork}
                onChange={setQualityOfWork}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
              <RatingInput
                name="productivity"
                label="Productivity"
                value={productivity}
                onChange={setProductivity}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
              <RatingInput
                name="communication"
                label="Communication"
                value={communication}
                onChange={setCommunication}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
              <RatingInput
                name="teamwork"
                label="Teamwork"
                value={teamwork}
                onChange={setTeamwork}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
              <RatingInput
                name="initiative"
                label="Initiative"
                value={initiative}
                onChange={setInitiative}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
              <RatingInput
                name="attendance"
                label="Attendance"
                value={attendance}
                onChange={setAttendance}
                required={review.reviewType === 'QUARTERLY'}
                disabled={!canEditContent}
              />
            </div>
          </Card>

          {/* Feedback Card */}
          <Card padding="lg" className="mb-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Feedback</h3>
            <div className="space-y-4">
              <TextareaField
                label="Strengths"
                name="strengths"
                rows={3}
                placeholder="Key strengths demonstrated..."
                defaultValue={review.strengths || ''}
                disabled={!canEditContent}
              />
              <TextareaField
                label="Areas to Improve"
                name="areasToImprove"
                rows={3}
                placeholder="Areas that need development..."
                defaultValue={review.areasToImprove || ''}
                disabled={!canEditContent}
              />
              <TextareaField
                label="Goals for Next Period"
                name="goals"
                rows={3}
                placeholder="Objectives and targets..."
                defaultValue={review.goals || ''}
                disabled={!canEditContent}
              />
              <TextareaField
                label="Additional Comments"
                name="comments"
                rows={3}
                placeholder="Any other observations..."
                defaultValue={review.comments || ''}
                disabled={!canEditContent}
              />
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={saving}>
              {canEditContent ? 'Save Draft' : 'Save Changes'}
            </Button>
            {canEditContent && (
              <Button type="button" onClick={handleSubmit} loading={submitting}>
                Submit for Review
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
