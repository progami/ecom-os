'use client'

import { Calculator, Scale, Brush, Megaphone, Cpu, Users, MoreHorizontal } from 'lucide-react'
import { getSubcategories } from './resourceTaxonomy'

interface Category {
  id: string
  name: string
  icon: React.ElementType
  color: string
}

const categories: Category[] = [
  { id: 'all', name: 'All Providers', icon: Users, color: 'text-muted-foreground' },
  { id: 'ACCOUNTING', name: 'Accounting', icon: Calculator, color: 'text-blue-500' },
  { id: 'LEGAL', name: 'Legal', icon: Scale, color: 'text-purple-500' },
  { id: 'DESIGN', name: 'Design', icon: Brush, color: 'text-pink-500' },
  { id: 'MARKETING', name: 'Marketing', icon: Megaphone, color: 'text-green-500' },
  { id: 'IT', name: 'IT Services', icon: Cpu, color: 'text-orange-500' },
  { id: 'HR', name: 'HR Services', icon: Users, color: 'text-cyan-500' },
  { id: 'OTHER', name: 'Other', icon: MoreHorizontal, color: 'text-muted-foreground' },
]

interface ResourceCategoriesProps {
  selectedCategory: string
  selectedSubcategories?: string[]
  onCategoryChange: (category: string) => void
  onSubcategoriesChange?: (subcategories: string[]) => void
}

export default function ResourceCategories({ selectedCategory, selectedSubcategories = [], onCategoryChange, onSubcategoriesChange }: ResourceCategoriesProps) {
  const subs = selectedCategory && selectedCategory !== 'all' ? getSubcategories(selectedCategory) : []
  const hasSubs = subs.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon
          const isSelected = selectedCategory === category.id
          
          return (
            <button
              key={category.id}
              onClick={() => {
                onCategoryChange(category.id)
                onSubcategoriesChange?.([])
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                isSelected
                  ? 'bg-gray-100 text-primary dark:bg-gray-800'
                  : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className={isSelected ? 'text-white' : category.color} size={18} />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          )
        })}
      </div>

      {hasSubs && (
        <div className="flex flex-wrap gap-2">
          {/* All (clear selections) */}
          <button
            onClick={() => onSubcategoriesChange?.([])}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedSubcategories.length === 0
                ? 'bg-gray-100 text-primary dark:bg-gray-800'
                : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            All
          </button>
          {subs.map((s) => {
            const active = selectedSubcategories.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => {
                  const next = active
                    ? selectedSubcategories.filter(id => id !== s.id)
                    : [...selectedSubcategories, s.id]
                  onSubcategoriesChange?.(next)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  active
                    ? 'bg-gray-100 text-primary dark:bg-gray-800'
                    : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
