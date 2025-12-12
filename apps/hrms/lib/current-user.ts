import { headers } from 'next/headers'
import { decodePortalSession, type PortalJwtPayload } from '@ecom-os/auth'
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const headersList = await headers()
  const cookieHeader = headersList.get('cookie')

  const session = await decodePortalSession({
    cookieHeader,
    appId: 'hrms',
  })

  if (!session?.email) {
    return null
  }

  const employee = await prisma.employee.findUnique({
    where: { email: session.email.toLowerCase() },
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

  return {
    session,
    employee,
  }
}

export async function getCurrentEmployeeId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.employee?.id ?? null
}
