import { Shield } from 'lucide-react'

export function ImmutableLedgerNotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-900">
            Immutable Ledger System
          </h3>
          <p className="text-sm text-blue-800 mt-1">
            This inventory ledger maintains a complete audit trail of all warehouse movements. 
            Records cannot be edited or deleted once created, ensuring data integrity and compliance.
          </p>
        </div>
      </div>
    </div>
  )
}