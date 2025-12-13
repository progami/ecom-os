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
  isRoot,
}: {
  node: DeptNode
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
  employeeCount: number
  isRoot?: boolean
}) {
  const hasHead = !!node.head

  // Different styling for root vs child departments
  const cardStyles = isRoot
    ? 'border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 via-white to-slate-50 shadow-lg shadow-cyan-100/50'
    : hasHead
      ? 'border border-slate-200 bg-white shadow-md hover:shadow-lg hover:border-slate-300'
      : 'border border-dashed border-amber-300 bg-gradient-to-br from-amber-50/50 to-white shadow-sm'

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-5 min-w-[220px] max-w-[260px] transition-all duration-300 ${cardStyles}`}
      data-department-id={node.id}
    >
      {/* Department Name */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isRoot ? 'bg-cyan-500' : hasHead ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <h3 className={`font-bold text-center leading-tight ${isRoot ? 'text-cyan-900 text-base' : 'text-slate-800 text-sm'}`}>
          {node.name}
        </h3>
      </div>

      {/* KPI Badge */}
      {node.kpi && (
        <div className="flex justify-center mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
            {node.kpi}
          </span>
        </div>
      )}

      {/* Department Head */}
      {node.head ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <Avatar
            src={node.head.avatar}
            alt={`${node.head.firstName} ${node.head.lastName}`}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/employees/${node.head.id}`}
              className="text-sm font-semibold text-slate-900 hover:text-cyan-600 truncate block transition-colors"
            >
              {node.head.firstName} {node.head.lastName}
            </Link>
            <p className="text-xs text-slate-500 truncate mt-0.5">{node.head.position}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <UsersIcon className="h-4 w-4 text-amber-500" />
          </div>
          <span className="text-xs text-amber-700 font-medium">No head assigned</span>
        </div>
      )}

      {/* Employee count */}
      <div className="flex items-center justify-center gap-1.5 mt-3 py-2 px-3 bg-slate-50 rounded-lg">
        <UsersIcon className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-600">
          {employeeCount} {employeeCount === 1 ? 'member' : 'members'}
        </span>
      </div>

      {/* Expand/collapse button */}
      {hasChildren && (
        <button
          onClick={onToggle}
          className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 shadow-md flex items-center justify-center hover:scale-110 transition-all duration-200 z-10 ${
            isExpanded ? 'border-cyan-400 text-cyan-600' : 'border-slate-300 text-slate-500 hover:border-cyan-400 hover:text-cyan-600'
          }`}
        >
          {isExpanded ? (
            <MinusIcon className="h-4 w-4" />
          ) : (
            <PlusIcon className="h-4 w-4" />
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
  const isRoot = level === 0

  return (
    <div className="flex flex-col items-center">
      {/* Department Card */}
      <DepartmentCard
        node={node}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => toggleNode(node.id)}
        employeeCount={employeeCount}
        isRoot={isRoot}
      />

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center mt-10">
          {/* Vertical line down from parent */}
          <div className="w-0.5 h-8 bg-gradient-to-b from-cyan-300 to-slate-300 rounded-full" />

          {/* Horizontal connector line */}
          {node.childDepts.length > 1 && (
            <div
              className="h-0.5 bg-slate-300 rounded-full"
              style={{
                width: `calc(${(node.childDepts.length - 1) * 280}px)`,
                marginBottom: '-1px'
              }}
            />
          )}

          {/* Children row */}
          <div className="flex gap-6">
            {node.childDepts.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-0.5 h-8 bg-slate-300 rounded-full mb-2" />
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <UsersIcon className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-medium text-slate-700">No departments found</p>
        <p className="text-sm mt-2 text-slate-500">Create departments and assign heads to see the organization structure.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
        {/* Legend */}
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-slate-600 font-medium">Root Department</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Has Head</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-slate-600 font-medium">No Head</span>
          </div>
        </div>

        {/* Expand/Collapse buttons */}
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-all duration-200 flex items-center gap-2 border border-transparent hover:border-cyan-200"
          >
            <PlusIcon className="h-4 w-4" />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200 flex items-center gap-2 border border-transparent hover:border-slate-200"
          >
            <MinusIcon className="h-4 w-4" />
            Collapse All
          </button>
        </div>
      </div>

      {/* Scrollable chart container */}
      <div className="overflow-x-auto pb-8 -mx-6 px-6">
        <div className="inline-flex flex-col items-center min-w-full py-8">
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
              <div className="flex gap-10 items-start">
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
      <p className="text-xs text-slate-400 text-center pt-2">
        Scroll horizontally to see more • Click + or - buttons to expand/collapse departments
      </p>
    </div>
  )
}
