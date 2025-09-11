'use client'

import { useRouter } from 'next/navigation'
import { 
  FileText, TrendingUp, BarChart3, BookOpen, 
  FileBarChart, DollarSign, Upload, Cloud
} from 'lucide-react'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { formatCurrency } from '@/lib/design-tokens'

export default function ReportsPage() {
  const router = useRouter()

  const reports = [
    {
      id: 'profit-loss',
      title: 'Profit & Loss',
      description: 'Revenue, expenses, and profitability analysis',
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-500',
      href: '/reports/profit-loss'
    },
    {
      id: 'balance-sheet',
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and equity position',
      icon: BarChart3,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-500',
      href: '/reports/balance-sheet'
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow',
      description: 'Cash movements and liquidity analysis',
      icon: DollarSign,
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-500',
      href: '/reports/cash-flow'
    },
    {
      id: 'trial-balance',
      title: 'Trial Balance',
      description: 'Account balances and reconciliation',
      icon: BookOpen,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-500',
      href: '/reports/trial-balance'
    },
    {
      id: 'general-ledger',
      title: 'General Ledger',
      description: 'Detailed transaction history by account',
      icon: FileBarChart,
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-500',
      href: '/reports/general-ledger'
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <UnifiedPageHeader 
          title="Financial Reports"
          description="Access and analyze your financial reports"
          showAuthStatus={true}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/reports/import')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Upload className="h-4 w-4" />
                Import Data
              </button>
            </div>
          }
        />

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => router.push(report.href)}
              className={`group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border ${report.borderColor} rounded-2xl p-6 ${report.hoverBorder} transition-all duration-300 text-left hover:shadow-xl hover:shadow-${report.iconColor}/10`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-${report.iconBg} to-transparent opacity-0 group-hover:opacity-10 transition-opacity" />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 ${report.iconBg} rounded-xl`}>
                    <report.icon className={`h-8 w-8 ${report.iconColor}`} />
                  </div>
                  <FileText className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">
                  {report.title}
                </h3>
                
                <p className="text-sm text-gray-400 line-clamp-2">
                  {report.description}
                </p>
              </div>
            </button>
          ))}

          {/* Import Data Card */}
          <button
            onClick={() => router.push('/reports/import')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-500 transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Upload className="h-8 w-8 text-purple-400" />
                </div>
                <span className="px-2 py-1 bg-purple-500/20 rounded text-xs text-purple-400 font-medium">
                  IMPORT
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2">
                Import Reports
              </h3>
              
              <p className="text-sm text-gray-400 line-clamp-2">
                Upload financial data from CSV or Excel files
              </p>
            </div>
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Cloud className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Data Sources
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Reports can be generated from multiple sources:
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span><strong className="text-gray-300">API Sync:</strong> Real-time data from Xero when connected</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span><strong className="text-gray-300">File Import:</strong> Upload CSV or Excel files for offline analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span><strong className="text-gray-300">Cached Data:</strong> Previously imported or synced data stored locally</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}