import type { ErrorCode } from '@uzuz/shared';

/** Empty string = same origin (dev proxy or server-served client). */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | 'NETWORK',
    message?: string,
    public details?: unknown
  ) {
    super(message ?? code);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK');
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: ErrorCode; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'INTERNAL'), e?.message, e?.details);
  }
  return data as T;
}

/** Turn a stored image path into a full URL when the API lives on another origin. */
export function assetUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/api/')) return `${API_BASE}${src}`;
  return src;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    sp.set(k, String(v === true ? 1 : v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
