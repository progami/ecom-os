import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkbookLayout } from '@/components/workbook-layout'
import type { YearSegment } from '@/lib/calculations/calendar'
import { SHEETS } from '@/lib/sheets'
import type { WorkbookSheetStatus } from '@/lib/workbook'

const pushMock = vi.fn()
let searchParamsInstance: URLSearchParams

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/sheet/1-product-setup',
  useSearchParams: () => searchParamsInstance,
}))

const planningYears: YearSegment[] = [
  { year: 2025, startWeekNumber: 1, endWeekNumber: 52, weekCount: 52 },
  { year: 2026, startWeekNumber: 53, endWeekNumber: 104, weekCount: 52 },
  { year: 2027, startWeekNumber: 105, endWeekNumber: 156, weekCount: 52 },
]

const sheetStatus: WorkbookSheetStatus[] = SHEETS.map((sheet, index) => ({
  slug: sheet.slug,
  label: sheet.label,
  description: sheet.description,
  recordCount: 0,
  status: index === 0 ? 'complete' : 'todo',
}))

function renderLayout(activeYear: number | null) {
  searchParamsInstance = activeYear != null ? new URLSearchParams({ year: String(activeYear) }) : new URLSearchParams()
  pushMock.mockReset()

  render(
    <WorkbookLayout
      sheets={sheetStatus}
      activeSlug="1-product-setup"
      planningYears={planningYears}
      activeYear={activeYear}
    >
      <div>content</div>
    </WorkbookLayout>,
  )
}

describe('WorkbookLayout year navigation', () => {
  beforeEach(() => {
    searchParamsInstance = new URLSearchParams({ year: '2025' })
    pushMock.mockReset()
  })

  afterEach(() => {
    pushMock.mockReset()
  })

  it('renders year controls and allows switching via buttons', () => {
    renderLayout(2025)

    const previousButtons = screen.getAllByRole('button', { name: 'Previous year' })
    previousButtons.forEach((button) => expect(button).toBeDisabled())

    const yearButtons = screen.getAllByRole('button', { name: /2026/ })
    fireEvent.click(yearButtons[0]!)
    expect(pushMock).toHaveBeenCalledWith('/sheet/1-product-setup?year=2026')

    pushMock.mockReset()

    const nextButtons = screen.getAllByRole('button', { name: 'Next year' })
    fireEvent.click(nextButtons[0]!)
    expect(pushMock).toHaveBeenCalledWith('/sheet/1-product-setup?year=2026')
  })

  it('supports Ctrl + arrow keyboard shortcuts', () => {
    renderLayout(2026)

    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true })
    expect(pushMock).toHaveBeenCalledWith('/sheet/1-product-setup?year=2025')

    pushMock.mockReset()

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    expect(pushMock).toHaveBeenCalledWith('/sheet/1-product-setup?year=2027')
  })
})
