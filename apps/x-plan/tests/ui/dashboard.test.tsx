import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardSheet } from '@/components/sheets/dashboard'

describe('DashboardSheet', () => {
  it('shows the inventory summary and trend graph without the old PO timeline', () => {
    render(
      <DashboardSheet
        data={{
          inventory: [
            { productName: 'Widget A', stockEnd: 40, stockWeeks: 3 },
            { productName: 'Widget B', stockEnd: 25, stockWeeks: 2 },
          ],
          rollups: {
            profitAndLoss: {
              monthly: [
                {
                  periodLabel: 'Jan 2025',
                  revenue: 1000,
                  cogs: 600,
                  grossProfit: 400,
                  amazonFees: 50,
                  ppcSpend: 25,
                  fixedCosts: 100,
                  totalOpex: 175,
                  netProfit: 225,
                },
              ],
              quarterly: [],
            },
            cashFlow: {
              monthly: [
                {
                  periodLabel: 'Jan 2025',
                  amazonPayout: 400,
                  inventorySpend: 150,
                  fixedCosts: 100,
                  netCash: 150,
                  closingCash: 650,
                },
              ],
              quarterly: [],
            },
          },
        }}
      />
    )

    expect(screen.getByText('Stock position')).toBeInTheDocument()
    expect(screen.getByText('Inventory snapshot')).toBeInTheDocument()
    expect(screen.getByText('Performance graphs')).toBeInTheDocument()
    expect(screen.queryByText('PO timeline')).not.toBeInTheDocument()
    expect(screen.queryByText('Revenue YTD')).not.toBeInTheDocument()
  })
})
