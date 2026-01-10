import 'server-only';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function extractFetchUrl(input: Parameters<typeof fetch>[0]): string | null {
  if (typeof input === 'string') return input;
  if (typeof URL === 'function' && input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input && typeof input.url === 'string') return input.url;
  return null;
}

export async function withFileUrlFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;

  if (typeof originalFetch !== 'function') {
    return fn();
  }

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = extractFetchUrl(input);
    if (url?.startsWith('file://')) {
      const filePath = fileURLToPath(new URL(url));
      const bytes = await readFile(filePath);
      return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/wasm' } });
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
