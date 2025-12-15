'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Department } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { MinusIcon, PlusIcon, UsersIcon } from '@/components/ui/Icons'

type DeptNode = Department & {
  childDepts: DeptNode[]
}

type Props = {
  departments: Department[]
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
  isRoot,
}: {
  node: DeptNode
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
  isRoot?: boolean
}) {
  const hasHead = !!node.head
  const members = node.employees || []
  // Filter out the head from members list to avoid duplication
  const otherMembers = members.filter(emp => emp.id !== node.headId)

  return (
    <div
      className={`relative flex flex-col rounded-lg p-3 min-w-[180px] max-w-[200px] transition-all duration-200 ${
        isRoot
          ? 'border-2 border-cyan-500 bg-gradient-to-br from-cyan-50 to-white shadow-md'
          : hasHead
            ? 'border border-slate-200 bg-white shadow-sm hover:shadow-md'
            : 'border border-dashed border-slate-300 bg-slate-50'
      }`}
      data-department-id={node.id}
    >
      {/* Department Name */}
      <h3 className={`font-semibold text-center leading-tight mb-2 ${isRoot ? 'text-cyan-900 text-sm' : 'text-slate-800 text-xs'}`}>
        {node.name}
      </h3>

      {/* Department Head */}
      {node.head ? (
        <Link
          href={`/employees/${node.head.id}`}
          className="flex items-center gap-2 p-1.5 bg-cyan-50 rounded-md border border-cyan-100 mb-1.5 hover:bg-cyan-100 transition-colors"
        >
          <Avatar
            src={node.head.avatar}
            alt={`${node.head.firstName} ${node.head.lastName}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-900 truncate">
              {node.head.firstName} {node.head.lastName}
            </p>
            <p className="text-[9px] text-cyan-600 font-medium truncate">Head</p>
          </div>
        </Link>
      ) : (
        <div className="flex items-center justify-center gap-1 p-1.5 text-slate-400 text-[10px] mb-1.5">
          <UsersIcon className="h-3 w-3" />
          <span>No head</span>
        </div>
      )}

      {/* Team Members - compact list */}
      {otherMembers.length > 0 && (
        <div className="border-t border-slate-100 pt-1.5 mt-1">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-1">Members</p>
          <div className="space-y-0.5">
            {otherMembers.map((emp) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 transition-colors group"
              >
                <Avatar
                  src={emp.avatar}
                  alt={`${emp.firstName} ${emp.lastName}`}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-slate-700 group-hover:text-cyan-600 truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-[8px] text-slate-400 truncate">{emp.position}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {members.length === 0 && !node.head && (
        <p className="text-[9px] text-slate-400 text-center py-1">No members</p>
      )}

      {/* Expand/collapse button */}
      {hasChildren && (
        <button
          onClick={onToggle}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors z-10"
        >
          {isExpanded ? (
            <MinusIcon className="h-2.5 w-2.5 text-slate-500" />
          ) : (
            <PlusIcon className="h-2.5 w-2.5 text-slate-500" />
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
  level = 0,
}: {
  node: DeptNode
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
  level?: number
}) {
  const hasChildren = node.childDepts.length > 0
  const isExpanded = expandedNodes.has(node.id)
  const isRoot = level === 0

  return (
    <div className="flex flex-col items-center">
      {/* Department Card */}
      <DepartmentCard
        node={node}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => toggleNode(node.id)}
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
                width: `calc(${(node.childDepts.length - 1) * 220}px)`,
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

export function DepartmentOrgChart({ departments }: Props) {
  const tree = useMemo(() => buildDeptTree(departments), [departments])

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
      <div className="pb-8 -mx-6 px-6">
        <div className="inline-flex flex-col items-center min-w-full py-6">
          {/* Handle multiple roots */}
          {tree.length === 1 ? (
            <DeptTreeNode
              node={tree[0]}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
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
