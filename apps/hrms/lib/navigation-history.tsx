'use client'

import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type NavigationHistoryContextType = {
  goBack: () => void
  canGoBack: boolean
  previousPath: string | null
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType>({
  goBack: () => {},
  canGoBack: false,
  previousPath: null,
})

/**
 * Contextual navigation defaults
 * Instead of recording the literal journey like browser history,
 * we use reasonable defaults for each page.
 *
 * Pattern matching priority (most specific first):
 * 1. Exact path matches
 * 2. Dynamic route patterns
 */
function getDefaultBackPath(pathname: string): string | null {
  // Remove trailing slash
  const path = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname

  // Dashboard - no back
  if (path === '/' || path === '') {
    return null
  }

  // Employee routes
  if (/^\/employees\/[^/]+\/edit$/.test(path)) {
    // /employees/[id]/edit -> /employees/[id]
    return path.replace('/edit', '')
  }
  if (/^\/employees\/add$/.test(path)) {
    // /employees/add -> /employees
    return '/employees'
  }
  if (/^\/employees\/[^/]+$/.test(path)) {
    // /employees/[id] -> /employees
    return '/employees'
  }

  // Policy routes
  if (/^\/policies\/[^/]+\/edit$/.test(path)) {
    // /policies/[id]/edit -> /policies/[id]
    return path.replace('/edit', '')
  }
  if (/^\/policies\/add$/.test(path)) {
    // /policies/add -> /policies
    return '/policies'
  }
  if (/^\/policies\/[^/]+$/.test(path)) {
    // /policies/[id] -> /policies
    return '/policies'
  }

  // Performance review routes
  if (/^\/performance\/reviews\/add$/.test(path)) {
    // /performance/reviews/add -> /performance/reviews
    return '/performance/reviews'
  }
  if (/^\/performance\/reviews\/[^/]+$/.test(path)) {
    // /performance/reviews/[id] -> /performance/reviews
    return '/performance/reviews'
  }

  // Disciplinary routes
  if (/^\/performance\/disciplinary\/add$/.test(path)) {
    // /performance/disciplinary/add -> /performance/disciplinary
    return '/performance/disciplinary'
  }
  if (/^\/performance\/disciplinary\/[^/]+$/.test(path)) {
    // /performance/disciplinary/[id] -> /performance/disciplinary
    return '/performance/disciplinary'
  }

  // Resources routes
  if (/^\/resources\/add$/.test(path)) {
    return '/resources'
  }
  if (/^\/resources\/[^/]+$/.test(path)) {
    return '/resources'
  }

  // Generic fallback: go to parent path or dashboard
  const segments = path.split('/').filter(Boolean)
  if (segments.length > 1) {
    // Go to parent
    segments.pop()
    return '/' + segments.join('/')
  }

  // Top-level pages go to dashboard
  return '/'
}

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const previousPath = useMemo(() => getDefaultBackPath(pathname), [pathname])
  const canGoBack = previousPath !== null

  const goBack = useCallback(() => {
    const backPath = getDefaultBackPath(pathname)
    if (backPath) {
      router.push(backPath)
    } else {
      // Fallback to browser history if no default
      window.history.back()
    }
  }, [pathname, router])

  return (
    <NavigationHistoryContext.Provider value={{ goBack, canGoBack, previousPath }}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}

export function useNavigationHistory() {
  return useContext(NavigationHistoryContext)
}
