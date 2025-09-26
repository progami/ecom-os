import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardSheet } from '@/components/sheets/dashboard'

describe('DashboardSheet', () => {
  it('renders the purchase order timeline and inventory without headline metric cards', () => {
    render(
      <DashboardSheet
        data={{
          orders: [
            {
              id: 'po-1',
              orderCode: 'PO-1',
              productName: 'Widget A',
              quantity: 120,
              status: 'PRODUCTION',
              availableDate: new Date('2025-02-10T00:00:00.000Z').toISOString(),
              segments: [
                {
                  key: 'production',
                  label: 'Production',
                  start: new Date('2025-01-01T00:00:00.000Z').toISOString(),
                  end: new Date('2025-01-14T00:00:00.000Z').toISOString(),
                },
                {
                  key: 'oceanTransit',
                  label: 'Ocean Transit',
                  start: new Date('2025-01-20T00:00:00.000Z').toISOString(),
                  end: new Date('2025-02-05T00:00:00.000Z').toISOString(),
                },
              ],
            },
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

    expect(screen.queryByText('Revenue YTD')).not.toBeInTheDocument()
    expect(screen.getAllByText('Widget A').length).toBeGreaterThan(0)
    expect(screen.getByText((content) => content.includes('PO-1'))).toBeInTheDocument()
    expect(screen.getAllByText('Production')[0]).toBeInTheDocument()
  })
})
