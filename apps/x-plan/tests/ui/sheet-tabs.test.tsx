import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetTabs } from '@/components/sheet-tabs'
import { SHEETS } from '@/lib/sheets'

vi.mock('next/navigation', () => ({
  usePathname: () => '/sheet/1-product-setup',
}))

describe('SheetTabs', () => {
  it('marks the active sheet and renders correct hrefs', () => {
    render(<SheetTabs sheets={SHEETS} activeSlug="1-product-setup" />)
    const active = screen.getByRole('link', { name: '1. Product Setup' })
    expect(active).toHaveAttribute('href', '/sheet/1-product-setup')
    expect(active.className).toContain('shadow-sm')

    const inactive = screen.getByRole('link', { name: '2. Ops Planning' })
    expect(inactive).toHaveAttribute('href', '/sheet/2-ops-planning')
  })

  it('applies custom href builder when provided', () => {
    const getHref = (sheet: typeof SHEETS[number]) => `/sheet/${sheet.slug}?year=2026`
    render(<SheetTabs sheets={SHEETS} activeSlug="1-product-setup" getHref={getHref} />)
    const inactive = screen.getByRole('link', { name: '2. Ops Planning' })
    expect(inactive).toHaveAttribute('href', '/sheet/2-ops-planning?year=2026')
  })

})
