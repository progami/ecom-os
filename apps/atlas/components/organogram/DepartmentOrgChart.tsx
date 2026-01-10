'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Department } from '@/lib/api-client'
import { Avatar } from '@/components/ui/avatar'
import { MinusIcon, PlusIcon, UsersIcon } from '@/components/ui/Icons'

type DeptNode = Department & {
  childDepts: DeptNode[]
}

type Props = {
  departments: Department[]
}

function formatEmploymentType(value: string | null | undefined): string {
  switch (value) {
    case 'FULL_TIME':
      return 'Full-time'
    case 'PART_TIME':
      return 'Part-time'
    case 'CONTRACT':
      return 'Contract'
    case 'INTERN':
      return 'Intern'
    case 'WORKING_PARTNER':
      return 'Working partner'
    default:
      return value ? value.replace(/_/g, ' ').toLowerCase() : ''
  }
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
          ? 'border-2 border-accent bg-gradient-to-br from-accent/5 to-card shadow-md'
          : hasHead
            ? 'border border-border bg-card shadow-sm hover:shadow-md'
            : 'border border-dashed border-input bg-muted/50'
      }`}
      data-department-id={node.id}
    >
      {/* Department Name */}
      <h3 className={`font-semibold text-center leading-tight mb-2 ${isRoot ? 'text-primary text-sm' : 'text-foreground text-xs'}`}>
        {node.name}
      </h3>

      {/* Department Head */}
      {node.head ? (
        <Link
          href={`/employees/${node.head.id}`}
          className="flex items-center gap-2 p-1.5 bg-accent/5 rounded-md border border-accent/20 mb-1.5 hover:bg-accent/10 transition-colors"
        >
          <Avatar
            src={node.head.avatar}
            alt={`${node.head.firstName} ${node.head.lastName}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground truncate">
              {node.head.firstName} {node.head.lastName}
            </p>
            <p className="text-[9px] text-accent font-medium truncate">
              Head{node.head.employmentType ? ` • ${formatEmploymentType(node.head.employmentType)}` : ''}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex items-center justify-center gap-1 p-1.5 text-muted-foreground text-[10px] mb-1.5">
          <UsersIcon className="h-3 w-3" />
          <span>No head</span>
        </div>
      )}

      {/* Team Members - compact list */}
      {otherMembers.length > 0 && (
        <div className="border-t border-border pt-1.5 mt-1">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Members</p>
          <div className="space-y-0.5">
            {otherMembers.map((emp) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                className="flex items-center gap-1.5 p-1 rounded hover:bg-muted/50 transition-colors group"
              >
                <Avatar
                  src={emp.avatar}
                  alt={`${emp.firstName} ${emp.lastName}`}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-foreground group-hover:text-accent truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-[8px] text-muted-foreground truncate">
                    {emp.position}{emp.employmentType ? ` • ${formatEmploymentType(emp.employmentType)}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {members.length === 0 && !node.head && (
        <p className="text-[9px] text-muted-foreground text-center py-1">No members</p>
      )}

      {/* Expand/collapse button */}
      {hasChildren && (
        <button
          onClick={onToggle}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/50 hover:border-input transition-colors z-10"
        >
          {isExpanded ? (
            <MinusIcon className="h-2.5 w-2.5 text-muted-foreground" />
          ) : (
            <PlusIcon className="h-2.5 w-2.5 text-muted-foreground" />
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
          <div className="w-0.5 h-8 bg-gradient-to-b from-accent/50 to-border rounded-full" />

          {/* Horizontal connector line */}
          {node.childDepts.length > 1 && (
            <div
              className="h-0.5 bg-border rounded-full"
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
                <div className="w-0.5 h-8 bg-border rounded-full mb-2" />
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
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <UsersIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">No departments found</p>
        <p className="text-sm mt-2 text-muted-foreground">Create departments and assign heads to see the organization structure.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={expandAll}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1"
        >
          <PlusIcon className="h-4 w-4" />
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1"
        >
          <MinusIcon className="h-4 w-4" />
          Collapse All
        </button>
      </div>

      {/* Chart container - horizontal scroll for overflow */}
      <div className="pb-8 overflow-x-auto">
        <div className="flex justify-center min-w-fit py-6 px-8">
          {/* Handle multiple roots */}
          {tree.length === 1 ? (
            <DeptTreeNode
              node={tree[0]}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ) : (
            <div className="flex flex-wrap justify-center gap-12 items-start">
              {tree.map((root) => (
                <DeptTreeNode
                  key={root.id}
                  node={root}
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
