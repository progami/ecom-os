'use client'

import React from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function FinancialDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Financial Dashboard Error:', error)
        console.error('Error Info:', errorInfo)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}