'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Project } from '@/lib/api-client'
import { Avatar } from '@/components/ui/avatar'
import { MinusIcon, PlusIcon, UsersIcon, FolderIcon } from '@/components/ui/Icons'

type Props = {
  projects: Project[]
}

// Status badge colors
const statusColors: Record<string, { bg: string; text: string }> = {
  PLANNING: { bg: 'bg-warning-100', text: 'text-warning-700' },
  ACTIVE: { bg: 'bg-success-100', text: 'text-success-700' },
  ON_HOLD: { bg: 'bg-muted', text: 'text-muted-foreground' },
  COMPLETED: { bg: 'bg-accent/10', text: 'text-accent' },
  CANCELLED: { bg: 'bg-danger-100', text: 'text-danger-700' },
}

// Project card component
function ProjectCard({
  project,
  hasMembers,
  isExpanded,
  onToggle,
  memberCount,
}: {
  project: Project
  hasMembers: boolean
  isExpanded: boolean
  onToggle: () => void
  memberCount: number
}) {
  const hasLead = !!project.lead
  const statusStyle = statusColors[project.status] ?? statusColors.ACTIVE

  return (
    <div
      className={`relative flex flex-col rounded-xl p-4 min-w-[220px] max-w-[260px] transition-all duration-200 ${
        hasLead
          ? 'border border-border bg-card shadow-sm hover:shadow-md'
          : 'border border-dashed border-input bg-muted/50'
      }`}
      data-project-id={project.id}
    >
      {/* Project Name */}
      <h3 className="font-semibold text-center leading-tight mb-1 text-foreground text-sm">
        {project.name}
      </h3>

      {/* Project Code */}
      {project.code && (
        <p className="text-[10px] text-muted-foreground text-center mb-2">{project.code}</p>
      )}

      {/* Status Badge */}
      <div className="flex justify-center mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      {/* Project Lead */}
      {project.lead ? (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <Avatar
            src={project.lead.avatar}
            alt={`${project.lead.firstName} ${project.lead.lastName}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/employees/${project.lead.id}`}
              className="text-xs font-semibold text-foreground hover:text-accent truncate block"
            >
              {project.lead.firstName} {project.lead.lastName}
            </Link>
            <p className="text-[10px] text-accent font-medium truncate">Lead</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 p-2 text-muted-foreground text-xs">
          <UsersIcon className="h-3.5 w-3.5" />
          <span>No lead assigned</span>
        </div>
      )}

      {/* Member count */}
      <div className="flex items-center justify-center gap-1 mt-2 text-[11px] text-muted-foreground">
        <UsersIcon className="h-3.5 w-3.5" />
        <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
      </div>

      {/* Expand/collapse button */}
      {hasMembers && (
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

// Member card component
function MemberCard({
  member,
}: {
  member: NonNullable<Project['members']>[number]
}) {
  return (
    <div className="flex flex-col items-center rounded-lg p-3 min-w-[140px] max-w-[160px] border border-border bg-card shadow-sm">
      <Avatar
        src={member.employee.avatar}
        alt={`${member.employee.firstName} ${member.employee.lastName}`}
        size="md"
      />
      <Link
        href={`/employees/${member.employee.id}`}
        className="mt-1.5 font-semibold text-center text-xs leading-tight text-foreground hover:text-accent"
      >
        {member.employee.firstName} {member.employee.lastName}
      </Link>
      <p className="text-[10px] text-accent font-medium text-center">{member.role || 'Member'}</p>
    </div>
  )
}

// Project node with members
function ProjectNode({
  project,
  expandedNodes,
  toggleNode,
}: {
  project: Project
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
}) {
  // Filter out the lead from members to avoid duplication
  const otherMembers = project.members?.filter(m => m.employee.id !== project.leadId) ?? []
  const hasOtherMembers = otherMembers.length > 0
  const isExpanded = expandedNodes.has(project.id)

  return (
    <div className="flex flex-col items-center">
      {/* Project Card */}
      <ProjectCard
        project={project}
        hasMembers={hasOtherMembers}
        isExpanded={isExpanded}
        onToggle={() => toggleNode(project.id)}
        memberCount={otherMembers.length}
      />

      {/* Members */}
      {hasOtherMembers && isExpanded && (
        <div className="flex flex-col items-center mt-10">
          {/* Vertical line down from project */}
          <div className="w-0.5 h-8 bg-gradient-to-b from-accent/50 to-border rounded-full" />

          {/* Horizontal connector line */}
          {otherMembers.length > 1 && (
            <div
              className="h-0.5 bg-border rounded-full"
              style={{
                width: `calc(${(otherMembers.length - 1) * 180}px)`,
                marginBottom: '-1px'
              }}
            />
          )}

          {/* Members row */}
          <div className="flex gap-4 flex-wrap justify-center">
            {otherMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center">
                {/* Vertical line to member */}
                <div className="w-0.5 h-8 bg-border rounded-full mb-2" />
                <MemberCard member={member} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ProjectOrgChart({ projects }: Props) {
  // Initialize expanded nodes - expand all by default since projects are flat
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const project of projects) {
      initial.add(project.id)
    }
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
    for (const project of projects) {
      allIds.add(project.id)
    }
    setExpandedNodes(allIds)
  }, [projects])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FolderIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">No projects found</p>
        <p className="text-sm mt-2 text-muted-foreground">Create projects and assign team members to see the organization structure.</p>
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
          {/* Projects grid */}
          <div className="flex flex-wrap gap-12 justify-center items-start">
            {projects.map((project) => (
              <ProjectNode
                key={project.id}
                project={project}
                expandedNodes={expandedNodes}
                toggleNode={toggleNode}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
