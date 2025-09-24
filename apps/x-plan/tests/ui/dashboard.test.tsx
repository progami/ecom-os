import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardSheet } from '@/components/sheets/dashboard'

describe('DashboardSheet', () => {
  it('shows summary metrics and pipeline rows', () => {
    render(
      <DashboardSheet
        data={{
          revenueYTD: '1000.00',
          netProfitYTD: '250.00',
          cashBalance: '500.00',
          netMargin: '25.00',
          pipeline: [
            { status: 'PLANNED', quantity: 100 },
            { status: 'IN_TRANSIT', quantity: 50 },
          ],
          inventory: [
            { productName: 'Widget A', stockEnd: 40, stockWeeks: '3' },
            { productName: 'Widget B', stockEnd: 25, stockWeeks: '2' },
          ],
        }}
      />
    )

    expect(screen.getByText('Revenue YTD')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('Widget A')).toBeInTheDocument()
    expect(screen.getByText(/planned/i)).toBeInTheDocument()
  })
})
