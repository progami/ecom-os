import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkbookLayout } from '@/components/workbook-layout'
import type { YearSegment } from '@/lib/calculations/calendar'
import { SHEETS } from '@/lib/sheets'
import type { WorkbookSheetStatus } from '@/lib/workbook'

const pushMock = vi.fn()
let searchParamsInstance: URLSearchParams
let mockedPathname = '/1-product-setup'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => mockedPathname,
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

function renderLayout(activeYear: number | null, activeSlug: WorkbookSheetStatus['slug'] = '3-sales-planning') {
  searchParamsInstance = activeYear != null ? new URLSearchParams({ year: String(activeYear) }) : new URLSearchParams()
  pushMock.mockReset()
  mockedPathname = `/${activeSlug}`

  render(
    <WorkbookLayout
      sheets={sheetStatus}
      activeSlug={activeSlug}
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

  it('renders year controls on year-aware sheets and allows switching via buttons', () => {
    renderLayout(2025)

    const previousButtons = screen.getAllByRole('button', { name: 'Previous year' })
    previousButtons.forEach((button) => expect(button).toBeDisabled())

    const yearSelects = screen.getAllByRole('combobox', { name: 'Select year' })
    fireEvent.change(yearSelects[0]!, { target: { value: '2026' } })
    expect(pushMock).toHaveBeenCalledWith('/3-sales-planning?year=2026')

    pushMock.mockReset()

    const nextButtons = screen.getAllByRole('button', { name: 'Next year' })
    fireEvent.click(nextButtons[0]!)
    expect(pushMock).toHaveBeenCalledWith('/3-sales-planning?year=2026')
  })

  it('hides year controls on time-agnostic sheets', () => {
    renderLayout(2026, '1-product-setup')

    expect(screen.queryByRole('button', { name: 'Previous year' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next year' })).not.toBeInTheDocument()
  })
})
