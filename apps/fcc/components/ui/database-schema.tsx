'use client'

import { useState } from 'react'
import { 
  Database, Table, Hash, Calendar, 
  ToggleLeft, Type, FileText, Key, ChevronDown, ChevronUp
} from 'lucide-react'

const SCHEMA_INFO = {
  // Primary Tables (Most Important)
  BankAccount: {
    description: 'Bank accounts synced from Xero',
    icon: '🏦',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: true },
      { name: 'currencyCode', type: 'String', isPrimary: false, isOptional: true },
      { name: 'balance', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'balanceLastUpdated', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  BankTransaction: {
    description: 'Bank transactions with categorization',
    icon: '💳',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroTransactionId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'bankAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: true },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'isReconciled', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'total', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  GLAccount: {
    description: 'Chart of Accounts from Xero',
    icon: '📊',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: true },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'systemAccount', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'class', type: 'String', isPrimary: false, isOptional: true },
      { name: 'balance', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  Invoice: {
    description: 'Sales and purchase invoices',
    icon: '📄',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroInvoiceId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'total', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'amountDue', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'amountPaid', type: 'Decimal', isPrimary: false, isOptional: false }
    ]
  },
  Contact: {
    description: 'Customers and suppliers from Xero',
    icon: '👥',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroContactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'emailAddress', type: 'String', isPrimary: false, isOptional: true },
      { name: 'contactNumber', type: 'String', isPrimary: false, isOptional: true },
      { name: 'isSupplier', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'isCustomer', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  User: {
    description: 'Application user accounts',
    icon: '👤',
    category: 'primary',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'email', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: true },
      { name: 'xeroUserId', type: 'String', isPrimary: false, isOptional: true },
      { name: 'tenantName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'hasCompletedSetup', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'lastLoginAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  
  // Financial Tables
  CashFlowForecast: {
    description: 'Daily cash flow projections',
    icon: '📈',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'openingBalance', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'totalInflows', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'totalOutflows', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'closingBalance', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'confidenceLevel', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  CashFlowBudget: {
    description: 'Monthly budget planning',
    icon: '💰',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'accountCode', type: 'String', isPrimary: false, isOptional: false },
      { name: 'accountName', type: 'String', isPrimary: false, isOptional: false },
      { name: 'category', type: 'String', isPrimary: false, isOptional: false },
      { name: 'monthYear', type: 'String', isPrimary: false, isOptional: false },
      { name: 'budgetedAmount', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'actualAmount', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'variance', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncedInvoice: {
    description: 'Synced invoice data for cash flow',
    icon: '📋',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amountDue', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'total', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false }
    ]
  },
  RepeatingTransaction: {
    description: 'Recurring invoices and bills',
    icon: '🔁',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'scheduleUnit', type: 'String', isPrimary: false, isOptional: false },
      { name: 'scheduleInterval', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'nextScheduledDate', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'amount', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false }
    ]
  },
  PaymentPattern: {
    description: 'Customer and supplier payment behavior',
    icon: '📊',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'averageDaysToPay', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'onTimeRate', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'sampleSize', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'lastCalculated', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  TaxObligation: {
    description: 'Tax payment tracking',
    icon: '🏛️',
    category: 'financial',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'reference', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  
  // Supporting Tables
  StandardOperatingProcedure: {
    description: 'SOP templates for transactions',
    icon: '📝',
    category: 'supporting',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'year', type: 'String', isPrimary: false, isOptional: false },
      { name: 'chartOfAccount', type: 'String', isPrimary: false, isOptional: false },
      { name: 'pointOfInvoice', type: 'String', isPrimary: false, isOptional: true },
      { name: 'serviceType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'referenceTemplate', type: 'String', isPrimary: false, isOptional: false },
      { name: 'descriptionTemplate', type: 'String', isPrimary: false, isOptional: false },
      { name: 'isActive', type: 'Boolean', isPrimary: false, isOptional: false }
    ]
  },
  LineItem: {
    description: 'Transaction line item details',
    icon: '📑',
    category: 'supporting',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'transactionId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'quantity', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'unitAmount', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'accountCode', type: 'String', isPrimary: false, isOptional: false },
      { name: 'taxType', type: 'String', isPrimary: false, isOptional: true },
      { name: 'lineAmount', type: 'Decimal', isPrimary: false, isOptional: false }
    ]
  },
  CurrencyRate: {
    description: 'Exchange rate tracking',
    icon: '💱',
    category: 'supporting',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'fromCurrency', type: 'String', isPrimary: false, isOptional: false },
      { name: 'toCurrency', type: 'String', isPrimary: false, isOptional: false },
      { name: 'rate', type: 'Decimal', isPrimary: false, isOptional: false },
      { name: 'source', type: 'String', isPrimary: false, isOptional: false },
      { name: 'effectiveDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  Report: {
    description: 'Generated report files',
    icon: '📊',
    category: 'supporting',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'userId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'format', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'filePath', type: 'String', isPrimary: false, isOptional: false },
      { name: 'generatedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'expiresAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  
  // System Tables
  SyncLog: {
    description: 'Data synchronization history',
    icon: '🔄',
    category: 'system',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'recordsCreated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'recordsUpdated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
    ]
  },
  CashFlowSyncLog: {
    description: 'Cash flow sync operations',
    icon: '💹',
    category: 'system',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'entityType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'itemsSynced', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false }
    ]
  },
  AuditLog: {
    description: 'User activity tracking',
    icon: '📋',
    category: 'system',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'userId', type: 'String', isPrimary: false, isOptional: true },
      { name: 'userEmail', type: 'String', isPrimary: false, isOptional: true },
      { name: 'action', type: 'String', isPrimary: false, isOptional: false },
      { name: 'resource', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'timestamp', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  ErrorLog: {
    description: 'System error tracking',
    icon: '⚠️',
    category: 'system',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'fingerprint', type: 'String', isPrimary: false, isOptional: false },
      { name: 'errorName', type: 'String', isPrimary: false, isOptional: false },
      { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: false },
      { name: 'severity', type: 'String', isPrimary: false, isOptional: false },
      { name: 'context', type: 'String', isPrimary: false, isOptional: false },
      { name: 'occurredAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncCheckpoint: {
    description: 'Sync progress tracking',
    icon: '📍',
    category: 'system',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncLogId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'checkpointKey', type: 'String', isPrimary: false, isOptional: false },
      { name: 'data', type: 'String', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  }
}

interface DatabaseSchemaProps {
  onTableClick?: (tableName: string) => void
}

export function DatabaseSchema({ onTableClick }: DatabaseSchemaProps) {
  const [isExpanded, setIsExpanded] = useState(onTableClick ? true : false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'String': return <Type className="h-4 w-4 text-blue-400" />
      case 'Int':
      case 'Float': return <Hash className="h-4 w-4 text-green-400" />
      case 'Decimal': return <Hash className="h-4 w-4 text-green-400" />
      case 'Boolean': return <ToggleLeft className="h-4 w-4 text-purple-400" />
      case 'DateTime': return <Calendar className="h-4 w-4 text-amber-400" />
      default: return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  // Group tables by category
  const tablesByCategory = Object.entries(SCHEMA_INFO).reduce((acc, [name, info]) => {
    const category = info.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push({ name, ...info })
    return acc
  }, {} as Record<string, Array<typeof SCHEMA_INFO[keyof typeof SCHEMA_INFO] & { name: string }>>)

  const categoryTitles = {
    primary: 'Primary Tables',
    financial: 'Financial Tables',
    supporting: 'Supporting Tables',
    system: 'System Tables'
  }

  const categoryOrder = ['primary', 'financial', 'supporting', 'system']

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-white">Database Schema</h3>
          <span className="text-sm text-gray-400">({Object.keys(SCHEMA_INFO).length} tables)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tables List */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {categoryOrder.map(category => (
                tablesByCategory[category] && (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">
                      {categoryTitles[category as keyof typeof categoryTitles]}
                    </h4>
                    <div className="space-y-2 mb-4">
                      {tablesByCategory[category].map((table) => (
                        <div
                          key={table.name}
                          onClick={() => {
                            setSelectedTable(table.name)
                            if (onTableClick) {
                              onTableClick(table.name)
                            }
                          }}
                          className={`p-3 bg-slate-900/50 rounded-lg cursor-pointer transition-all ${
                            selectedTable === table.name
                              ? 'ring-2 ring-teal-500 bg-slate-900/80'
                              : 'hover:bg-slate-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{table.icon}</span>
                            <div className="flex-1">
                              <h5 className="font-medium text-white text-sm">{table.name}</h5>
                              <p className="text-xs text-gray-400">{table.description}</p>
                            </div>
                            {onTableClick && (
                              <Table className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Table Details */}
            <div>
              {selectedTable && SCHEMA_INFO[selectedTable as keyof typeof SCHEMA_INFO] ? (
                <>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    {selectedTable} Columns
                  </h4>
                  <div className="space-y-1 max-h-[550px] overflow-y-auto pr-2">
                    {SCHEMA_INFO[selectedTable as keyof typeof SCHEMA_INFO].columns.map((col) => (
                      <div 
                        key={col.name} 
                        className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {col.isPrimary && <Key className="h-3 w-3 text-amber-400" />}
                          <span className="font-mono text-white">{col.name}</span>
                          {col.isOptional && <span className="text-xs text-gray-500">?</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {getTypeIcon(col.type)}
                          <span className="text-gray-400 text-xs">{col.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Select a table to view its schema
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}