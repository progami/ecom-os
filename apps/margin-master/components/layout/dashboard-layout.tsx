'use client'

import { MainNav } from './main-nav'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MainNav />
      <div className="lg:pl-72">
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </>
  )
}