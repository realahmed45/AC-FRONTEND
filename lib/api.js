/**
 * Every route lives under /api, but it's easy to set NEXT_PUBLIC_API_URL to the
 * bare host and get 404s that look like CORS failures. Normalise both forms:
 * trailing slashes go, and a missing /api suffix is added back.
 */
function resolveBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').trim();
  const trimmed = raw.replace(/\/+$/, '');
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

const BASE = resolveBase();

const TOKEN_KEY = 'ac_token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  const token = tokenStore.get();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
    tokenStore.clear();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const get = (path, params) => api(path, { params });
export const post = (path, body) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const del = (path) => api(path, { method: 'DELETE' });
