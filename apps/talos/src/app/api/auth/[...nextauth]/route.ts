import { handlers } from '@/lib/auth'

// Force dynamic rendering - prevents Next.js from prerendering as static 404
export const dynamic = 'force-dynamic'

export const { GET, POST } = handlers
