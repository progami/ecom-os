import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json(
    {
      error: 'Workbook export is temporarily disabled while we finalize the new template.',
    },
    { status: 410 }
  )
}
