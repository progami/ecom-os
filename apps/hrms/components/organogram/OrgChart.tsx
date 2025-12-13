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
  hasChildren,
  isExpanded,
  onToggle,
}: {
  node: OrgNode
  isCurrentUser: boolean
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`relative flex flex-col items-center rounded-xl border p-4 min-w-[180px] max-w-[200px] hover:shadow-lg transition-all duration-200 ${
        isCurrentUser
          ? 'border-cyan-500 border-2 bg-gradient-to-br from-cyan-50 to-white shadow-md shadow-cyan-100 ring-4 ring-cyan-100'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
      data-employee-id={node.id}
    >
      {/* "YOU" badge for current user */}
      {isCurrentUser && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
          You
        </div>
      )}

      <Avatar
        src={node.avatar}
        alt={`${node.firstName} ${node.lastName}`}
        size="lg"
        className={isCurrentUser ? 'ring-2 ring-cyan-400 ring-offset-2' : ''}
      />
      <Link
        href={`/employees/${node.id}`}
        className={`mt-2 font-semibold text-center text-sm leading-tight ${
          isCurrentUser ? 'text-cyan-700 hover:text-cyan-800' : 'text-slate-900 hover:text-cyan-600'
        }`}
      >
        {node.firstName} {node.lastName}
      </Link>
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
  expandedNodes,
  toggleNode,
}: {
  node: OrgNode
  currentEmployeeId: string | null
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
}) {
  const isCurrentUser = node.id === currentEmployeeId
  const hasChildren = node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  return (
    <div className="flex flex-col items-center">
      {/* Employee Card */}
      <EmployeeCard
        node={node}
        isCurrentUser={isCurrentUser}
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
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-px h-6 bg-slate-300 mb-2" />
                <TreeNode
                  node={child}
                  currentEmployeeId={currentEmployeeId}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
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
      <div className="flex items-center justify-end gap-2">
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

      {/* Chart container - no inner scroll, page scrolls */}
      <div
        ref={containerRef}
        className="pb-8 -mx-6 px-6"
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
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
