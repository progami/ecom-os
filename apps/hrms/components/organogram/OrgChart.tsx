'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { HierarchyEmployee } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon } from '@/components/ui/Icons'

type OrgNode = HierarchyEmployee & {
  children: OrgNode[]
}

type Props = {
  employees: HierarchyEmployee[]
  currentEmployeeId: string | null
  managerChainIds: string[]
  directReportIds: string[]
}

function buildTree(employees: HierarchyEmployee[]): OrgNode[] {
  const employeeMap = new Map<string, OrgNode>()

  // Initialize all employees with empty children
  for (const emp of employees) {
    employeeMap.set(emp.id, { ...emp, children: [] })
  }

  const roots: OrgNode[] = []

  // Build tree by adding children to their managers
  for (const emp of employees) {
    const node = employeeMap.get(emp.id)!
    if (emp.reportsToId && employeeMap.has(emp.reportsToId)) {
      employeeMap.get(emp.reportsToId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children alphabetically
  const sortChildren = (node: OrgNode) => {
    node.children.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    )
    node.children.forEach(sortChildren)
  }

  roots.sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  )
  roots.forEach(sortChildren)

  return roots
}

// Employee card component
function EmployeeCard({
  node,
  isCurrentUser,
  isManager,
  isDirectReport,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  node: OrgNode
  isCurrentUser: boolean
  isManager: boolean
  isDirectReport: boolean
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  let borderClass = 'border-slate-200'
  let bgClass = 'bg-white'
  let shadowClass = 'shadow-sm'

  if (isCurrentUser) {
    borderClass = 'border-cyan-500 border-2'
    bgClass = 'bg-gradient-to-br from-cyan-50 to-white'
    shadowClass = 'shadow-md shadow-cyan-100'
  } else if (isDirectReport) {
    borderClass = 'border-emerald-400'
    bgClass = 'bg-gradient-to-br from-emerald-50 to-white'
    shadowClass = 'shadow-sm shadow-emerald-100'
  } else if (isManager) {
    borderClass = 'border-blue-400'
    bgClass = 'bg-gradient-to-br from-blue-50 to-white'
    shadowClass = 'shadow-sm shadow-blue-100'
  }

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl border ${borderClass} ${bgClass} ${shadowClass} p-4 min-w-[180px] max-w-[200px] hover:shadow-lg transition-all duration-200`}
      data-employee-id={node.id}
    >
      <Avatar
        src={node.avatar}
        alt={`${node.firstName} ${node.lastName}`}
        size="lg"
      />
      <Link
        href={`/employees/${node.id}`}
        className="mt-2 font-semibold text-slate-900 hover:text-cyan-600 text-center text-sm leading-tight"
      >
        {node.firstName} {node.lastName}
      </Link>
      {isCurrentUser && (
        <span className="text-[10px] text-cyan-600 font-medium uppercase tracking-wide">You</span>
      )}
      <p className="text-xs text-slate-600 text-center mt-1 font-medium">{node.position}</p>
      <p className="text-[11px] text-slate-400 text-center">{node.department}</p>

      {hasChildren && (
        <button
          onClick={onToggle}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors z-10"
        >
          {isExpanded ? (
            <MinusIcon className="h-3 w-3 text-slate-500" />
          ) : (
            <PlusIcon className="h-3 w-3 text-slate-500" />
          )}
        </button>
      )}
    </div>
  )
}

// Recursive tree node component
function TreeNode({
  node,
  currentEmployeeId,
  managerChainIds,
  directReportIds,
  expandedNodes,
  toggleNode,
  level = 0,
}: {
  node: OrgNode
  currentEmployeeId: string | null
  managerChainIds: string[]
  directReportIds: string[]
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
  level?: number
}) {
  const isCurrentUser = node.id === currentEmployeeId
  const isManager = managerChainIds.includes(node.id)
  const isDirectReport = directReportIds.includes(node.id)
  const hasChildren = node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  return (
    <div className="flex flex-col items-center">
      {/* Employee Card */}
      <EmployeeCard
        node={node}
        isCurrentUser={isCurrentUser}
        isManager={isManager}
        isDirectReport={isDirectReport}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => toggleNode(node.id)}
      />

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center mt-8">
          {/* Vertical line down from parent */}
          <div className="w-px h-6 bg-slate-300" />

          {/* Horizontal connector line */}
          {node.children.length > 1 && (
            <div
              className="h-px bg-slate-300"
              style={{
                width: `calc(${(node.children.length - 1) * 220}px)`,
                marginBottom: '-1px'
              }}
            />
          )}

          {/* Children row */}
          <div className="flex gap-5">
            {node.children.map((child, index) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-px h-6 bg-slate-300 mb-2" />
                <TreeNode
                  node={child}
                  currentEmployeeId={currentEmployeeId}
                  managerChainIds={managerChainIds}
                  directReportIds={directReportIds}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  level={level + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function OrgChart({ employees, currentEmployeeId, managerChainIds, directReportIds }: Props) {
  const tree = useMemo(() => buildTree(employees), [employees])
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  // Initialize expanded nodes - expand path to current user and first 2 levels
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>()

    // Always expand manager chain (path to current user)
    managerChainIds.forEach(id => initial.add(id))

    // Expand current user to show their direct reports
    if (currentEmployeeId) {
      initial.add(currentEmployeeId)
    }

    // Expand first 2 levels
    const expandLevel = (nodes: OrgNode[], level: number) => {
      if (level >= 2) return
      for (const node of nodes) {
        initial.add(node.id)
        expandLevel(node.children, level + 1)
      }
    }
    expandLevel(tree, 0)

    return initial
  })

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const allIds = new Set<string>()
    const collect = (nodes: OrgNode[]) => {
      for (const node of nodes) {
        allIds.add(node.id)
        collect(node.children)
      }
    }
    collect(tree)
    setExpandedNodes(allIds)
  }, [tree])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  // Scroll to current user on mount
  useEffect(() => {
    if (currentEmployeeId && chartRef.current && containerRef.current) {
      const timer = setTimeout(() => {
        const currentUserCard = chartRef.current?.querySelector(`[data-employee-id="${currentEmployeeId}"]`)
        if (currentUserCard && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect()
          const cardRect = currentUserCard.getBoundingClientRect()

          // Calculate scroll position to center the card
          const scrollLeft = cardRect.left - containerRect.left + containerRef.current.scrollLeft - (containerRect.width / 2) + (cardRect.width / 2)

          containerRef.current.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentEmployeeId])

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No employees found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-cyan-500 bg-cyan-50" />
            <span className="text-slate-600">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-blue-400 bg-blue-50" />
            <span className="text-slate-600">Your managers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-emerald-400 bg-emerald-50" />
            <span className="text-slate-600">Your direct reports</span>
          </div>
        </div>

        {/* Expand/Collapse buttons */}
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
          >
            <MinusIcon className="h-4 w-4" />
            Collapse All
          </button>
        </div>
      </div>

      {/* Scrollable chart container */}
      <div
        ref={containerRef}
        className="overflow-x-auto pb-8 -mx-6 px-6"
      >
        <div
          ref={chartRef}
          className="inline-flex flex-col items-center min-w-full py-6"
        >
          {/* Handle multiple roots (people without managers) */}
          {tree.length === 1 ? (
            <TreeNode
              node={tree[0]}
              currentEmployeeId={currentEmployeeId}
              managerChainIds={managerChainIds}
              directReportIds={directReportIds}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ) : (
            <div className="flex flex-col items-center">
              {/* Multiple roots - show them in a row */}
              <div className="flex gap-8 items-start">
                {tree.map((root) => (
                  <TreeNode
                    key={root.id}
                    node={root}
                    currentEmployeeId={currentEmployeeId}
                    managerChainIds={managerChainIds}
                    directReportIds={directReportIds}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hint for navigation */}
      <p className="text-xs text-slate-400 text-center">
        Scroll horizontally to see more • Click + or - on cards to expand/collapse
      </p>
    </div>
  )
}
