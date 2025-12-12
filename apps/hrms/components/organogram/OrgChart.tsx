'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { HierarchyEmployee } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { ChevronDownIcon, ChevronUpIcon } from '@/components/ui/Icons'

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

function OrgNode({
  node,
  currentEmployeeId,
  managerChainIds,
  directReportIds,
  level = 0,
}: {
  node: OrgNode
  currentEmployeeId: string | null
  managerChainIds: string[]
  directReportIds: string[]
  level?: number
}) {
  const [expanded, setExpanded] = useState(level < 2 || managerChainIds.includes(node.id) || node.id === currentEmployeeId)

  const isCurrentUser = node.id === currentEmployeeId
  const isManager = managerChainIds.includes(node.id)
  const isDirectReport = directReportIds.includes(node.id)
  const hasChildren = node.children.length > 0

  // Determine border/background color based on relationship
  let borderClass = 'border-slate-200'
  let bgClass = 'bg-white'

  if (isCurrentUser) {
    borderClass = 'border-cyan-500 border-2'
    bgClass = 'bg-cyan-50'
  } else if (isDirectReport) {
    borderClass = 'border-green-400'
    bgClass = 'bg-green-50'
  } else if (isManager) {
    borderClass = 'border-blue-400'
    bgClass = 'bg-blue-50'
  }

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${borderClass} ${bgClass} hover:shadow-sm transition-shadow`}>
        <Avatar
          src={node.avatar}
          alt={`${node.firstName} ${node.lastName}`}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/employees/${node.id}`}
            className="font-medium text-slate-900 hover:text-cyan-600 truncate block"
          >
            {node.firstName} {node.lastName}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-cyan-600 font-normal">(You)</span>
            )}
          </Link>
          <p className="text-sm text-slate-500 truncate">{node.position}</p>
          <p className="text-xs text-slate-400 truncate">{node.department}</p>
        </div>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
          >
            {expanded ? (
              <ChevronUpIcon className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-8" />}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-6 mt-2 pl-4 border-l-2 border-slate-200 space-y-2">
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              currentEmployeeId={currentEmployeeId}
              managerChainIds={managerChainIds}
              directReportIds={directReportIds}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgChart({ employees, currentEmployeeId, managerChainIds, directReportIds }: Props) {
  const tree = useMemo(() => buildTree(employees), [employees])

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No employees found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm mb-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-cyan-500 bg-cyan-50" />
          <span className="text-slate-600">You</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-blue-400 bg-blue-50" />
          <span className="text-slate-600">Your managers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-green-400 bg-green-50" />
          <span className="text-slate-600">Your direct reports</span>
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-3">
        {tree.map((root) => (
          <OrgNode
            key={root.id}
            node={root}
            currentEmployeeId={currentEmployeeId}
            managerChainIds={managerChainIds}
            directReportIds={directReportIds}
          />
        ))}
      </div>
    </div>
  )
}
