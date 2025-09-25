import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkbookControls } from '@/components/workbook-controls'

describe('WorkbookControls', () => {
  it('communicates that the workbook IO is paused', () => {
    render(<WorkbookControls />)
    expect(
      screen.getByText(
        /import\/export is paused while we finish the new template/i
      )
    ).toBeInTheDocument()
  })
})
