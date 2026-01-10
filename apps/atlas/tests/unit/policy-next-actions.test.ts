import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPolicyNextActions } from '../../lib/domain/policies/next-actions'

test('policy: applicable and not acknowledged can acknowledge', () => {
  const actions = buildPolicyNextActions({ status: 'ACTIVE' } as any, { isApplicable: true, isAcknowledged: false })
  assert.equal(actions.primary?.id, 'policy.acknowledge')
  assert.equal(actions.primary?.disabled, false)
})

test('policy: not applicable is disabled', () => {
  const actions = buildPolicyNextActions({ status: 'ACTIVE' } as any, { isApplicable: false, isAcknowledged: false })
  assert.equal(actions.primary?.disabled, true)
})

test('policy: already acknowledged is disabled', () => {
  const actions = buildPolicyNextActions({ status: 'ACTIVE' } as any, { isApplicable: true, isAcknowledged: true })
  assert.equal(actions.primary?.disabled, true)
})

test('policy: inactive is disabled', () => {
  const actions = buildPolicyNextActions({ status: 'ARCHIVED' } as any, { isApplicable: true, isAcknowledged: false })
  assert.equal(actions.primary?.disabled, true)
})

