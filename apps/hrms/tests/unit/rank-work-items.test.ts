import test from 'node:test'
import assert from 'node:assert/strict'

import { rankWorkItems } from '../../lib/domain/work-items/rank'
import type { WorkItemDTO } from '../../lib/contracts/work-items'

function wi(overrides: Partial<WorkItemDTO> & Pick<WorkItemDTO, 'id'>): WorkItemDTO {
  return {
    id: overrides.id,
    type: overrides.type ?? 'TEST',
    typeLabel: overrides.typeLabel ?? 'Test',
    title: overrides.title ?? 'Test',
    description: overrides.description ?? null,
    href: overrides.href ?? '/test',
    entity: overrides.entity ?? { type: 'TASK', id: overrides.id },
    stageLabel: overrides.stageLabel ?? 'Stage',
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    dueAt: overrides.dueAt ?? null,
    isOverdue: overrides.isOverdue ?? false,
    overdueDays: overrides.overdueDays ?? null,
    priority: overrides.priority ?? 'NORMAL',
    isActionRequired: overrides.isActionRequired ?? true,
    primaryAction: overrides.primaryAction ?? null,
    secondaryActions: overrides.secondaryActions ?? [],
  }
}

test('rankWorkItems: action required and overdue first', () => {
  const ranked = rankWorkItems([
    wi({ id: 'fyi-high', isActionRequired: false, priority: 'URGENT' }),
    wi({ id: 'action-low', isActionRequired: true, priority: 'LOW' }),
    wi({
      id: 'overdue-1d',
      isActionRequired: true,
      isOverdue: true,
      overdueDays: 1,
      dueAt: '2024-12-31T00:00:00.000Z',
    }),
    wi({
      id: 'overdue-5d',
      isActionRequired: true,
      isOverdue: true,
      overdueDays: 5,
      dueAt: '2024-12-27T00:00:00.000Z',
    }),
  ])

  assert.deepEqual(
    ranked.map((i) => i.id),
    ['overdue-5d', 'overdue-1d', 'action-low', 'fyi-high']
  )
})

test('rankWorkItems: priority then dueAt then createdAt', () => {
  const ranked = rankWorkItems([
    wi({ id: 'p-high', isActionRequired: true, priority: 'HIGH', dueAt: null, createdAt: '2025-01-01T00:00:00.000Z' }),
    wi({ id: 'p-urgent', isActionRequired: true, priority: 'URGENT', dueAt: null, createdAt: '2025-01-02T00:00:00.000Z' }),
    wi({ id: 'due-soon', isActionRequired: true, priority: 'HIGH', dueAt: '2025-02-01T00:00:00.000Z', createdAt: '2025-01-03T00:00:00.000Z' }),
    wi({ id: 'due-later', isActionRequired: true, priority: 'HIGH', dueAt: '2025-03-01T00:00:00.000Z', createdAt: '2025-01-04T00:00:00.000Z' }),
    wi({ id: 'newer', isActionRequired: true, priority: 'LOW', dueAt: null, createdAt: '2025-05-01T00:00:00.000Z' }),
    wi({ id: 'older', isActionRequired: true, priority: 'LOW', dueAt: null, createdAt: '2025-04-01T00:00:00.000Z' }),
  ])

  const ids = ranked.map((i) => i.id)
  assert.equal(ids[0], 'p-urgent')
  assert.deepEqual(ids.slice(1, 4), ['due-soon', 'due-later', 'p-high'])
  assert.deepEqual(ids.slice(4), ['newer', 'older'])
})

