'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UsersIcon, RefreshIcon, CheckIcon, ExclamationCircleIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useNavigationHistory } from '@/lib/navigation-history'

type SyncResult = {
  created: number
  updated: number
  deactivated: number
  errors: string[]
}

export default function AddEmployeePage() {
  const router = useRouter()
  const { goBack } = useNavigationHistory()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setSyncResult(null)

    try {
      const response = await fetch('/api/google-admin/sync', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Sync failed')
      }

      const result = await response.json()
      setSyncResult(result)

      // If new employees were created, navigate to employees list after a delay
      if (result.created > 0) {
        setTimeout(() => {
          router.push('/employees')
        }, 2000)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to sync with Google Admin')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add Employee"
        description="People"
        icon={<UsersIcon className="h-6 w-6 text-white" />}
        showBack
      />

      <div className="max-w-2xl">
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-100 mb-6">
              <UsersIcon className="h-8 w-8 text-cyan-600" />
            </div>

            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              Employees are synced from Google Admin
            </h2>

            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              To add a new employee, create their account in Google Admin.
              Then sync to import them into HRMS. This ensures all employee
              data stays consistent with your Google Workspace.
            </p>

            {error && (
              <Alert variant="error" className="mb-6 text-left" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}

            {syncResult && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg text-left">
                <div className="flex items-center gap-2 mb-3">
                  {syncResult.errors.length === 0 ? (
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="font-medium text-slate-900">Sync Complete</span>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium text-green-600">{syncResult.created}</span> new employees imported</p>
                  <p><span className="font-medium text-blue-600">{syncResult.updated}</span> employees updated</p>
                  {syncResult.deactivated > 0 && (
                    <p><span className="font-medium text-amber-600">{syncResult.deactivated}</span> employees deactivated</p>
                  )}
                  {syncResult.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="font-medium text-red-600 mb-1">{syncResult.errors.length} errors:</p>
                      <ul className="list-disc list-inside text-red-600 text-xs">
                        {syncResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {syncResult.errors.length > 5 && (
                          <li>...and {syncResult.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={goBack}>
                Cancel
              </Button>
              <Button onClick={handleSync} loading={syncing}>
                <RefreshIcon className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync from Google Admin'}
              </Button>
            </div>

            <p className="text-xs text-slate-400 mt-6">
              Need help? Contact your Google Admin administrator to create new user accounts.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
