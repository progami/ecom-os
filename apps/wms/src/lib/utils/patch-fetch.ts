const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''

function shouldPrefix(input: RequestInfo | URL): input is string {
  return typeof input === 'string' && input.startsWith('/api/')
}

function prefixPath(path: string): string {
  if (!BASE_PATH) return path
  const normalizedBase = BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}`
  return `${normalizedBase}${path}`
}

function patchGlobalFetch() {
  if (!BASE_PATH) return
  if (typeof globalThis.fetch !== 'function') return
  const originalFetch = globalThis.fetch

  if ((originalFetch as any).__withBasePath) {
    return
  }

  const patched = function (input: RequestInfo | URL, init?: RequestInit) {
    if (shouldPrefix(input)) {
      input = prefixPath(input)
    } else if (input instanceof URL) {
      if (BASE_PATH && input.pathname.startsWith('/api/')) {
        input = new URL(prefixPath(input.pathname) + input.search + input.hash, input.origin)
      }
    }
    return originalFetch.call(this, input, init)
  } as typeof globalThis.fetch & { __withBasePath?: boolean }

  patched.__withBasePath = true
  globalThis.fetch = patched
}

patchGlobalFetch()

export {}
