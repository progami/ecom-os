'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function RouteLoadingIndicator() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Reset loading state when route changes complete
    setIsLoading(false)
    setProgress(0)
  }, [pathname, searchParams])

  useEffect(() => {
    let progressInterval: NodeJS.Timeout
    let completeTimeout: NodeJS.Timeout

    if (isLoading) {
      // Animate progress bar
      setProgress(20)
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 200)
    } else if (progress > 0) {
      // Complete the progress bar
      setProgress(100)
      completeTimeout = setTimeout(() => setProgress(0), 200)
    }

    return () => {
      clearInterval(progressInterval)
      clearTimeout(completeTimeout)
    }
  }, [isLoading, progress])

  // Listen for navigation start via click events on links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link && link.href && !link.target && !link.download) {
        const url = new URL(link.href, window.location.origin)
        // Only show loading for internal navigation
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          setIsLoading(true)
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  if (progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-accent transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
