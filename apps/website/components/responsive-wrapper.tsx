'use client'

import { useEffect, useState, useRef } from 'react'

export default function ResponsiveWrapper({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  const [containerHeight, setContainerHeight] = useState<number>(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth
      const designWidth = 1920
      const newScale = Math.min(1, viewportWidth / designWidth)
      setScale(newScale)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Update height when scale changes
  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight
        setContainerHeight(contentHeight * scale)
      }
    }

    // Initial calculation
    updateHeight()

    // Recalculate after delays to catch content loading
    const timer1 = setTimeout(updateHeight, 100)
    const timer2 = setTimeout(updateHeight, 500)
    const timer3 = setTimeout(updateHeight, 1000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [scale])

  return (
    <div style={{ height: containerHeight > 0 ? `${containerHeight}px` : 'auto', overflow: 'hidden' }}>
      <div
        ref={contentRef}
        style={{
          width: '1920px',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          marginLeft: scale < 1 ? '0' : 'auto',
          marginRight: scale < 1 ? '0' : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  )
}
