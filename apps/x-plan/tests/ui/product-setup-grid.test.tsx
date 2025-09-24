import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'

describe('ProductSetupGrid', () => {
  it('renders rows in the Handsontable wrapper', () => {
    render(
      <ProductSetupGrid
        products={[
          {
            id: 'prod-1',
            name: 'Widget A',
            sellingPrice: '10',
            manufacturingCost: '4',
            freightCost: '1',
            tariffRate: '0.05',
            tacosPercent: '0.15',
            fbaFee: '2',
            amazonReferralRate: '0.15',
            storagePerMonth: '0.10',
            landedCost: '6.00',
            grossContribution: '2.50',
            grossMarginPercent: '0.2500',
          },
          {
            id: 'prod-2',
            name: 'Widget B',
            sellingPrice: '20',
            manufacturingCost: '8',
            freightCost: '2',
            tariffRate: '0.05',
            tacosPercent: '0.15',
            fbaFee: '3',
            amazonReferralRate: '0.15',
            storagePerMonth: '0.20',
            landedCost: '13.20',
            grossContribution: '3.80',
            grossMarginPercent: '0.1900',
          },
        ]}
      />
    )

    const table = screen.getByTestId('hot-table')
    expect(table).toHaveAttribute('data-rows', '2')
  })
})
