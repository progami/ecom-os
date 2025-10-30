import { buildPortalUrl, resolvePortalAuthOrigin } from '@ecom-os/auth'

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

