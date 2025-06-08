// Polyfill for Request/Response in Node.js environment
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// Simple Headers polyfill
if (!global.Headers) {
  global.Headers = class Headers {
    private headers: Record<string, string> = {}

    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = value
          })
        } else if (init instanceof Headers) {
          init.forEach((value, key) => {
            this.headers[key.toLowerCase()] = value
          })
        } else {
          Object.entries(init).forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = value
          })
        }
      }
    }

    get(name: string) {
      return this.headers[name.toLowerCase()] || null
    }

    set(name: string, value: string) {
      this.headers[name.toLowerCase()] = value
    }

    has(name: string) {
      return name.toLowerCase() in this.headers
    }

    forEach(callback: (value: string, key: string) => void) {
      Object.entries(this.headers).forEach(([key, value]) => {
        callback(value, key)
      })
    }
  } as any
}

// Request polyfill
if (!global.Request) {
  global.Request = class Request {
    url: string
    method: string
    headers: Headers
    body?: any
    
    constructor(input: string | Request, init?: RequestInit) {
      if (typeof input === 'string') {
        this.url = input
      } else {
        this.url = input.url
      }
      
      this.method = init?.method || 'GET'
      this.headers = new Headers(init?.headers)
      this.body = init?.body
    }
    
    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body)
      }
      return this.body
    }
    
    async text() {
      if (typeof this.body === 'string') {
        return this.body
      }
      return JSON.stringify(this.body)
    }
    
    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body
      })
    }
  } as any
}

// Response polyfill
if (!global.Response) {
  global.Response = class Response {
    body: any
    status: number
    statusText: string
    headers: Headers
    ok: boolean
    
    constructor(body?: any, init?: ResponseInit) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Headers(init?.headers)
      this.ok = this.status >= 200 && this.status < 300
    }
    
    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body)
      }
      return this.body
    }
    
    async text() {
      if (typeof this.body === 'string') {
        return this.body
      }
      return JSON.stringify(this.body)
    }
    
    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers
      })
    }
    
    static json(data: any, init?: ResponseInit) {
      const headers = new Headers(init?.headers)
      headers.set('content-type', 'application/json')
      
      return new Response(JSON.stringify(data), {
        ...init,
        headers
      })
    }
  } as any
}

// FormData polyfill
if (!global.FormData) {
  global.FormData = class FormData {
    private data: Record<string, any> = {}
    
    append(name: string, value: any) {
      this.data[name] = value
    }
    
    get(name: string) {
      return this.data[name]
    }
    
    has(name: string) {
      return name in this.data
    }
    
    set(name: string, value: any) {
      this.data[name] = value
    }
    
    delete(name: string) {
      delete this.data[name]
    }
    
    forEach(callback: (value: any, key: string) => void) {
      Object.entries(this.data).forEach(([key, value]) => {
        callback(value, key)
      })
    }
  } as any
}

// URL polyfill enhancements
if (!global.URL) {
  const { URL } = require('url')
  global.URL = URL
}

// URLSearchParams polyfill
if (!global.URLSearchParams) {
  const { URLSearchParams } = require('url')
  global.URLSearchParams = URLSearchParams
}

// Blob polyfill
if (!global.Blob) {
  global.Blob = class Blob {
    private parts: any[]
    private options: any
    
    constructor(parts?: any[], options?: any) {
      this.parts = parts || []
      this.options = options || {}
    }
    
    get size() {
      return this.parts.reduce((acc, part) => acc + part.length, 0)
    }
    
    get type() {
      return this.options.type || ''
    }
    
    async text() {
      return this.parts.join('')
    }
  } as any
}

// AbortController polyfill
if (!global.AbortController) {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      onabort: null,
    }
    
    abort() {
      this.signal.aborted = true
    }
  } as any
}

export {}