'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePageState, type PageState } from '@/lib/store'

/**
 * Hook that provides hydration-safe access to persisted page state.
 * Uses the current pathname as the page key.
 *
 * @param defaultState - Default values to use before hydration and for missing fields
 * @returns The page state with setters, plus a hydrated flag
 */
export function usePersistedPageState<T extends Partial<PageState>>(
  defaultState: T
): T & ReturnType<typeof usePageState> & { hydrated: boolean } {
  const pathname = usePathname()
  const pageState = usePageState(pathname)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Merge defaults with persisted state
  const mergedState = {
    ...defaultState,
    ...(hydrated ? pageState : {}),
  }

  return {
    ...mergedState,
    ...pageState,
    hydrated,
  } as T & ReturnType<typeof usePageState> & { hydrated: boolean }
}

/**
 * Hook for persisting active tab state with hydration safety.
 *
 * @param pageKey - Unique key for the page (usually the pathname)
 * @param defaultTab - Default tab to show before hydration
 * @returns [activeTab, setActiveTab, hydrated]
 */
export function usePersistedTab(
  pageKey: string,
  defaultTab: string
): [string, (tab: string) => void, boolean] {
  const { activeTab, setActiveTab: storeSetActiveTab } = usePageState(pageKey)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const currentTab = hydrated && activeTab ? activeTab : defaultTab

  return [currentTab, storeSetActiveTab, hydrated]
}

/**
 * Hook for persisting filter state with hydration safety.
 *
 * @param pageKey - Unique key for the page
 * @param defaultFilters - Default filter values
 * @returns [filters, setFilters, updateFilter, hydrated]
 */
export function usePersistedFilters<T extends Record<string, string | number | boolean | null>>(
  pageKey: string,
  defaultFilters: T
): [
  T,
  (filters: T) => void,
  (key: keyof T, value: T[keyof T]) => void,
  boolean
] {
  const { filters, setFilters: storeSetFilters, updateFilter: storeUpdateFilter } = usePageState(pageKey)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const currentFilters = hydrated && filters
    ? { ...defaultFilters, ...filters } as T
    : defaultFilters

  const setFilters = (newFilters: T) => {
    storeSetFilters(newFilters)
  }

  const updateFilter = (key: keyof T, value: T[keyof T]) => {
    storeUpdateFilter(key as string, value)
  }

  return [currentFilters, setFilters, updateFilter, hydrated]
}

/**
 * Hook for persisting search state with hydration safety.
 *
 * @param pageKey - Unique key for the page
 * @param defaultSearch - Default search value
 * @returns [search, setSearch, hydrated]
 */
export function usePersistedSearch(
  pageKey: string,
  defaultSearch: string = ''
): [string, (search: string) => void, boolean] {
  const { search, setSearch: storeSetSearch } = usePageState(pageKey)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const currentSearch = hydrated && search !== undefined ? search : defaultSearch

  return [currentSearch, storeSetSearch, hydrated]
}

/**
 * Hook for persisting pagination state with hydration safety.
 *
 * @param pageKey - Unique key for the page
 * @param defaultPage - Default page number
 * @param defaultPageSize - Default page size
 * @returns [page, pageSize, setPage, setPageSize, hydrated]
 */
export function usePersistedPagination(
  pageKey: string,
  defaultPage: number = 1,
  defaultPageSize: number = 25
): [
  number,
  number,
  (page: number) => void,
  (pageSize: number) => void,
  boolean
] {
  const { pagination, setPagination: storeSetPagination } = usePageState(pageKey)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const currentPage = hydrated && pagination?.page ? pagination.page : defaultPage
  const currentPageSize = hydrated && pagination?.pageSize ? pagination.pageSize : defaultPageSize

  const setPage = (page: number) => {
    storeSetPagination(page, currentPageSize)
  }

  const setPageSize = (pageSize: number) => {
    storeSetPagination(1, pageSize) // Reset to page 1 when page size changes
  }

  return [currentPage, currentPageSize, setPage, setPageSize, hydrated]
}

/**
 * Hook for persisting sort state with hydration safety.
 *
 * @param pageKey - Unique key for the page
 * @param defaultField - Default sort field
 * @param defaultDirection - Default sort direction
 * @returns [sortField, sortDirection, setSort, toggleSort, hydrated]
 */
export function usePersistedSort(
  pageKey: string,
  defaultField: string,
  defaultDirection: 'asc' | 'desc' = 'asc'
): [
  string,
  'asc' | 'desc',
  (field: string, direction: 'asc' | 'desc') => void,
  (field: string) => void,
  boolean
] {
  const { sort, setSort: storeSetSort } = usePageState(pageKey)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const currentField = hydrated && sort?.field ? sort.field : defaultField
  const currentDirection = hydrated && sort?.direction ? sort.direction : defaultDirection

  const toggleSort = (field: string) => {
    if (field === currentField) {
      storeSetSort(field, currentDirection === 'asc' ? 'desc' : 'asc')
    } else {
      storeSetSort(field, 'asc')
    }
  }

  return [currentField, currentDirection, storeSetSort, toggleSort, hydrated]
}
