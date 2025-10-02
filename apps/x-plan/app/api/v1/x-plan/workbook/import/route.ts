import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json(
    {
      error: 'Workbook import is temporarily disabled while we finalize the new template.',
    },
    { status: 410 }
  )
}
