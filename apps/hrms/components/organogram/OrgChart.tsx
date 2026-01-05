'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { HierarchyEmployee } from '@/lib/api-client'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
          ? 'border-accent border-2 bg-gradient-to-br from-accent/5 to-card shadow-md shadow-accent/10 ring-4 ring-accent/10'
          : 'border-border bg-card shadow-sm'
      }`}
      data-employee-id={node.id}
    >
      {/* "YOU" badge for current user */}
      {isCurrentUser && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
          You
        </div>
      )}

      <Avatar
        src={node.avatar}
        alt={`${node.firstName} ${node.lastName}`}
        size="lg"
        className={isCurrentUser ? 'ring-2 ring-accent ring-offset-2' : ''}
      />
      <Link
        href={`/employees/${node.id}`}
        className={`mt-2 font-semibold text-center text-sm leading-tight ${
          isCurrentUser ? 'text-accent hover:text-primary' : 'text-foreground hover:text-accent'
        }`}
      >
        {node.firstName} {node.lastName}
      </Link>
      <p className="text-xs text-muted-foreground text-center mt-1 font-medium">{node.position}</p>
      <p className="text-[11px] text-muted-foreground text-center">{node.department}</p>

      {hasChildren && (
        <button
          onClick={onToggle}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/50 hover:border-input transition-colors z-10"
        >
          {isExpanded ? (
            <MinusIcon className="h-3 w-3 text-muted-foreground" />
          ) : (
            <PlusIcon className="h-3 w-3 text-muted-foreground" />
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
          <div className="w-px h-6 bg-border" />

          {/* Horizontal connector line */}
          {node.children.length > 1 && (
            <div
              className="h-px bg-border"
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
                <div className="w-px h-6 bg-border mb-2" />
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
      <div className="text-center py-12 text-muted-foreground">
        No employees found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          <PlusIcon className="h-4 w-4" />
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          <MinusIcon className="h-4 w-4" />
          Collapse All
        </Button>
      </div>

      {/* Chart container - horizontal scroll for overflow */}
      <div
        ref={containerRef}
        className="pb-8 overflow-x-auto"
      >
        <div
          ref={chartRef}
          className="flex justify-center min-w-fit py-6 px-8"
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
            <div className="flex flex-wrap justify-center gap-12 items-start">
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
          )}
        </div>
      </div>
    </div>
  )
}
