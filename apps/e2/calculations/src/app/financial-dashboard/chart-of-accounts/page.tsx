'use client'

import React, { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, DollarSign, Package, Receipt, Building, Users, FileText } from 'lucide-react'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'

// Icon mapping for account types
const typeIcons = {
  Asset: DollarSign,
  Liability: Receipt,
  Equity: Building,
  Revenue: DollarSign,
  Expense: Receipt
}

export default function ChartOfAccountsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  // Convert CHART_OF_ACCOUNTS object to array and filter
  const accounts = useMemo(() => {
    const accountsArray = Object.entries(CHART_OF_ACCOUNTS).map(([code, account]) => ({
      code,
      ...account
    }))

    if (!searchQuery) return accountsArray

    const query = searchQuery.toLowerCase()
    return accountsArray.filter(account => 
      account.code.toLowerCase().includes(query) ||
      account.name.toLowerCase().includes(query) ||
      account.type.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof accounts> = {}
    
    accounts.forEach(account => {
      if (!groups[account.type]) {
        groups[account.type] = []
      }
      groups[account.type].push(account)
    })

    // Sort by standard accounting order
    const orderedTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
    const orderedGroups: Record<string, typeof accounts> = {}
    
    orderedTypes.forEach(type => {
      if (groups[type]) {
        orderedGroups[type] = groups[type].sort((a, b) => a.code.localeCompare(b.code))
      }
    })

    return orderedGroups
  }, [accounts])

  // Calculate summary stats
  const summary = useMemo(() => {
    const allAccounts = Object.values(CHART_OF_ACCOUNTS)
    return {
      total: allAccounts.length,
      assets: allAccounts.filter(a => a.type === 'Asset').length,
      liabilities: allAccounts.filter(a => a.type === 'Liability').length,
      equity: allAccounts.filter(a => a.type === 'Equity').length,
      revenue: allAccounts.filter(a => a.type === 'Revenue').length,
      expenses: allAccounts.filter(a => a.type === 'Expense').length
    }
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Asset': return 'text-blue-600 bg-blue-50'
      case 'Liability': return 'text-orange-600 bg-orange-50'
      case 'Equity': return 'text-purple-600 bg-purple-50'
      case 'Revenue': return 'text-green-600 bg-green-50'
      case 'Expense': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Chart of Accounts</h1>
            <p className="text-muted-foreground">Complete listing of all financial accounts used in the system</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.assets}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Liabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.liabilities}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">Equity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.equity}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.revenue}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.expenses}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Accounts by Type */}
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, accounts]) => (
              <Card key={type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {React.createElement(typeIcons[type as keyof typeof typeIcons] || FileText, {
                        className: `h-5 w-5 ${getTypeColor(type).split(' ')[0]}`
                      })}
                      <CardTitle>{type} Accounts</CardTitle>
                    </div>
                    <Badge variant="secondary">{accounts.length} accounts</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-3 text-left text-sm font-medium">Code</th>
                          <th className="p-3 text-left text-sm font-medium">Account Name</th>
                          <th className="p-3 text-left text-sm font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account.code} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                {account.code}
                              </code>
                            </td>
                            <td className="p-3 text-sm font-medium">{account.name}</td>
                            <td className="p-3">
                              <Badge className={getTypeColor(account.type)} variant="secondary">
                                {account.type}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No results message */}
          {Object.keys(groupedAccounts).length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No accounts found matching "{searchQuery}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}