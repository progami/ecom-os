'use client'

import Breadcrumb from './Breadcrumb'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="px-4 sm:px-6 md:px-8 py-3">
        <Breadcrumb />
      </div>
    </header>
  )
}

