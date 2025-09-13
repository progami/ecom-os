'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BookOpen, FileText } from 'lucide-react'

const items = [
  { href: '/hrms', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hrms/employees', label: 'Employees', icon: Users },
  { href: '/hrms/resources', label: 'Resources', icon: BookOpen },
  { href: '/hrms/policies', label: 'Policies', icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex md:inset-y-0 md:z-50 md:flex-col md:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="px-5 py-4">
        <div className="text-xl font-bold text-primary">HRMS</div>
      </div>
      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/hrms' && pathname.startsWith(href))
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    active
                      ? 'bg-gray-100 text-primary dark:bg-gray-800'
                      : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

