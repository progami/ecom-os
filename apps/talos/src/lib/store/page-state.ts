'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Generic page state that can be used across all pages
 */
export interface PageState {
  // Active tab for tabbed interfaces
  activeTab?: string
  // Search/filter term
  search?: string
  // Filter values (key-value pairs)
  filters?: Record<string, string | number | boolean | null>
  // Sort configuration
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  // Pagination
  pagination?: {
    page: number
    pageSize: number
  }
  // Scroll position
  scrollY?: number
  // Expanded/collapsed sections
  expandedSections?: string[]
  // Selected items (for multi-select tables)
  selectedIds?: string[]
  // Custom data (for page-specific state)
  custom?: Record<string, unknown>
}

/**
 * Map of page paths to their state
 */
interface PageStateMap {
  [pagePath: string]: PageState
}

interface PageStateStore {
  pages: PageStateMap

  // Get state for a specific page
  getPageState: (pagePath: string) => PageState

  // Set entire state for a page
  setPageState: (pagePath: string, state: PageState) => void

  // Update partial state for a page (merges with existing)
  updatePageState: (pagePath: string, state: Partial<PageState>) => void

  // Set a specific field
  setActiveTab: (pagePath: string, tab: string) => void
  setSearch: (pagePath: string, search: string) => void
  setFilters: (pagePath: string, filters: Record<string, string | number | boolean | null>) => void
  updateFilter: (pagePath: string, key: string, value: string | number | boolean | null) => void
  setSort: (pagePath: string, field: string, direction: 'asc' | 'desc') => void
  setPagination: (pagePath: string, page: number, pageSize?: number) => void
  setScrollY: (pagePath: string, scrollY: number) => void
  toggleSection: (pagePath: string, sectionId: string) => void
  setSelectedIds: (pagePath: string, ids: string[]) => void
  toggleSelectedId: (pagePath: string, id: string) => void
  setCustom: (pagePath: string, key: string, value: unknown) => void

  // Clear state for a page
  clearPageState: (pagePath: string) => void

  // Clear all state
  clearAllState: () => void
}

/**
 * Default page sizes for different contexts
 */
export const DEFAULT_PAGE_SIZES = {
  table: 25,
  grid: 12,
  list: 50,
} as const

/**
 * Zustand store for persisting page state across navigation
 */
