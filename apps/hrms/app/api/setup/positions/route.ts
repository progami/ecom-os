import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'

// One-time script to fix employee positions
// DELETE THIS FILE AFTER RUNNING

const POSITION_UPDATES = [
  { firstName: 'Hamad', position: 'Ops / Project Assistant' },
  { firstName: 'Mehdi', position: 'Project Manager' },
  { firstName: 'Zeeshan', position: 'Finance Assistant' },
  { firstName: 'Imran', position: 'Project Manager' },
]

export async function POST() {
  try {
    const results = []

    for (const update of POSITION_UPDATES) {
      const employee = await prisma.employee.findFirst({
        where: { firstName: update.firstName },
      })

      if (employee) {
        const updated = await prisma.employee.update({
          where: { id: employee.id },
          data: {
            position: update.position,
            positionLocalOverride: true, // Prevent Google sync from overwriting
          },
        })
        results.push({
          name: `${updated.firstName} ${updated.lastName}`,
          oldPosition: employee.position,
          newPosition: update.position,
          status: 'updated',
        })
      } else {
        results.push({
          name: update.firstName,
          status: 'not found',
        })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e) {
    console.error('Failed to update positions:', e)
    return NextResponse.json(
      { error: 'Failed to update positions', details: String(e) },
      { status: 500 }
    )
  }
}
