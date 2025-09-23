import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkbookControls } from '@/components/workbook-controls'

const originalFetch = global.fetch

afterEach(() => {
  vi.restoreAllMocks()
  global.fetch = originalFetch
})

describe('WorkbookControls', () => {
  it('opens the file picker when clicking upload', () => {
    render(<WorkbookControls />)
    const input = screen.getByTestId('workbook-file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')

    fireEvent.click(screen.getByText(/Upload Workbook/i))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('sends the workbook to the import endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<WorkbookControls />)
    const input = screen.getByTestId('workbook-file-input') as HTMLInputElement
    const file = new File(['content'], 'cross-plan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/cross-plan/workbook/import', expect.any(Object))
    })
  })

  it('triggers export flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    global.fetch = fetchMock as unknown as typeof global.fetch
    const anchorSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(<WorkbookControls />)
    fireEvent.click(screen.getByText(/Export to Excel/i))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/cross-plan/workbook/export')
    })

    anchorSpy.mockRestore()
  })
})
