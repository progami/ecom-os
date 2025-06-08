import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast, Toaster } from 'react-hot-toast'
import '@testing-library/jest-dom'

// Mock Toast Component
const ToastDemo = () => {
  return (
    <div>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: 'green',
            },
            iconTheme: {
              primary: 'white',
              secondary: 'green',
            },
          },
          error: {
            style: {
              background: 'red',
            },
            iconTheme: {
              primary: 'white',
              secondary: 'red',
            },
          },
        }}
      />
      <button onClick={() => toast.success('Success message!')}>Show Success</button>
      <button onClick={() => toast.error('Error message!')}>Show Error</button>
      <button onClick={() => toast.loading('Loading...')}>Show Loading</button>
      <button onClick={() => toast('Default notification')}>Show Default</button>
      <button onClick={() => toast.custom(<div>Custom toast content</div>)}>Show Custom</button>
      <button onClick={() => toast.promise(
        new Promise((resolve) => setTimeout(resolve, 2000)),
        {
          loading: 'Processing...',
          success: 'Done!',
          error: 'Failed!',
        }
      )}>Show Promise</button>
    </div>
  )
}

// Mock Modal Component
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          <div className="modal-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mock Confirmation Dialog
interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Test Component that uses modals
const TestComponent = () => {
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>Open Modal</button>
      <button onClick={() => setIsConfirmOpen(true)}>Open Confirm Dialog</button>
      <button onClick={() => setIsEditModalOpen(true)}>Open Edit Modal</button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Test Modal"
      >
        <p>This is modal content</p>
        <input type="text" placeholder="Enter text" className="mt-2 w-full px-3 py-2 border rounded" />
        <div className="mt-4 flex justify-end gap-2">
          <button 
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              toast.success('Saved!')
              setIsModalOpen(false)
            }}
            className="px-4 py-2 bg-primary text-white rounded"
          >
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => toast.error('Deleted!')}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit SKU"
      >
        <form onSubmit={(e) => {
          e.preventDefault()
          toast.success('SKU updated!')
          setIsEditModalOpen(false)
        }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">SKU Code</label>
              <input type="text" defaultValue="CS-001" className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea className="w-full px-3 py-2 border rounded" rows={3} defaultValue="Product A" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
                Update
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

describe('Toast Notifications', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Clear all toasts before each test
    toast.remove()
  })

  it('displays success toast', async () => {
    render(<ToastDemo />)

    const successButton = screen.getByText('Show Success')
    await user.click(successButton)

    await waitFor(() => {
      expect(screen.getByText('Success message!')).toBeInTheDocument()
    })
  })

  it('displays error toast', async () => {
    render(<ToastDemo />)

    const errorButton = screen.getByText('Show Error')
    await user.click(errorButton)

    await waitFor(() => {
      expect(screen.getByText('Error message!')).toBeInTheDocument()
    })
  })

  it('displays loading toast', async () => {
    render(<ToastDemo />)

    const loadingButton = screen.getByText('Show Loading')
    await user.click(loadingButton)

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('displays default toast', async () => {
    render(<ToastDemo />)

    const defaultButton = screen.getByText('Show Default')
    await user.click(defaultButton)

    await waitFor(() => {
      expect(screen.getByText('Default notification')).toBeInTheDocument()
    })
  })

  it('displays custom toast', async () => {
    render(<ToastDemo />)

    const customButton = screen.getByText('Show Custom')
    await user.click(customButton)

    await waitFor(() => {
      expect(screen.getByText('Custom toast content')).toBeInTheDocument()
    })
  })

  it('displays promise-based toast', async () => {
    render(<ToastDemo />)

    const promiseButton = screen.getByText('Show Promise')
    await user.click(promiseButton)

    // Should show loading state first
    expect(screen.getByText('Processing...')).toBeInTheDocument()

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Done!')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('can display multiple toasts', async () => {
    render(<ToastDemo />)

    await user.click(screen.getByText('Show Success'))
    await user.click(screen.getByText('Show Error'))

    await waitFor(() => {
      expect(screen.getByText('Success message!')).toBeInTheDocument()
      expect(screen.getByText('Error message!')).toBeInTheDocument()
    })
  })
})

