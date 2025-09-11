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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-800"
        aria-label="Menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Navigation sidebar */}
      <nav
        className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative w-64 h-full bg-slate-900 border-r border-slate-800 transition-transform duration-300 z-40`}
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30'
                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
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

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800">
          <div className="gradient-border">
            <div className="gradient-border-content p-4">
              <p className="text-sm text-slate-400">HR Management System</p>
              <p className="text-xs text-slate-500 mt-1">Version 1.0.0</p>
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
