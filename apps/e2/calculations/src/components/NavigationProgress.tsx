'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// Configure NProgress for instant feedback
NProgress.configure({ 
  showSpinner: false,
  trickleSpeed: 100,  // Faster trickle for better perceived performance
  minimum: 0.1,       // Start earlier for instant feedback
  speed: 300          // Faster animation
})

export function NavigationProgress() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const handleStart = () => {
      setIsNavigating(true)
      NProgress.start()
    }

    const handleComplete = () => {
      setIsNavigating(false)
      NProgress.done()
    }

    // Listen for route changes
    const handleRouteChange = () => {
      handleComplete()
    }

    // Start progress when clicking on links
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      
      if (link && link.href && !link.target && link.href.includes(window.location.origin)) {
        // Internal navigation
        const url = new URL(link.href)
        if (url.pathname !== pathname) {
          handleStart()
        }
      }
    }

    // Add click listener to catch navigation starts
    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
      handleComplete()
    }
  }, [pathname])

  // Complete progress when pathname changes
  useEffect(() => {
    NProgress.done()
  }, [pathname])

  return (
    <>
      <style jsx global>{`
        #nprogress {
          pointer-events: none;
        }

        #nprogress .bar {
          background: #3b82f6;
          position: fixed;
          z-index: 1031;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
        }

        #nprogress .peg {
          display: block;
          position: absolute;
          right: 0px;
          width: 100px;
          height: 100%;
          box-shadow: 0 0 10px #3b82f6, 0 0 5px #3b82f6;
          opacity: 1.0;
          transform: rotate(3deg) translate(0px, -4px);
        }
      `}</style>
    </>
  )
}