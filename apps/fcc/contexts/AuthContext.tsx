'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { signOut as nextAuthSignOut } from 'next-auth/react'
import { waitForServerReady } from '@/lib/server-ready'

// Use console for client-side logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[AuthContext] ${message}`, data || '')
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthContext] ${message}`, data || '')
    }
  },
  warn: (message: string, data?: any) => {
    console.warn(`[AuthContext] ${message}`, data || '')
  },
  error: (message: string, error?: any, data?: any) => {
    console.error(`[AuthContext] ${message}`, error, data || '')
  }
}

interface Organization {
  tenantId: string
  tenantName: string
  tenantType: string
}

interface User {
  userId: string
  email: string
  tenantId: string
  tenantName: string
}

interface AuthState {
  // User authentication state
  isAuthenticated: boolean
  user: User | null
  
  // Database state - do we have data?
  hasData: boolean
  
  // Xero connection state
  hasActiveToken: boolean
  organization: Organization | null
  
  // Loading states
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  // Actions
  signIn: () => void
  signOut: () => Promise<void>
  connectToXero: () => void
  disconnectFromXero: () => Promise<void>
  checkAuthStatus: (skipServerCheck?: boolean) => Promise<void>
  // Alias for compatibility
  hasXeroConnection: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  // Initialize auth state from cookies if available (SSR-friendly)
  const getInitialAuthState = (): AuthState => {
    if (typeof window === 'undefined') {
      // Server-side: can't access cookies directly
      logger.debug('Server-side render, starting with default state')
      return {
        isAuthenticated: false,
        user: null,
        hasData: false,
        hasActiveToken: false,
        organization: null,
        isLoading: true
      }
    }
    
    // Client-side: check window flag first (set by clear-auth-state.js)
    if (typeof window !== 'undefined' && window.__AUTH_STATE_OPTIMISTIC__ === true) {
      logger.info('Using optimistic auth state from window flag')
      // We'll get the actual user data from checkAuthStatus
      return {
        isAuthenticated: true,
        user: null,
        hasData: false,
        hasActiveToken: false,
        organization: null,
        isLoading: true
      }
    }
    
    // Cannot check httpOnly cookies from client-side
    logger.info('Starting with default unauthenticated state (cookies are httpOnly)')
    
    return {
      isAuthenticated: false,
      user: null,
      hasData: false,
      hasActiveToken: false,
      organization: null,
      isLoading: true
    }
  }
  
  const [authState, setAuthState] = useState<AuthState>(getInitialAuthState)

  const checkAuthStatus = useCallback(async (skipServerCheck = false) => {
    // Check if this is an OAuth return
    const isOAuthReturn = skipServerCheck || 
      (typeof window !== 'undefined' && 
       (window.location.search.includes('xero_connected=true') || 
        window.location.search.includes('auth_refresh=true')));
    
    const startTime = Date.now();
    logger.info('[AuthContext] Checking auth status...', {
      currentState: {
        isAuthenticated: authState.isAuthenticated,
        hasActiveToken: authState.hasActiveToken,
        user: authState.user?.email
      },
      isOAuthReturn,
      skipServerCheck,
      cookies: typeof window !== 'undefined' ? document.cookie : 'server-side'
    })
    
    // Skip server ready check for OAuth returns - we know server is ready
    if (!isOAuthReturn) {
      const serverReady = await waitForServerReady();
      if (!serverReady) {
        logger.error('Server not ready after maximum retries');
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          isLoading: false
        }));
        return;
      }
    }
    
    // Use shorter timeout for OAuth returns
    const timeoutDuration = isOAuthReturn ? 2000 : 5000;
    const timeout = setTimeout(() => {
      logger.warn('Auth check timeout - setting default state')
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        isLoading: false
      }))
    }, timeoutDuration)
    
    try {
      // Check user session first
      const sessionRes = await fetch('/api/v1/auth/session', { 
        credentials: 'include',
        // Add timeout to fetch
        signal: AbortSignal.timeout(8000)
      })
      const sessionData = await sessionRes.json()
      
      clearTimeout(timeout)
      
      logger.info('Session check response', {
        status: sessionRes.status,
        authenticated: sessionData.authenticated,
        user: sessionData.user?.email
      })
      
      if (!sessionData.authenticated) {
        logger.info('No user session found')
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          isLoading: false
        }))
        return
      }
      
      // User is authenticated, check database state and Xero connection
      const [dbStatusRes, xeroStatusRes] = await Promise.all([
        fetch('/api/v1/database/status', { credentials: 'include' }),
        fetch('/api/v1/xero/status', { credentials: 'include' })
      ])

      const dbStatus = await dbStatusRes.json()
      const xeroStatus = await xeroStatusRes.json()
      
      logger.info('Status check complete', {
        hasSession: true,
        hasData: dbStatus.hasData,
        xeroConnected: xeroStatus.connected,
        xeroOrganization: xeroStatus.organization,
        dbStatusResponse: dbStatusRes.status,
        xeroStatusResponse: xeroStatusRes.status
      })

      const newAuthState = {
        isAuthenticated: true,
        user: sessionData.user,
        hasData: dbStatus.hasData || false,
        hasActiveToken: xeroStatus.connected || false,
        organization: xeroStatus.organization,
        isLoading: false
      }
      
      logger.info('Setting new auth state', newAuthState)
      
      setAuthState(prev => ({
        ...prev,
        ...newAuthState
      }))
      
      // Log timing for OAuth returns
      if (isOAuthReturn) {
        const duration = Date.now() - startTime;
        logger.info(`[AuthContext] OAuth auth check completed in ${duration}ms`, {
          duration,
          isOAuthReturn: true,
          hasActiveToken: newAuthState.hasActiveToken
        })
      }

      // Don't auto-sync here to avoid circular dependency
    } catch (error) {
      logger.error('Failed to check auth status', error, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      })
      clearTimeout(timeout)
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // Check auth status on mount and when window gains focus
  useEffect(() => {
    checkAuthStatus()
    
    // Re-check auth status when window regains focus (handles tab switching)
    const handleFocus = () => {
      logger.info('Window regained focus, checking auth status')
      // Small delay to ensure cookies are properly set after OAuth redirect
      setTimeout(() => {
        checkAuthStatus()
      }, 100)
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Also check on visibility change (handles browser back/forward)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        logger.info('Page became visible, checking auth status')
        // Small delay to ensure cookies are properly set after OAuth redirect
        setTimeout(() => {
          checkAuthStatus()
        }, 100)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for forced auth refresh events
    const handleForceRefresh = () => {
      logger.info('Force auth refresh requested')
      checkAuthStatus()
    }
    
    window.addEventListener('forceAuthRefresh', handleForceRefresh)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('forceAuthRefresh', handleForceRefresh)
    }
  }, [checkAuthStatus])

  const signIn = () => {
    // Redirect to login page which will handle Xero OAuth
    window.location.href = '/login'
  }
  
  const signOut = async () => {
    try {
      const portalAuth = process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/api/auth/signout', portalAuth)
      url.searchParams.set('callbackUrl', window.location.origin + '/login')
      window.location.href = url.toString()
    } catch (error) {
      logger.error('Failed to sign out', error)
      toast.error('Error signing out')
    }
  }
  
  const connectToXero = () => {
    window.location.href = '/api/v1/xero/auth'
  }

  const disconnectFromXero = async () => {
    console.log('[AuthContext] Starting disconnect...');
    try {
      const response = await fetch('/api/v1/xero/disconnect', { 
        method: 'POST',
        credentials: 'include'
      })
      
      console.log('[AuthContext] Disconnect response:', response.status);
      
      if (response.ok) {
        console.log('[AuthContext] Disconnect successful, updating state...');
        // Immediately update local state to show disconnected
        setAuthState(prev => {
          const newState = {
            ...prev,
            hasActiveToken: false,
            organization: null,
            // Keep hasData true as we still have data in the database
            hasData: prev.hasData
          };
          logger.info('Xero disconnected', { hasData: newState.hasData });
          return newState;
        })
        
        toast.success('Disconnected from Xero')
        
        // Don't re-check auth status immediately as it might override our state update
        // The state update above should be sufficient
      } else {
        toast.error('Failed to disconnect from Xero')
      }
    } catch (error) {
      logger.error('Failed to disconnect from Xero', error)
      toast.error('Error disconnecting from Xero')
    }
  }


  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    connectToXero,
    disconnectFromXero,
    checkAuthStatus,
    // Alias for compatibility
    hasXeroConnection: authState.hasActiveToken
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for protected pages that need Xero connection
export function withXeroConnection<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { hasActiveToken, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !hasActiveToken) {
        router.push('/bookkeeping?connect=true')
      }
    }, [hasActiveToken, isLoading, router])

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (!hasActiveToken) {
      return null
    }

    return <Component {...props} />
  }
}

// HOC for pages that only need data (no active Xero connection required)
export function withData<P extends object>(
  Component: React.ComponentType<P>
) {
  return function DataProtectedComponent(props: P) {
    const { hasData, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !hasData) {
        router.push('/bookkeeping?setup=true')
      }
    }, [hasData, isLoading, router])

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (!hasData) {
      return null
    }

    return <Component {...props} />
  }
}
