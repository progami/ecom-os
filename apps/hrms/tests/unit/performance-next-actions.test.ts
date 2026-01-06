import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPerformanceReviewNextActions,
  type PerformanceViewerContext,
  type PerformanceWorkflowRecordInput,
} from '../../lib/domain/performance/next-actions'

function review(partial: Partial<PerformanceWorkflowRecordInput>): PerformanceWorkflowRecordInput {
  return partial as unknown as PerformanceWorkflowRecordInput
}

const baseViewer: PerformanceViewerContext = {
  employeeId: 'viewer',
  isHR: false,
  isSuperAdmin: false,
  canView: true,
}

test('performance: NOT_STARTED lets assigned reviewer start', () => {
  const actions = buildPerformanceReviewNextActions(
    review({ status: 'NOT_STARTED', employeeId: 'emp', assignedReviewerId: 'viewer' }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'review.start')
  assert.equal(actions.primary?.disabled, false)
})

test('performance: PENDING_HR_REVIEW blocks non-HR', () => {
  const actions = buildPerformanceReviewNextActions(review({ status: 'PENDING_HR_REVIEW', employeeId: 'emp' }), baseViewer)
  assert.equal(actions.primary?.disabled, true)
})

test('performance: PENDING_SUPER_ADMIN blocks non-super-admin', () => {
  const actions = buildPerformanceReviewNextActions(
    review({ status: 'PENDING_SUPER_ADMIN', employeeId: 'emp' }),
    baseViewer
  )
  assert.equal(actions.primary?.disabled, true)
})

test('performance: PENDING_SUPER_ADMIN lets super admin approve', () => {
  const actions = buildPerformanceReviewNextActions(
    review({ status: 'PENDING_SUPER_ADMIN', employeeId: 'emp' }),
    { ...baseViewer, isSuperAdmin: true }
  )
  assert.equal(actions.primary?.id, 'review.superAdminApprove')
  assert.equal(actions.primary?.disabled, false)
})

test('performance: PENDING_ACKNOWLEDGMENT lets employee acknowledge', () => {
  const actions = buildPerformanceReviewNextActions(
    review({ status: 'PENDING_ACKNOWLEDGMENT', employeeId: 'viewer' }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'review.acknowledge')
  assert.equal(actions.primary?.disabled, false)
})
