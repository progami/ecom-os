import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLeaveNextActions, type LeaveViewerContext, type LeaveWorkflowRecordInput } from '../../lib/domain/leave/next-actions'

function leave(partial: Partial<LeaveWorkflowRecordInput>): LeaveWorkflowRecordInput {
  return partial as unknown as LeaveWorkflowRecordInput
}

const baseViewer: LeaveViewerContext = {
  employeeId: 'viewer',
  isHR: false,
  isSuperAdmin: false,
}

test('leave: owner can cancel pending request', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING', employeeId: 'viewer', employee: { reportsToId: 'mgr' } as any }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'leave.cancel')
  assert.equal(actions.primary?.disabled, false)
})

test('leave: manager can approve pending request', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING', employeeId: 'emp', employee: { reportsToId: 'viewer' } as any }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'leave.approve')
  assert.equal(actions.primary?.disabled, false)
  assert.ok(actions.secondary.some((a) => a.id === 'leave.reject'))
})

test('leave: non-pending has no actions', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'APPROVED', employeeId: 'viewer', employee: { reportsToId: 'mgr' } as any }),
    baseViewer
  )
  assert.equal(actions.primary, null)
})

