'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { BellIcon, DocumentIcon, XIcon } from './Icons'
import { NotificationsApi, type Notification } from '@/lib/api-client'

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'POLICY_CREATED':
    case 'POLICY_UPDATED':
    case 'POLICY_ARCHIVED':
      return <DocumentIcon className="h-5 w-5 text-cyan-600" />
    default:
      return <BellIcon className="h-5 w-5 text-slate-600" />
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const data = await NotificationsApi.list({ limit: 20 })
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
    } catch (e) {
      console.error('Failed to load notifications', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    // Refresh every 60 seconds
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await NotificationsApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (e) {
      console.error('Failed to mark all as read', e)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await NotificationsApi.markAsRead([notification.id])
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (e) {
        console.error('Failed to mark as read', e)
      }
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <XIcon className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => handleNotificationClick(notification)}
                        className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                          !notification.isRead ? 'bg-cyan-50/50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.isRead ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="flex-shrink-0">
                            <span className="h-2 w-2 rounded-full bg-cyan-500 block" />
                          </div>
                        )}
                      </Link>
                    ) : (
                      <div
                        className={`flex gap-3 px-4 py-3 ${
                          !notification.isRead ? 'bg-cyan-50/50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.isRead ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="flex-shrink-0">
                            <span className="h-2 w-2 rounded-full bg-cyan-500 block" />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
