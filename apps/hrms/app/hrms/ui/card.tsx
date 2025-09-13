import * as React from 'react'

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${className}`}>{children}</div>
}

export function CardHeader({ className = '', title, subtitle }: { className?: string; title: string; subtitle?: string }) {
  return (
    <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${className}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}

