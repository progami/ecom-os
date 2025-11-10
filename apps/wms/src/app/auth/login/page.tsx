import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { portalOrigin } from '@/lib/portal'

type SearchParamsInput =
 | { callbackUrl?: string }
 | Promise<{ callbackUrl?: string } | undefined>
 | undefined

export default async function LoginPage({ searchParams }: { searchParams?: SearchParamsInput }) {
 const resolved = await Promise.resolve(searchParams)
 const desired = typeof resolved?.callbackUrl === 'string' && resolved.callbackUrl.trim().length > 0
 ? resolved.callbackUrl
 : '/dashboard'

 const session = await getServerSession(authOptions)
 if (session) {
 redirect(desired)
 }
 const portalAuth = portalOrigin()
 const resolvedAppBase = resolveAppBase()
 if (!resolvedAppBase) {
 throw new Error('Unable to determine WMS application base URL. Configure BASE_PATH or NEXT_PUBLIC_APP_URL.')
 }
const { baseUrl, basePath, originHostname } = resolvedAppBase

 if (originHostname === 'example.com') {
 throw new Error('Application origin is still example.com; configure production URLs in environment variables.')
 }
 const url = new URL('/login', portalAuth)
 // Pass back the full app URL users should land on after portal login
 if (desired.startsWith('http')) {
 url.searchParams.set('callbackUrl', desired)
 } else {
 url.searchParams.set('callbackUrl', buildCallback(baseUrl, basePath, desired))
 }
 redirect(url.toString())
}

function resolveAppBase(): { baseUrl: string; basePath: string; originHostname: string } | null {
 const normalizeBasePath = (value?: string | null) => {
 if (!value) return ''
 let normalized = value.trim()
 if (!normalized) return ''
 if (!normalized.startsWith('/')) {
 normalized = `/${normalized}`
 }
 if (normalized.length > 1 && normalized.endsWith('/')) {
 normalized = normalized.slice(0, -1)
 }
 return normalized
 }

 const parseUrl = (value?: string | null) => {
 if (!value) return null
 try {
 return new URL(value)
 } catch {
 return null
 }
 }

 const appUrlFromEnv = parseUrl(process.env.NEXT_PUBLIC_APP_URL)
 const portalUrl = parseUrl(process.env.PORTAL_AUTH_URL)

 const basePath =
 normalizeBasePath(process.env.BASE_PATH) ||
 normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH) ||
 normalizeBasePath(appUrlFromEnv?.pathname ?? '')

 const originUrl = appUrlFromEnv ?? portalUrl
 if (!originUrl) {
  throw new Error('NEXT_PUBLIC_APP_URL or PORTAL_AUTH_URL must be configured for WMS login redirect.')
 }

 const baseUrl = `${originUrl.origin}${basePath}`
 return { baseUrl, basePath, originHostname: originUrl.hostname }
}

function buildCallback(appBase: string, basePath: string, target: string): string {
 const cleanedBase = appBase.endsWith('/') ? appBase.slice(0, -1) : appBase
 if (target.startsWith('http://') || target.startsWith('https://')) {
 return target
 }
 const relative = target.startsWith('/') ? target : `/${target}`
 if (!basePath) {
 return `${cleanedBase}${relative}`
 }
 const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
 if (relative === normalizedBasePath) {
 return cleanedBase
 }
 if (relative.startsWith(`${normalizedBasePath}/`)) {
 const trimmed = relative.slice(normalizedBasePath.length)
 return `${cleanedBase}${trimmed}`
 }
 const trimmedRelative = relative.startsWith('/') ? relative.slice(1) : relative
 return `${cleanedBase}/${trimmedRelative}`
}
