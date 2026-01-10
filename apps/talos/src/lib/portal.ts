import { buildPortalUrl, resolvePortalAuthOrigin } from '@targon/auth'

type RequestLike = {
 headers: Headers
 url: string
}

export function portalOrigin(request?: RequestLike, fallbackOrigin?: string) {
 return resolvePortalAuthOrigin({ request, fallbackOrigin })
}

export function portalUrl(path: string, request?: RequestLike, fallbackOrigin?: string) {
 return buildPortalUrl(path, { request, fallbackOrigin })
}

export function redirectToPortal(path: string, callbackUrl: string, request?: RequestLike, fallbackOrigin?: string) {
 const target = portalUrl(path, request, fallbackOrigin)
 target.searchParams.set('callbackUrl', callbackUrl)
 if (typeof window !== 'undefined') {
 window.location.href = target.toString()
 }
 return target.toString()
}
