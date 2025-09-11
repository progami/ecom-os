'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Circle, LogOut, ChevronDown, Loader2, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface TokenInfo {
  expiresAt?: Date
  remainingTime?: string
}

export function XeroConnectionStatus() {
  const { 
    hasActiveToken, 
    organization, 
    isLoading,
    isAuthenticated,
    connectToXero,
    disconnectFromXero,
    checkAuthStatus 
  } = useAuth()
  
  // Log auth state for debugging
  useEffect(() => {
    console.log('[XeroConnectionStatus] Auth state:', {
      hasActiveToken,
      organization: organization?.tenantName,
      isLoading,
      isAuthenticated,
      timestamp: new Date().toISOString()
    })
  }, [hasActiveToken, organization, isLoading, isAuthenticated])

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({})
  const [isHovering, setIsHovering] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Track mount state
  useEffect(() => {
    console.log('[XeroConnectionStatus] Component mounted')
    return () => {
      console.log('[XeroConnectionStatus] Component unmounted')
    }
  }, [])

  // Fetch token expiry information
  const fetchTokenInfo = useCallback(async () => {
    if (!hasActiveToken) {
      console.log('[XeroConnectionStatus] No active token, skipping token info fetch')
      return
    }

    try {
      console.log('[XeroConnectionStatus] Fetching token info from API')
      const response = await fetch('/api/v1/xero/token-info', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[XeroConnectionStatus] Token info received', { 
          hasToken: data.hasToken, 
          expiresAt: data.expiresAt 
        })
        
        if (data.expiresAt) {
          const expiryDate = new Date(data.expiresAt)
          setTokenInfo({
            expiresAt: expiryDate,
            remainingTime: formatDistanceToNow(expiryDate, { addSuffix: true })
          })
          console.info('[XeroConnectionStatus] Token expiry info updated', {
            expiresAt: expiryDate.toISOString(),
            remainingTime: formatDistanceToNow(expiryDate, { addSuffix: true })
          })
        }
      } else {
        console.warn('[XeroConnectionStatus] Failed to fetch token info', { status: response.status })
      }
    } catch (error) {
      console.error('[XeroConnectionStatus] Error fetching token info', error)
    }
  }, [hasActiveToken])

  // Update token info on mount and when connection status changes
  useEffect(() => {
    fetchTokenInfo()
  }, [fetchTokenInfo])

  // Update remaining time every minute
  useEffect(() => {
    if (!tokenInfo.expiresAt) return

    const interval = setInterval(() => {
      setTokenInfo(prev => ({
        ...prev,
        remainingTime: prev.expiresAt 
          ? formatDistanceToNow(prev.expiresAt, { addSuffix: true })
          : undefined
      }))
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [tokenInfo.expiresAt])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDisconnect = async () => {
    console.info('[XeroConnectionStatus] Disconnecting from Xero', { organization: organization?.tenantName })
    setIsDisconnecting(true)
    try {
      await disconnectFromXero()
      setIsDropdownOpen(false)
      console.info('[XeroConnectionStatus] Successfully disconnected from Xero')
    } catch (error) {
      console.error('[XeroConnectionStatus] Failed to disconnect from Xero', error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleConnect = () => {
    // Check if user is authenticated first
    if (!isAuthenticated) {
      console.info('[XeroConnectionStatus] User not authenticated, redirecting to login')
      // Redirect to login page
      window.location.href = '/login'
      return
    }
    
    const currentPath = window.location.pathname
    console.info('[XeroConnectionStatus] Initiating Xero connection', { returnUrl: currentPath })
    window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(currentPath)}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {hasActiveToken ? (
        <>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all",
              "hover:bg-slate-800/50",
              isDropdownOpen && "bg-slate-800/50"
            )}
          >
            <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
            <span className="text-sm text-gray-300">
              Connected {organization?.tenantName && `• ${organization.tenantName}`}
            </span>
            <ChevronDown className={cn(
              "h-3 w-3 text-gray-400 transition-transform ml-1",
              isDropdownOpen && "rotate-180"
            )} />
          </button>

          {/* Hover tooltip for token expiry */}
          {isHovering && tokenInfo.remainingTime && !isDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 text-xs text-gray-300 whitespace-nowrap">
                <Clock className="h-3 w-3" />
                <span>Token expires {tokenInfo.remainingTime}</span>
              </div>
            </div>
          )}

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <div className="absolute top-full mt-2 right-0 z-50 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
              <div className="p-3 border-b border-slate-700">
                <div className="text-sm font-medium text-white mb-1">
                  {organization?.tenantName}
                </div>
                <div className="text-xs text-gray-400">
                  {organization?.tenantType || 'ORGANISATION'}
                </div>
                {tokenInfo.remainingTime && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>Expires {tokenInfo.remainingTime}</span>
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                    "text-red-400 hover:bg-red-900/20 hover:text-red-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        isAuthenticated ? (
          <button
            onClick={handleConnect}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all",
              "hover:bg-slate-800/50"
            )}
            title="Click to connect to Xero"
          >
            <Circle className="h-2 w-2 fill-red-400 text-red-400" />
            <span className="text-sm text-gray-400">
              Xero not connected
            </span>
          </button>
        ) : (
          <div 
            className="flex items-center gap-2 px-2 py-1.5"
            title="Please log in to connect to Xero"
          >
            <Circle className="h-2 w-2 fill-gray-500 text-gray-500" />
            <span className="text-sm text-gray-500">
              Not logged in
            </span>
          </div>
        )
      )}
    </div>
  )
}