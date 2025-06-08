'use client'

import { Package, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryTabsProps {
  activeTab: 'balances' | 'transactions'
  onTabChange: (tab: 'balances' | 'transactions') => void
}

export function InventoryTabs({ activeTab, onTabChange }: InventoryTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => onTabChange('transactions')}
          className={cn(
            'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'transactions'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <FileText
            className={cn(
              'mr-2 h-5 w-5',
              activeTab === 'transactions' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
            )}
          />
          Inventory Ledger
          <span
            className={cn(
              'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium',
              activeTab === 'transactions'
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-900'
            )}
          >
            All Movements
          </span>
        </button>
        
        <button
          onClick={() => onTabChange('balances')}
          className={cn(
            'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'balances'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <Package
            className={cn(
              'mr-2 h-5 w-5',
              activeTab === 'balances' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
            )}
          />
          Current Balances
          <span
            className={cn(
              'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium',
              activeTab === 'balances'
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-900'
            )}
          >
            Stock Levels
          </span>
        </button>
      </nav>
    </div>
  )
}