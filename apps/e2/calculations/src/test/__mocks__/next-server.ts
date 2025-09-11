// Mock for Next.js server APIs
const INTERNALS = Symbol.for('NextRequest.internal');
export { INTERNALS };

export class NextRequest extends Request {
  // Symbol property will be set in constructor
  [key: symbol]: any;
  
  nextUrl: {
    searchParams: URLSearchParams;
    pathname: string;
    href: string;
  };
  cookies: {
    get: (name: string) => { value?: string } | undefined;
    set: (name: string, value: string) => void;
    delete: (name: string) => void;
  };
  geo?: {
    city?: string;
    country?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
  };
  ip?: string;
  page?: any;
  ua?: {
    browser?: { name?: string; version?: string };
    engine?: { name?: string; version?: string };
    os?: { name?: string; version?: string };
    device?: { vendor?: string; model?: string; type?: string };
    cpu?: { architecture?: string };
    isBot?: boolean;
  };

  constructor(input: string | URL | Request, init?: RequestInit) {
    super(input, init);
    const url = new URL(
      typeof input === 'string' ? input : 
      input instanceof URL ? input.href : 
      (input as Request).url
    );
    this.nextUrl = {
      searchParams: url.searchParams,
      pathname: url.pathname,
      href: url.href,
    };
    
    // Mock cookies
    const cookieStore = new Map<string, string>();
    this.cookies = {
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { value } : undefined;
      },
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      }
    };
    
    // Mock user agent
    this.ua = {
      browser: { name: 'Chrome', version: '120.0.0' },
      engine: { name: 'Blink', version: '120.0.0' },
      os: { name: 'macOS', version: '14.0' },
      device: {},
      cpu: { architecture: 'amd64' },
      isBot: false
    };
    
    // Set internals using the symbol
    (this as any)[Symbol.for('NextRequest.internal')] = {};
    
    // Mock geo and ip
    this.geo = {};
    this.ip = '127.0.0.1';
  }
}

export class NextResponse extends Response {
  static json(data: any, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
  }
}