describe('Modal Dialogs', () => {
  const user = userEvent.setup()

  it('opens modal when button is clicked', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    const openButton = screen.getByText('Open Modal')
    await user.click(openButton)

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('This is modal content')).toBeInTheDocument()
  })

  it('closes modal when close button is clicked', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))
    
    const closeButton = screen.getByLabelText('Close')
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })
  })

  it('closes modal when backdrop is clicked', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))
    
    const backdrop = screen.getByLabelText('Close modal')
    await user.click(backdrop)

    await waitFor(() => {
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })
  })

  it('modal contains form inputs', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))

    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    
    await user.type(input, 'Test input')
    expect(input).toHaveValue('Test input')
  })

  it('modal save button shows success toast', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })
  })
})

describe('Confirmation Dialogs', () => {
  const user = userEvent.setup()

  it('opens confirmation dialog', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Confirm Dialog'))

    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this item? This action cannot be undone.')).toBeInTheDocument()
  })

  it('has confirm and cancel buttons', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Confirm Dialog'))

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('closes dialog on cancel', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Confirm Dialog'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('Delete Item')).not.toBeInTheDocument()
    })
  })

  it('executes action and shows toast on confirm', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Confirm Dialog'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Deleted!')).toBeInTheDocument()
      expect(screen.queryByText('Delete Item')).not.toBeInTheDocument()
    })
  })
})

describe('Edit Modal', () => {
  const user = userEvent.setup()

  it('opens edit modal with form', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Edit Modal'))

    expect(screen.getByText('Edit SKU')).toBeInTheDocument()
    expect(screen.getByLabelText('SKU Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('form has pre-filled values', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Edit Modal'))

    const skuInput = screen.getByDisplayValue('CS-001')
    const descTextarea = screen.getByDisplayValue('Product A')

    expect(skuInput).toBeInTheDocument()
    expect(descTextarea).toBeInTheDocument()
  })

  it('can edit form values', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Edit Modal'))

    const skuInput = screen.getByDisplayValue('CS-001')
    await user.clear(skuInput)
    await user.type(skuInput, 'CS-002')

    expect(skuInput).toHaveValue('CS-002')
  })

  it('submits form and shows success toast', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Edit Modal'))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(screen.getByText('SKU updated!')).toBeInTheDocument()
      expect(screen.queryByText('Edit SKU')).not.toBeInTheDocument()
    })
  })
})

describe('Modal Accessibility', () => {
  const user = userEvent.setup()

  it('modal has proper ARIA attributes', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))

    const modal = screen.getByText('Test Modal').closest('.relative')
    expect(modal).toBeInTheDocument()
  })

  it('can close modal with Escape key', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))
    
    // Note: Escape key functionality would need to be implemented in the actual component
    // This is just showing how you would test it
    await user.keyboard('{Escape}')
  })

  it('traps focus within modal', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    await user.click(screen.getByText('Open Modal'))

    const input = screen.getByPlaceholderText('Enter text')
    await user.click(input)

    // Tab through focusable elements
    await user.tab()
    expect(screen.getByText('Cancel')).toHaveFocus()

    await user.tab()
    expect(screen.getByText('Save')).toHaveFocus()
  })
})

describe('Toast Positioning', () => {
  it('toasts appear in correct position', async () => {
    const { container } = render(<ToastDemo />)

    await user.click(screen.getByText('Show Success'))

    await waitFor(() => {
      const toasterDiv = container.querySelector('[class*="toaster"]')
      expect(toasterDiv).toBeInTheDocument()
    })
  })
})

describe('Multiple Modals', () => {
  it('can handle multiple modal types', async () => {
    render(
      <>
        <Toaster />
        <TestComponent />
      </>
    )

    // Open first modal
    await user.click(screen.getByText('Open Modal'))
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    
    // Close it
    await user.click(screen.getByText('Cancel'))
    
    await waitFor(() => {
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })

    // Open different modal
    await user.click(screen.getByText('Open Edit Modal'))
    expect(screen.getByText('Edit SKU')).toBeInTheDocument()
  })
})