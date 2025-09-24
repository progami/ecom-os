import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardSheet } from '@/components/sheets/dashboard'

describe('DashboardSheet', () => {
  it('shows summary metrics and pipeline rows', () => {
    render(
      <DashboardSheet
        data={{
          overview: {
            revenueYTD: 1000,
            netProfitYTD: 250,
            cashBalance: 500,
            netMargin: 25,
          },
          pipeline: [
            { status: 'PLANNED', quantity: 100 },
            { status: 'IN_TRANSIT', quantity: 50 },
          ],
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
              quarterly: [
                {
                  periodLabel: 'Q1 2025',
                  revenue: 3000,
                  cogs: 1800,
                  grossProfit: 1200,
                  amazonFees: 150,
                  ppcSpend: 75,
                  fixedCosts: 300,
                  totalOpex: 525,
                  netProfit: 675,
                },
              ],
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
              quarterly: [
                {
                  periodLabel: 'Q1 2025',
                  amazonPayout: 1200,
                  inventorySpend: 450,
                  fixedCosts: 300,
                  netCash: 450,
                  closingCash: 900,
                },
              ],
            },
          },
        }}
      />
    )

    expect(screen.getByText('Revenue YTD')).toBeInTheDocument()
    expect(screen.getAllByText('$1,000')[0]).toBeInTheDocument()
    expect(screen.getByText('Widget A')).toBeInTheDocument()
    expect(screen.getByText(/planned/i)).toBeInTheDocument()
  })
})
