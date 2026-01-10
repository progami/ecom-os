'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/select'
import type { ActionId } from '@/lib/contracts/action-ids'

export type ActionInputConfig = {
  title: string
  description: string
  inputLabel: string
  inputPlaceholder: string
  required: boolean
  minLength?: number
  confirmLabel: string
  confirmVariant: 'primary' | 'danger'
  // For disciplinary.appeal.hrDecide which needs a dropdown + textarea
  selectField?: {
    label: string
    options: { value: string; label: string }[]
    defaultValue: string
  }
}

// Configuration for actions that need input
export const ACTION_INPUT_CONFIGS: Partial<Record<ActionId, ActionInputConfig>> = {
  'review.hrApprove': {
    title: 'Approve Review',
    description: 'Add optional notes for this approval.',
    inputLabel: 'HR Notes',
    inputPlaceholder: 'Add any notes for the reviewer...',
    required: false,
    confirmLabel: 'Approve',
    confirmVariant: 'primary',
  },
  'review.hrReject': {
    title: 'Request Changes',
    description: 'The review will be sent back to the manager for revisions.',
    inputLabel: 'Feedback for Manager',
    inputPlaceholder: 'What changes are needed? This helps the manager improve the review...',
    required: false,
    confirmLabel: 'Request Changes',
    confirmVariant: 'danger',
  },
  'review.superAdminApprove': {
    title: 'Final Approval',
    description: 'This will finalize the review and send it for employee acknowledgment.',
    inputLabel: 'Approval Notes',
    inputPlaceholder: 'Add any final notes...',
    required: false,
    confirmLabel: 'Approve',
    confirmVariant: 'primary',
  },
  'review.superAdminReject': {
    title: 'Request Changes',
    description: 'The review will be sent back for revisions.',
    inputLabel: 'Rejection Reason',
    inputPlaceholder: 'What changes are needed?',
    required: false,
    confirmLabel: 'Request Changes',
    confirmVariant: 'danger',
  },
  'leave.reject': {
    title: 'Reject Leave Request',
    description: 'The employee will be notified of this rejection.',
    inputLabel: 'Reason (Optional)',
    inputPlaceholder: 'Add a reason for rejection (visible to the employee)...',
    required: false,
    confirmLabel: 'Reject',
    confirmVariant: 'danger',
  },
  'disciplinary.hrApprove': {
    title: 'Approve Disciplinary Action',
    description: 'This will advance the action to the next approval stage.',
    inputLabel: 'HR Notes',
    inputPlaceholder: 'Add any review notes...',
    required: false,
    confirmLabel: 'Approve',
    confirmVariant: 'primary',
  },
  'disciplinary.hrReject': {
    title: 'Request Changes',
    description: 'The action will be sent back to the reporter for revisions.',
    inputLabel: 'Feedback',
    inputPlaceholder: 'What changes are needed?',
    required: false,
    confirmLabel: 'Request Changes',
    confirmVariant: 'danger',
  },
  'disciplinary.superAdminApprove': {
    title: 'Final Approval',
    description: 'This will finalize the disciplinary action.',
    inputLabel: 'Approval Notes',
    inputPlaceholder: 'Add any final notes...',
    required: false,
    confirmLabel: 'Approve',
    confirmVariant: 'primary',
  },
  'disciplinary.superAdminReject': {
    title: 'Request Changes',
    description: 'The action will be sent back for revisions.',
    inputLabel: 'Feedback',
    inputPlaceholder: 'What changes are needed?',
    required: false,
    confirmLabel: 'Request Changes',
    confirmVariant: 'danger',
  },
  'disciplinary.appeal': {
    title: 'File Appeal',
    description: 'Explain why you believe this action should be reconsidered.',
    inputLabel: 'Appeal Reason',
    inputPlaceholder: 'Provide a detailed explanation of your appeal...',
    required: true,
    minLength: 10,
    confirmLabel: 'Submit Appeal',
    confirmVariant: 'primary',
  },
  'disciplinary.appeal.hrDecide': {
    title: 'Appeal Decision',
    description: 'Make a final decision on this appeal.',
    inputLabel: 'Decision Explanation',
    inputPlaceholder: 'Explain the reasoning behind this decision...',
    required: true,
    confirmLabel: 'Submit Decision',
    confirmVariant: 'primary',
    selectField: {
      label: 'Decision',
      options: [
        { value: 'UPHELD', label: 'Upheld — Original action stands' },
        { value: 'MODIFIED', label: 'Modified — Action is adjusted' },
        { value: 'OVERTURNED', label: 'Overturned — Action is reversed' },
      ],
      defaultValue: 'UPHELD',
    },
  },
}

export type ActionInput = {
  notes?: string
  // For appeal decision
  appealStatus?: 'UPHELD' | 'MODIFIED' | 'OVERTURNED'
}

type ActionInputModalProps = {
  open: boolean
  actionId: ActionId | null
  onClose: () => void
  onConfirm: (actionId: ActionId, input: ActionInput) => void
  loading?: boolean
}

export function ActionInputModal({
  open,
  actionId,
  onClose,
  onConfirm,
  loading = false,
}: ActionInputModalProps) {
  const [notes, setNotes] = useState('')
  const [appealStatus, setAppealStatus] = useState<'UPHELD' | 'MODIFIED' | 'OVERTURNED'>('UPHELD')
  const [error, setError] = useState<string | null>(null)

  const config = actionId ? ACTION_INPUT_CONFIGS[actionId] : null

  const handleClose = useCallback(() => {
    setNotes('')
    setAppealStatus('UPHELD')
    setError(null)
    onClose()
  }, [onClose])

  const handleConfirm = useCallback(() => {
    if (!actionId || !config) return

    // Validation
    const trimmedNotes = notes.trim()

    if (config.required && !trimmedNotes) {
      setError(`${config.inputLabel} is required`)
      return
    }

    if (config.minLength && trimmedNotes.length < config.minLength) {
      setError(`${config.inputLabel} must be at least ${config.minLength} characters`)
      return
    }

    setError(null)

    const input: ActionInput = {
      notes: trimmedNotes || undefined,
    }

    // For appeal decision, include the status
    if (actionId === 'disciplinary.appeal.hrDecide') {
      input.appealStatus = appealStatus
    }

    onConfirm(actionId, input)
    handleClose()
  }, [actionId, config, notes, appealStatus, onConfirm, handleClose])

  if (!config) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Select field for appeal decision */}
          {config.selectField && (
            <div className="space-y-2">
              <Label htmlFor="action-select">{config.selectField.label}</Label>
              <NativeSelect
                id="action-select"
                value={appealStatus}
                onChange={(e) => setAppealStatus(e.target.value as typeof appealStatus)}
              >
                {config.selectField.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {/* Notes/reason textarea */}
          <div className="space-y-2">
            <Label htmlFor="action-notes">
              {config.inputLabel}
              {config.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id="action-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setError(null)
              }}
              placeholder={config.inputPlaceholder}
              rows={4}
              className="resize-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {config.minLength && (
              <p className="text-xs text-muted-foreground">
                {notes.length}/{config.minLength} characters minimum
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            loading={loading}
          >
            {config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Check if an action requires modal input
 */
export function actionNeedsInput(actionId: ActionId): boolean {
  return actionId in ACTION_INPUT_CONFIGS
}
