'use client'

import type { StorageEntry } from '@/hooks/useStorageLedger'

interface StorageLedgerTableProps {
  entries: StorageEntry[]
  searchQuery: string
  showCosts?: boolean
}

export function StorageLedgerTable({ 
  entries, 
  searchQuery,
  showCosts = true 
}: StorageLedgerTableProps) {
  
  const filteredEntries = entries.filter(entry =>
    entry.skuCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.skuDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.batchLot.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.warehouseName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Week Ending
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batch
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cartons
              </th>
              {showCosts && (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate/Carton
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(entry.weekEndingDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{entry.warehouseName}</div>
                    <div className="text-gray-500 text-xs">{entry.warehouseCode}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{entry.skuCode}</div>
                    <div className="text-gray-500 text-xs truncate max-w-xs" title={entry.skuDescription}>
                      {entry.skuDescription}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {entry.batchLot}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {entry.closingBalance.toLocaleString()}
                </td>
                {showCosts && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {entry.storageRatePerCarton 
                        ? `$${Number(entry.storageRatePerCarton).toFixed(4)}`
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {entry.totalStorageCost 
                        ? `$${Number(entry.totalStorageCost).toFixed(2)}`
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.isCostCalculated
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {entry.isCostCalculated ? 'Calculated' : 'Pending'}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredEntries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-lg">No storage entries found</div>
          <div className="text-sm mt-1">
            {searchQuery 
              ? `No entries match "${searchQuery}"`
              : "No entries available for the selected criteria"
            }
          </div>
        </div>
      )}
    </div>
  )
}