'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
  Clock,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/hrms', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hrms/employees', label: 'Employees', icon: Users },
  { href: '/hrms/resources', label: 'Resources', icon: BookOpen },
  { href: '/hrms/policies', label: 'Policies', icon: FileText },
]

export default function HRMSNavigation() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
        aria-label="Menu"
      >
        <span className="sr-only">Menu</span>
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Navigation sidebar */}
      <nav
        className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 z-40`}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gradient mb-8">HRMS</h1>
          
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/hrms' && pathname.startsWith(item.href))
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-primary dark:bg-gray-800'
                        : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 dark:border-gray-800">
          <div className="gradient-border">
            <div className="gradient-border-content p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">HR Management System</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
