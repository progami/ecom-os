'use client'

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

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

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const historyRef = useRef<string[]>([])
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip the initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      historyRef.current = [pathname]
      return
    }

    // Don't add duplicate consecutive paths
    const lastPath = historyRef.current[historyRef.current.length - 1]
    if (lastPath !== pathname) {
      historyRef.current.push(pathname)
      // Keep history limited to prevent memory issues
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50)
      }
    }
  }, [pathname])

  const goBack = () => {
    if (historyRef.current.length > 1) {
      // Remove current path
      historyRef.current.pop()
      // Get previous path
      const previousPath = historyRef.current[historyRef.current.length - 1]
      if (previousPath) {
        window.location.href = previousPath
      }
    } else {
      // Fallback to browser history
      window.history.back()
    }
  }

  const canGoBack = historyRef.current.length > 1
  const previousPath = historyRef.current.length > 1
    ? historyRef.current[historyRef.current.length - 2]
    : null

  return (
    <NavigationHistoryContext.Provider value={{ goBack, canGoBack, previousPath }}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}

export function useNavigationHistory() {
  return useContext(NavigationHistoryContext)
}
