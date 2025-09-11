// Mock the logger module to prevent winston-related errors in JSDOM
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';

// Mock setImmediate for winston in JSDOM environment
if (typeof setImmediate === 'undefined') {
  global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => {
    return setTimeout(callback, 0, ...args);
  }) as any;
}

// Set up test environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}

// Configure React Testing Library
// Remove configuration that's not compatible with current version

// Mock performance.now() for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as any;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: any) {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Add TextEncoder/TextDecoder for Node environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Add Request/Response/Headers for Next.js API testing
if (typeof Request === 'undefined') {
  // Simple Request mock
  global.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    body: any;

    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString();
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }

    async json() {
      return JSON.parse(this.body);
    }
  } as any;

  // Simple Response mock
  global.Response = class Response {
    body: any;
    status: number;
    headers: Headers;

    constructor(body: any, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
    }

    async json() {
      return JSON.parse(this.body);
    }
  } as any;

  // Simple Headers mock
  global.Headers = class Headers {
    private headers: Map<string, string> = new Map();

    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.headers.set(key.toLowerCase(), value));
        } else if (init instanceof Headers) {
          init.forEach((value, key) => this.headers.set(key.toLowerCase(), value));
        } else {
          Object.entries(init).forEach(([key, value]) => this.headers.set(key.toLowerCase(), value));
        }
      }
    }

    set(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value);
    }

    get(key: string) {
      return this.headers.get(key.toLowerCase());
    }

    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => callback(value, key));
    }
  } as any;
}

// Mock HTMLElement.focus() if not available
if (!HTMLElement.prototype.focus) {
  HTMLElement.prototype.focus = jest.fn();
}

// Mock window.alert
global.alert = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: An update to') ||
       args[0].includes('act()'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Prisma Client is mocked via moduleNameMapper in jest.config.js

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ...jest.requireActual('lucide-react'),
  CalendarIcon: () => 'CalendarIcon',
  Loader2: () => 'Loader2',
  X: () => 'X',
  ChevronLeft: () => 'ChevronLeft',
  ChevronRight: () => 'ChevronRight',
  Search: () => 'Search',
  Check: () => 'Check',
  ChevronDown: () => 'ChevronDown',
  ChevronUp: () => 'ChevronUp',
  AlertCircle: () => 'AlertCircle',
  Info: () => 'Info',
}))

// Mock date-fns format function if needed
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: (date: Date, formatStr: string) => {
    // Simple implementation for tests
    if (!date) return '';
    if (formatStr === 'PPP') return date.toLocaleDateString();
    if (formatStr === 'P') return date.toLocaleDateString();
    return date.toISOString().split('T')[0];
  },
}))

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range ${min} - ${max}`
        : `expected ${received} to be within range ${min} - ${max}`,
    };
  },
});

// Add toBeWithinRange as a value matcher for expect
(expect as any).toBeWithinRange = (min: number, max: number) => {
  return {
    asymmetricMatch: (received: number) => received >= min && received <= max,
    toString: () => `toBeWithinRange(${min}, ${max})`,
  };
};