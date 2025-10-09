'use client'

import { useEffect, useRef, useState } from 'react'

type ResponsiveCanvasProps = {
  children: React.ReactNode
  designWidth?: number
}

export default function ResponsiveCanvas({ children, designWidth = 1920 }: ResponsiveCanvasProps) {
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth
      const nextScale = viewportWidth / designWidth
      setScale(nextScale < 1 ? nextScale : 1)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [designWidth])

  return (
    <div className="flex justify-center" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{
          width: `${designWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
