import { redirect } from 'next/navigation'
import { HubDashboard } from '@/components/hub'
import { getCurrentEmployeeId } from '@/lib/current-user'

export default async function HubPage() {
  const employeeId = await getCurrentEmployeeId()
  if (!employeeId) {
    redirect('/no-access')
  }

  return (
    <>
      {/* Hero header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              My Hub
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Your personal dashboard
            </p>
          </div>
        </div>
      </div>

      <HubDashboard employeeId={employeeId} />
    </>
  )
}
