/**
 * Single entry point for talking to the RinseOps API. All requests go to the
 * same origin (/api/v1, proxied by Next.js) so the HttpOnly session cookie is sent.
 */
export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level validation messages, keyed by dotted path. */
  get fields(): Record<string, string> {
    const fields = (this.details as { fields?: Record<string, string> } | undefined)?.fields;
    return fields ?? {};
  }
}

const FRIENDLY_FALLBACK: Record<number, string> = {
  401: 'Please sign in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
};

type Body = Record<string, unknown> | unknown[] | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Body;
  signal?: AbortSignal;
  /** Do not redirect to /login on 401 (used by the session bootstrap). */
  noAuthRedirect?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, noAuthRedirect } = options;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError("We couldn't reach the server. Check your connection and try again.", 0, 'NETWORK_ERROR');
  }

  if (res.status === 401 && !noAuthRedirect && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // Hard navigation on purpose: drops all cached data from the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${next}`;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    const message = error?.message ?? FRIENDLY_FALLBACK[res.status] ?? FRIENDLY_FALLBACK[500]!;
    throw new ApiError(message, res.status, error?.code ?? `HTTP_${res.status}`, error?.details);
  }
  return payload as T;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const apiPost = <T>(path: string, body?: Body) => api<T>(path, { method: 'POST', body: body ?? {} });
export const apiPatch = <T>(path: string, body: Body) => api<T>(path, { method: 'PATCH', body });
export const apiPut = <T>(path: string, body: Body) => api<T>(path, { method: 'PUT', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return fallback;
  return fallback;
}
