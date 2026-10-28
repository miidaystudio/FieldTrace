/**
 * Minimal HTTP client for the FieldTrace API.
 *
 * - Access token lives in memory only (never localStorage).
 * - The refresh token is an httpOnly cookie; every request uses `credentials: 'include'`.
 * - On `401 TOKEN_EXPIRED` the client refreshes ONCE (single-flight, shared by all callers)
 *   and retries — parallel refreshes would look like token theft to the backend.
 */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
export const API_PREFIX = `${API_BASE}/api/v1`;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  // Shapes are defined in backend.ts; kept loose here to avoid a circular import.
  user: unknown;
  organization: unknown;
}

let accessToken: string | null = null;
let refreshInFlight: Promise<SessionPayload | null> | null = null;
const sessionListeners = new Set<(session: SessionPayload | null) => void>();

export const getAccessToken = () => accessToken;

export function setSession(session: SessionPayload | null): void {
  accessToken = session?.accessToken ?? null;
  sessionListeners.forEach((listener) => listener(session));
}

/** Notified whenever the session is (re)issued or lost (refresh, login, logout, expiry). */
export function onSessionChange(listener: (session: SessionPayload | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Attach the access token (default true). */
  auth?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_PREFIX}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function parse<T>(res: Response): Promise<{ data: T; meta?: PageMeta }> {
  if (res.status === 204) return { data: undefined as T };
  const json = (await res.json().catch(() => null)) as
    | { data?: T; meta?: PageMeta; error?: { code: string; message: string; details?: unknown } }
    | null;
  if (!res.ok) {
    const error = json?.error;
    throw new ApiError(res.status, error?.code ?? 'HTTP_ERROR', error?.message ?? res.statusText, error?.details);
  }
  return { data: json?.data as T, meta: json?.meta };
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST', auth: false });
      const { data } = await parse<SessionPayload>(res);
      setSession(data);
      return data;
    } catch {
      setSession(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: PageMeta }> {
  let res = await send(path, options);
  if (res.status === 401 && options.auth !== false) {
    const body = (await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === 'TOKEN_EXPIRED' && (await refreshSession())) {
      res = await send(path, options);
    } else if (body?.error?.code !== 'TOKEN_EXPIRED') {
      // Session revoked / account deactivated: drop local auth state.
      setSession(null);
    }
  }
  return parse<T>(res);
}

export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await request<T>(path, options)).data;
}

/** Downloads a file (e.g. CSV) with the same auth/refresh handling as JSON calls. */
export async function apiDownload(
  path: string,
  query?: Query,
): Promise<{ blob: Blob; filename: string | null }> {
  let res = await send(path, { query });
  if (res.status === 401) {
    const body = (await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === 'TOKEN_EXPIRED' && (await refreshSession())) res = await send(path, { query });
  }
  if (!res.ok) await parse(res); // throws ApiError with the server's message
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? null;
  return { blob: await res.blob(), filename };
}

export async function apiPage<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ data: T[]; meta: PageMeta }> {
  const result = await request<T[]>(path, options);
  return {
    data: result.data ?? [],
    meta: result.meta ?? { page: 1, limit: result.data?.length ?? 0, total: result.data?.length ?? 0, totalPages: 1 },
  };
}

/** Loads every page of a paginated list (bounded by `maxPages`). */
export async function apiAll<T>(path: string, query: Query = {}, maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, meta } = await apiPage<T>(path, { query: { ...query, page, limit: 100 } });
    items.push(...data);
    if (page >= meta.totalPages) break;
  }
  return items;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
