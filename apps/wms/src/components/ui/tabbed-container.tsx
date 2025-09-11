'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  hasError?: boolean
  disabled?: boolean
}

interface TabbedContainerProps {
  tabs: Tab[]
  children: React.ReactNode
  defaultTab?: string
  onChange?: (tabId: string) => void
}

export function TabbedContainer({ tabs, children, defaultTab, onChange }: TabbedContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  const childrenArray = React.Children.toArray(children)

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Tab Headers */}
      <div className="border-b">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors relative',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
                {tab.hasError && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={cn(
              'tab-panel',
              activeTab === tab.id ? 'block' : 'hidden'
            )}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
          >
            {childrenArray[index]}
          </div>
        ))}
      </div>
    </div>
  )
}

interface TabPanelProps {
  children: React.ReactNode
  className?: string
}

export function TabPanel({ children, className }: TabPanelProps) {
  return <div className={className}>{children}</div>
}