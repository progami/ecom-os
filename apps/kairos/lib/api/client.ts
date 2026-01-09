import { withAppBasePath } from '@/lib/base-path';

type ApiErrorPayload = {
  error?: unknown;
};

function errorMessageFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as ApiErrorPayload;
  if (typeof rec.error === 'string' && rec.error.trim()) return rec.error;
  return null;
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function fetchJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  if (!path.startsWith('/')) {
    throw new Error('fetchJson expects an absolute path starting with "/"');
  }

  const response = await fetch(withAppBasePath(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...init?.headers,
    },
  });

  const payload = await readJsonSafely(response);

  if (!response.ok) {
    const message = errorMessageFromPayload(payload) ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as TResponse;
}

