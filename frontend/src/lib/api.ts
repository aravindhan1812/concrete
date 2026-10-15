/** Minimal API client with persisted tokens and automatic refresh-on-401. */
const BASE = '/api/v1';
const STORAGE_KEY = 'concrete.session';

export interface SessionUser {
  id: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  /** staff = company user; client / vendor = portal login scoped to that record. */
  kind?: 'staff' | 'client' | 'vendor';
  clientId?: string;
  vendorId?: string;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

let session: StoredSession | null = load();

function load(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}
function persist() {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — session lives in memory only */
  }
}

export function setSession(next: StoredSession) {
  session = next;
  persist();
}
export function clearSession() {
  session = null;
  persist();
}
export function currentUser(): SessionUser | null {
  return session?.user ?? null;
}

/** Fired when the session is lost (refresh failed) so the UI can return to login. */
const listeners = new Set<() => void>();
export function onSessionLost(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401 && retry && session) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshed.ok) {
      const tokens = (await refreshed.json()) as { accessToken: string; refreshToken: string };
      setSession({ ...session, ...tokens });
      return request<T>(path, options, false);
    }
    clearSession();
    listeners.forEach((fn) => fn());
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
