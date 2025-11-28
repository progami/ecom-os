import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetTabs } from '@/components/sheet-tabs'
import { SHEETS } from '@/lib/sheets'

vi.mock('next/navigation', () => ({
  usePathname: () => '/1-product-setup',
}))

describe('SheetTabs', () => {
  it('marks the active sheet and renders default hrefs', () => {
    render(<SheetTabs sheets={SHEETS} activeSlug="1-product-setup" />)
    const active = screen.getByRole('link', { name: '1. Product Setup' })
    expect(active).toHaveAttribute('href', '/1-product-setup')
    expect(active.className).toContain('shadow-md')

    const inactive = screen.getByRole('link', { name: '2. Ops Planning' })
    expect(inactive).toHaveAttribute('href', '/2-ops-planning')
  })

  it('respects precomputed href overrides', () => {
    const customSheets = SHEETS.map((sheet) => ({ ...sheet, href: `/custom/${sheet.slug}` }))
    render(<SheetTabs sheets={customSheets} activeSlug="1-product-setup" />)
    const inactive = screen.getByRole('link', { name: '2. Ops Planning' })
    expect(inactive).toHaveAttribute('href', '/custom/2-ops-planning')
  })

})
