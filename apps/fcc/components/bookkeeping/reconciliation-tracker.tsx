'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, AlertCircle, TrendingUp, Clock, FileText } from 'lucide-react'
import { formatDistanceToNow, addDays, isAfter } from 'date-fns'

interface ReconciliationPeriod {
  startDate: Date
  endDate: Date
  totalTransactions: number
  reconciledCount: number
  pendingCount: number
  flaggedForReview: number
  accounts: Array<{
    name: string
    reconciledCount: number
    pendingCount: number
  }>
}

interface ReconciliationTrackerProps {
  lastMeetingDate?: Date
  nextMeetingDate?: Date
  onViewDetails?: () => void
}

export function ReconciliationTracker({ 
  lastMeetingDate, 
  nextMeetingDate,
  onViewDetails 
}: ReconciliationTrackerProps) {
  const [periodData, setPeriodData] = useState<ReconciliationPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  // Default to 2 weeks ago if no last meeting date provided
  const effectiveLastMeeting = lastMeetingDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const effectiveNextMeeting = nextMeetingDate || addDays(effectiveLastMeeting, 14)

  useEffect(() => {
    fetchReconciliationData()
  }, [])

  const fetchReconciliationData = async () => {
    try {
      setLoading(true)
      
      // Fetch transactions since last meeting
      const response = await fetch(`/api/v1/bookkeeping/reconciliation-summary?since=${effectiveLastMeeting.toISOString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setPeriodData(data)
      }
    } catch (error) {
      console.error('Error fetching reconciliation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const reconciliationRate = periodData 
    ? Math.round((periodData.reconciledCount / periodData.totalTransactions) * 100) 
    : 0

  const daysUntilMeeting = Math.ceil((effectiveNextMeeting.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isOverdue = isAfter(new Date(), effectiveNextMeeting)

  return (
    <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-400" />
          Finance Meeting Reconciliation
        </h3>
        {!isOverdue ? (
          <span className="text-sm text-gray-400">
            Next meeting in {daysUntilMeeting} days
          </span>
        ) : (
          <span className="text-sm text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Meeting overdue
          </span>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-slate-800/50 rounded-xl" />
          <div className="h-32 bg-slate-800/50 rounded-xl" />
        </div>
      ) : periodData ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Since Last Meeting</span>
                <TrendingUp className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {periodData.totalTransactions}
              </div>
              <div className="text-xs text-gray-500">
                Total transactions
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Reconciliation Rate</span>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {reconciliationRate}%
              </div>
              <div className="text-xs text-gray-500">
                {periodData.reconciledCount} reconciled
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Reconciled</span>
              <span className="text-green-400 font-medium">{periodData.reconciledCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Pending Review</span>
              <span className="text-amber-400 font-medium">{periodData.pendingCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Flagged for Meeting</span>
              <span className="text-red-400 font-medium">{periodData.flaggedForReview}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Progress</span>
              <span>{periodData.reconciledCount} / {periodData.totalTransactions}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${reconciliationRate}%` }}
              />
            </div>
          </div>

          {/* Top Accounts */}
          <div className="space-y-2 mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Account Activity</h4>
            {periodData.accounts.slice(0, 3).map((account, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-white truncate">{account.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">{account.reconciledCount}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-amber-400">{account.pendingCount}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 py-2 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600/30 transition-colors flex items-center justify-center gap-2 border border-purple-500/30 text-sm"
            >
              <Clock className="h-4 w-4" />
              Schedule Meeting
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No reconciliation data available</p>
        </div>
      )}
    </div>
  )
}