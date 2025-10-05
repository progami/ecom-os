import { getBasePath } from '@/lib/utils/base-path'

const BASE_PATH = getBasePath()

function shouldPrefix(input: RequestInfo | URL): input is string {
  return typeof input === 'string' && input.startsWith('/api/')
}

function prefixPath(path: string): string {
  if (!BASE_PATH) return path
  const normalizedBase = BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}`
  return `${normalizedBase}${path}`
}

type FetchWithBasePath = typeof globalThis.fetch & {
  __withBasePath?: boolean
}

function patchGlobalFetch() {
  if (!BASE_PATH) return
  if (typeof globalThis.fetch !== 'function') return

  const originalFetch = globalThis.fetch as FetchWithBasePath
  if (originalFetch.__withBasePath) {
    return
  }

  const patched: FetchWithBasePath = ((input: RequestInfo | URL, init?: RequestInit) => {
    let requestInput = input
    if (shouldPrefix(requestInput)) {
      requestInput = prefixPath(requestInput)
    } else if (requestInput instanceof URL && requestInput.pathname.startsWith('/api/')) {
      requestInput = new URL(
        prefixPath(requestInput.pathname) + requestInput.search + requestInput.hash,
        requestInput.origin
      )
    }
    return originalFetch.call(this, requestInput, init)
  }) as FetchWithBasePath

  patched.__withBasePath = true
  globalThis.fetch = patched
}

patchGlobalFetch()

export {}