export const usePageStateStore = create<PageStateStore>()(
  persist(
    (set, get) => ({
      pages: {},

      getPageState: (pagePath) => {
        return get().pages[pagePath] || {}
      },

      setPageState: (pagePath, state) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: state,
          },
        }))
      },

      updatePageState: (pagePath, state) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              ...state,
            },
          },
        }))
      },

      setActiveTab: (pagePath, tab) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              activeTab: tab,
            },
          },
        }))
      },

      setSearch: (pagePath, search) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              search,
              // Reset pagination when search changes
              pagination: prev.pages[pagePath]?.pagination
                ? { ...prev.pages[pagePath].pagination!, page: 1 }
                : undefined,
            },
          },
        }))
      },

      setFilters: (pagePath, filters) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              filters,
              // Reset pagination when filters change
              pagination: prev.pages[pagePath]?.pagination
                ? { ...prev.pages[pagePath].pagination!, page: 1 }
                : undefined,
            },
          },
        }))
      },

      updateFilter: (pagePath, key, value) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              filters: {
                ...prev.pages[pagePath]?.filters,
                [key]: value,
              },
              // Reset pagination when filter changes
              pagination: prev.pages[pagePath]?.pagination
                ? { ...prev.pages[pagePath].pagination!, page: 1 }
                : undefined,
            },
          },
        }))
      },

      setSort: (pagePath, field, direction) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              sort: { field, direction },
            },
          },
        }))
      },

      setPagination: (pagePath, page, pageSize) => {
        set((prev) => {
          const currentPagination = prev.pages[pagePath]?.pagination
          return {
            pages: {
              ...prev.pages,
              [pagePath]: {
                ...prev.pages[pagePath],
                pagination: {
                  page,
                  pageSize: pageSize ?? currentPagination?.pageSize ?? DEFAULT_PAGE_SIZES.table,
                },
              },
            },
          }
        })
      },

      setScrollY: (pagePath, scrollY) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              scrollY,
            },
          },
        }))
      },

      toggleSection: (pagePath, sectionId) => {
        set((prev) => {
          const currentSections = prev.pages[pagePath]?.expandedSections || []
          const isExpanded = currentSections.includes(sectionId)
          return {
            pages: {
              ...prev.pages,
              [pagePath]: {
                ...prev.pages[pagePath],
                expandedSections: isExpanded
                  ? currentSections.filter((id) => id !== sectionId)
                  : [...currentSections, sectionId],
              },
            },
          }
        })
      },

      setSelectedIds: (pagePath, ids) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              selectedIds: ids,
            },
          },
        }))
      },

      toggleSelectedId: (pagePath, id) => {
        set((prev) => {
          const currentIds = prev.pages[pagePath]?.selectedIds || []
          const isSelected = currentIds.includes(id)
          return {
            pages: {
              ...prev.pages,
              [pagePath]: {
                ...prev.pages[pagePath],
                selectedIds: isSelected
                  ? currentIds.filter((i) => i !== id)
                  : [...currentIds, id],
              },
            },
          }
        })
      },

      setCustom: (pagePath, key, value) => {
        set((prev) => ({
          pages: {
            ...prev.pages,
            [pagePath]: {
              ...prev.pages[pagePath],
              custom: {
                ...prev.pages[pagePath]?.custom,
                [key]: value,
              },
            },
          },
        }))
      },

      clearPageState: (pagePath) => {
        set((prev) => {
          const { [pagePath]: _, ...rest } = prev.pages
          return { pages: rest }
        })
      },

      clearAllState: () => {
        set({ pages: {} })
      },
    }),
    {
      name: 'talos-page-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields (exclude scroll position as it can be stale)
      partialize: (state) => ({
        pages: Object.fromEntries(
          Object.entries(state.pages).map(([key, value]) => [
            key,
            {
              activeTab: value.activeTab,
              search: value.search,
              filters: value.filters,
              sort: value.sort,
              pagination: value.pagination,
              expandedSections: value.expandedSections,
              custom: value.custom,
              // Exclude: scrollY, selectedIds (these are session-specific)
            },
          ])
        ),
      }),
    }
  )
)

/**
 * Hook to get and set page state for the current page
 * Automatically uses the current pathname
 */
export function usePageState(pagePath: string) {
  const store = usePageStateStore()
  const pageState = store.getPageState(pagePath)

  return {
    ...pageState,
    setActiveTab: (tab: string) => store.setActiveTab(pagePath, tab),
    setSearch: (search: string) => store.setSearch(pagePath, search),
    setFilters: (filters: Record<string, string | number | boolean | null>) =>
      store.setFilters(pagePath, filters),
    updateFilter: (key: string, value: string | number | boolean | null) =>
      store.updateFilter(pagePath, key, value),
    setSort: (field: string, direction: 'asc' | 'desc') =>
      store.setSort(pagePath, field, direction),
    setPagination: (page: number, pageSize?: number) =>
      store.setPagination(pagePath, page, pageSize),
    setScrollY: (scrollY: number) => store.setScrollY(pagePath, scrollY),
    toggleSection: (sectionId: string) => store.toggleSection(pagePath, sectionId),
    setSelectedIds: (ids: string[]) => store.setSelectedIds(pagePath, ids),
    toggleSelectedId: (id: string) => store.toggleSelectedId(pagePath, id),
    setCustom: (key: string, value: unknown) => store.setCustom(pagePath, key, value),
    updatePageState: (state: Partial<PageState>) => store.updatePageState(pagePath, state),
    clearPageState: () => store.clearPageState(pagePath),
  }
}
