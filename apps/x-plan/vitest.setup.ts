import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const fallback = {
    salesWeek: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }

  return {
    __esModule: true,
    default: fallback,
    prisma: fallback,
  }
})

vi.mock('@handsontable/react', () => ({
  HotTable: ({ data }: { data: unknown[] }) =>
    React.createElement('div', {
      'data-testid': 'hot-table',
      'data-rows': Array.isArray(data) ? data.length : 0,
    }),
}))

Object.defineProperty(window, 'location', {
  writable: true,
  value: { ...window.location, reload: () => undefined },
})

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:mock-url',
    writable: true,
  })
}

if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
  })
}
