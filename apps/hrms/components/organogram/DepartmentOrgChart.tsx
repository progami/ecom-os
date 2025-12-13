'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Department, HierarchyEmployee } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { MinusIcon, PlusIcon, UsersIcon } from '@/components/ui/Icons'

type DeptNode = Department & {
  childDepts: DeptNode[]
}

type Props = {
  departments: Department[]
  allEmployees: HierarchyEmployee[]
}

function buildDeptTree(departments: Department[]): DeptNode[] {
  const deptMap = new Map<string, DeptNode>()

  // Initialize all departments with empty children
  for (const dept of departments) {
    deptMap.set(dept.id, { ...dept, childDepts: [] })
  }

  const roots: DeptNode[] = []

  // Build tree by adding children to their parents
  for (const dept of departments) {
    const node = deptMap.get(dept.id)!
    if (dept.parentId && deptMap.has(dept.parentId)) {
      deptMap.get(dept.parentId)!.childDepts.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children alphabetically
  const sortChildren = (node: DeptNode) => {
    node.childDepts.sort((a, b) => a.name.localeCompare(b.name))
    node.childDepts.forEach(sortChildren)
  }

  roots.sort((a, b) => a.name.localeCompare(b.name))
  roots.forEach(sortChildren)

  return roots
}

// Department card component
function DepartmentCard({
  node,
  hasChildren,
  isExpanded,
  onToggle,
  employeeCount,
}: {
  node: DeptNode
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
  employeeCount: number
}) {
  // Color based on whether it has a head assigned
  const hasHead = !!node.head
  const borderClass = hasHead ? 'border-emerald-300' : 'border-amber-300'
  const bgClass = hasHead ? 'bg-gradient-to-br from-emerald-50 to-white' : 'bg-gradient-to-br from-amber-50 to-white'

  return (
    <div
      className={`relative flex flex-col rounded-xl border ${borderClass} ${bgClass} shadow-sm p-4 min-w-[200px] max-w-[240px] hover:shadow-lg transition-all duration-200`}
      data-department-id={node.id}
    >
      {/* Department Name */}
      <h3 className="font-semibold text-slate-900 text-center text-sm leading-tight mb-2">
        {node.name}
      </h3>

      {/* KPI */}
      {node.kpi && (
        <div className="text-xs text-slate-500 text-center mb-3 px-2">
          <span className="font-medium text-slate-600">KPI:</span> {node.kpi}
        </div>
      )}

      {/* Department Head */}
      {node.head ? (
        <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
          <Avatar
            src={node.head.avatar}
            alt={`${node.head.firstName} ${node.head.lastName}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/employees/${node.head.id}`}
              className="text-sm font-medium text-slate-900 hover:text-cyan-600 truncate block"
            >
              {node.head.firstName} {node.head.lastName}
            </Link>
            <p className="text-xs text-slate-500 truncate">{node.head.position}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-2 bg-amber-100/50 rounded-lg">
          <span className="text-xs text-amber-700 font-medium">No head assigned</span>
        </div>
      )}

      {/* Employee count */}
      <div className="flex items-center justify-center gap-1 mt-2 text-xs text-slate-500">
        <UsersIcon className="h-3.5 w-3.5" />
        <span>{employeeCount} {employeeCount === 1 ? 'employee' : 'employees'}</span>
      </div>

      {/* Expand/collapse button */}
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
function DeptTreeNode({
  node,
  expandedNodes,
  toggleNode,
  employeeCounts,
  level = 0,
}: {
  node: DeptNode
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
  employeeCounts: Map<string, number>
  level?: number
}) {
  const hasChildren = node.childDepts.length > 0
  const isExpanded = expandedNodes.has(node.id)
  const employeeCount = employeeCounts.get(node.id) || 0

  return (
    <div className="flex flex-col items-center">
      {/* Department Card */}
      <DepartmentCard
        node={node}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => toggleNode(node.id)}
        employeeCount={employeeCount}
      />

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center mt-8">
          {/* Vertical line down from parent */}
          <div className="w-px h-6 bg-slate-300" />

          {/* Horizontal connector line */}
          {node.childDepts.length > 1 && (
            <div
              className="h-px bg-slate-300"
              style={{
                width: `calc(${(node.childDepts.length - 1) * 260}px)`,
                marginBottom: '-1px'
              }}
            />
          )}

          {/* Children row */}
          <div className="flex gap-5">
            {node.childDepts.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-px h-6 bg-slate-300 mb-2" />
                <DeptTreeNode
                  node={child}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  employeeCounts={employeeCounts}
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

export function DepartmentOrgChart({ departments, allEmployees }: Props) {
  const tree = useMemo(() => buildDeptTree(departments), [departments])

  // Count employees per department
  const employeeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const dept of departments) {
      const count = allEmployees.filter(emp => emp.department === dept.name).length
      counts.set(dept.id, count)
    }
    return counts
  }, [departments, allEmployees])

  // Initialize expanded nodes - expand first 2 levels
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const expandLevel = (nodes: DeptNode[], level: number) => {
      if (level >= 2) return
      for (const node of nodes) {
        initial.add(node.id)
        expandLevel(node.childDepts, level + 1)
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
    const collect = (nodes: DeptNode[]) => {
      for (const node of nodes) {
        allIds.add(node.id)
        collect(node.childDepts)
      }
    }
    collect(tree)
    setExpandedNodes(allIds)
  }, [tree])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  if (departments.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No departments found</p>
        <p className="text-sm mt-2">Create departments and assign heads to see the organization structure.</p>
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
            <div className="w-4 h-4 rounded border border-emerald-300 bg-emerald-50" />
            <span className="text-slate-600">Has department head</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-amber-300 bg-amber-50" />
            <span className="text-slate-600">No head assigned</span>
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
      <div className="overflow-x-auto pb-8 -mx-6 px-6">
        <div className="inline-flex flex-col items-center min-w-full py-6">
          {/* Handle multiple roots */}
          {tree.length === 1 ? (
            <DeptTreeNode
              node={tree[0]}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              employeeCounts={employeeCounts}
            />
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex gap-8 items-start">
                {tree.map((root) => (
                  <DeptTreeNode
                    key={root.id}
                    node={root}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                    employeeCounts={employeeCounts}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-slate-400 text-center">
        Scroll horizontally to see more • Click + or - on cards to expand/collapse
      </p>
    </div>
  )
}
