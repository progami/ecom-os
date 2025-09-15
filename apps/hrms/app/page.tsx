import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold">HRMS</h1>
        <p className="text-muted-foreground">Fresh scaffold using Website brand colors and WMS layout patterns.</p>
        <Link href="/hrms" className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground">Enter HRMS</Link>
      </div>
    </div>
  )
}

