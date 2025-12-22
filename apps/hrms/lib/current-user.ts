import { headers } from 'next/headers'
import { decodePortalSession, getCandidateSessionCookieNames, type PortalJwtPayload } from '@ecom-os/auth'
import { Prisma } from '@ecom-os/prisma-hrms'
import { prisma } from './prisma'

export type CurrentEmployee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  reportsToId: string | null
  avatar: string | null
}

export type CurrentUser = {
  session: PortalJwtPayload
  employee: CurrentEmployee | null
}

function splitNameFromSession(sessionName: string | undefined, email: string): { firstName: string; lastName: string } {
  const cleaned = (sessionName ?? '').trim()
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
    return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
  }

  const local = email.split('@')[0] ?? ''
  const guessed = local.split(/[._-]+/).filter(Boolean)
  if (guessed.length === 0) return { firstName: 'Employee', lastName: '' }
  if (guessed.length === 1) return { firstName: guessed[0]!, lastName: '' }
  return { firstName: guessed[0]!, lastName: guessed.slice(1).join(' ') }
}

async function getNextEmployeeId(): Promise<string> {
  const existing = await prisma.employee.findMany({
    where: { employeeId: { startsWith: 'EMP-' } },
    select: { employeeId: true },
  })

  let maxEmployeeNum = 0
  for (const emp of existing) {
    const match = emp.employeeId.match(/EMP-(\d+)/)
    if (!match) continue
    const num = Number.parseInt(match[1] ?? '', 10)
    if (!Number.isNaN(num) && num > maxEmployeeNum) {
      maxEmployeeNum = num
    }
  }

  const nextNum = maxEmployeeNum + 1
  return `EMP-${String(nextNum).padStart(3, '0')}`
}

async function ensureEmployeeProfile(session: PortalJwtPayload): Promise<CurrentEmployee | null> {
  const email = session.email?.trim().toLowerCase()
  if (!email) return null

  const existing = await prisma.employee.findUnique({
    where: { email },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      position: true,
      reportsToId: true,
      avatar: true,
    },
  })

  if (existing) return existing

  const employeeCount = await prisma.employee.count()
  const isBootstrap = employeeCount === 0
  const { firstName, lastName } = splitNameFromSession(session.name, email)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const employeeId = await getNextEmployeeId()
      const created = await prisma.employee.create({
        data: {
          employeeId,
          firstName,
          lastName,
          email,
          department: 'Unassigned',
          position: isBootstrap ? 'Super Admin' : 'Employee',
          joinDate: new Date(),
          permissionLevel: isBootstrap ? 100 : 0,
          isSuperAdmin: isBootstrap,
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
          reportsToId: true,
          avatar: true,
        },
      })

      return created
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const fetched = await prisma.employee.findUnique({
          where: { email },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            position: true,
            reportsToId: true,
            avatar: true,
          },
        })
        if (fetched) return fetched
        continue
      }
      throw error
    }
  }

  return null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const headersList = await headers()
  const cookieHeader = headersList.get('cookie')

  const cookieNames = Array.from(
    new Set([
      ...getCandidateSessionCookieNames('ecomos'),
      ...getCandidateSessionCookieNames('hrms'),
    ])
  )
  const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

  const session = await decodePortalSession({
    cookieHeader,
    cookieNames,
    secret: sharedSecret,
    appId: 'hrms',
  })

  if (!session?.email) {
    return null
  }

  const employee = await ensureEmployeeProfile(session)

  return {
    session,
    employee,
  }
}

export async function getCurrentEmployeeId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.employee?.id ?? null
}
