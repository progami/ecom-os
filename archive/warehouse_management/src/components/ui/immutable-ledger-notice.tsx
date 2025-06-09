import { AlertCircle, Info } from 'lucide-react'

export function ImmutableLedgerNotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">
            Immutable Ledger System
          </h3>
          <p className="text-sm text-blue-800">
            The inventory ledger maintains a permanent audit trail. Transactions cannot be edited or deleted after creation.
          </p>
          <div className="mt-3 text-sm text-blue-700">
            <p className="font-medium mb-1">To correct errors:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use <span className="font-mono bg-blue-100 px-1 rounded">ADJUST_IN</span> to add missing inventory</li>
              <li>Use <span className="font-mono bg-blue-100 px-1 rounded">ADJUST_OUT</span> to remove excess inventory</li>
              <li>Include detailed notes explaining the correction</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ImmutableErrorAlertProps {
  action: 'update' | 'delete'
  onClose?: () => void
}

export function ImmutableErrorAlert({ action, onClose }: ImmutableErrorAlertProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900 mb-1">
            Cannot {action === 'update' ? 'Modify' : 'Delete'} Transaction
          </h3>
          <p className="text-sm text-red-800">
            Inventory transactions are immutable to maintain data integrity and audit compliance.
          </p>
          {action === 'update' && (
            <p className="text-sm text-red-700 mt-2">
              If you need to correct this transaction, please create an adjustment transaction instead.
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}