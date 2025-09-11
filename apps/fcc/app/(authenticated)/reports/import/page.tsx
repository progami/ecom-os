'use client'

import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { ImportPageContent } from './ImportPageContent'

export default function ImportReportsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <UnifiedPageHeader 
          title="Import Financial Reports"
          description="Upload your financial reports in CSV or Excel format for analysis"
          showAuthStatus={true}
          showBackButton={true}
          backTo="/reports"
          backLabel="Back to Reports"
        />

        <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto">
          <ImportPageContent />
        </div>
      </div>
    </div>
  )
}