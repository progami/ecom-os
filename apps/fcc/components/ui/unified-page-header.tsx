'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Cloud, LogOut, RefreshCw, AlertTriangle, Circle
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from './breadcrumbs'
import { responsiveText } from '@/lib/responsive-utils'
import { XeroConnectionStatus } from '@/components/xero/xero-connection-status'

interface UnifiedPageHeaderProps {
  // Basic props (from page-header)
  title: string
  description?: string | ReactNode
  actions?: ReactNode
  
  // Back navigation (from module-header)
  showBackButton?: boolean
  backTo?: string
  backLabel?: string
  
  // Auth and baseline features
  showAuthStatus?: boolean
  showTimeRangeSelector?: boolean
  timeRange?: string
  onTimeRangeChange?: (value: string) => void
  
  // Breadcrumbs
  showBreadcrumbs?: boolean
  breadcrumbItems?: Array<{ label: string; href?: string }>
  
  // Additional customization
  className?: string
}

export function UnifiedPageHeader({ 
  title, 
  description, 
  actions,
  showBackButton = false,
  backTo = '/finance', 
  backLabel = 'Back to Finance',
  showAuthStatus = false,
  showTimeRangeSelector = false,
  timeRange = '30d',
  onTimeRangeChange,
  showBreadcrumbs = true,
  breadcrumbItems,
  className
}: UnifiedPageHeaderProps) {
  const router = useRouter()
  const { 
    hasActiveToken, 
    organization, 
    disconnectFromXero,
    signOut,
    checkAuthStatus
  } = useAuth()

  

  return (
    <div className={cn("mb-8", className)}>
      {showBreadcrumbs && <Breadcrumbs items={breadcrumbItems} />}
      
      {showBackButton && (
        <button
          onClick={() => router.push(backTo)}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          {backLabel}
        </button>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className={cn(responsiveText.heading[1], "font-bold text-white mb-2")}>
            {title}
          </h1>
          <div className="flex items-center gap-4 text-gray-300">
            {description && (
              typeof description === 'string' ? (
                <p className={cn(responsiveText.body.base, "text-gray-300")}>{description}</p>
              ) : (
                description
              )
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Page-specific actions on the left */}
          {actions}
          
          {/* Always show XeroConnectionStatus when connected */}
          {hasActiveToken && !showAuthStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-700/50 rounded-lg ml-auto">
              <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
              <span className="text-sm text-emerald-400">
                {organization?.tenantName || 'Connected'}
              </span>
            </div>
          )}
          
          {/* Baseline group on the right */}
          {showAuthStatus && (
            <>
              {hasActiveToken ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:ml-auto">
                  
                  {/* Time Range Selector */}
                  {showTimeRangeSelector && onTimeRangeChange && (
                    <select
                      value={timeRange}
                      onChange={(e) => onTimeRangeChange(e.target.value)}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="365d">Last 365 days</option>
                    </select>
                  )}
                  
                  {/* Organization Name - always visible */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
                    <Cloud className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      {organization?.tenantName || 'Connected'}
                    </span>
                  </div>
                  
                  {/* Disconnect from Xero Button */}
                  <button
                    onClick={disconnectFromXero}
                    className="p-2 sm:p-1.5 bg-red-900/20 hover:bg-red-900/30 border border-red-700/50 rounded-lg transition-colors"
                    title="Disconnect from Xero"
                  >
                    <Cloud className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 ml-auto">
                  <XeroConnectionStatus />
                  <button
                    onClick={() => {
                      const currentPath = window.location.pathname
                      window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(currentPath)}`
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                  >
                    <Cloud className="h-4 w-4" />
                    Connect to Xero
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}