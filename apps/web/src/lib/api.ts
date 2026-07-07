const BASE = '/api';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = typeof window !== 'undefined' ? window.__accessToken : undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(BASE + path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    if (await tryRefresh()) return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw body as ApiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function uploadRequest<T>(path: string, formData: FormData, retry = true): Promise<T> {
  const token = typeof window !== 'undefined' ? window.__accessToken : undefined;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  // No Content-Type here — the browser sets the multipart boundary itself.
  const res = await fetch(BASE + path, { method: 'POST', headers, body: formData, credentials: 'include' });

  if (res.status === 401 && retry) {
    if (await tryRefresh()) return uploadRequest<T>(path, formData, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw body as ApiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function blobRequest(path: string, retry = true): Promise<Blob> {
  const token = typeof window !== 'undefined' ? window.__accessToken : undefined;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(BASE + path, { headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    if (await tryRefresh()) return blobRequest(path, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw body as ApiError;
  }

  return res.blob();
}

let refreshPromise: Promise<boolean> | null = null;

// Concurrent 401s (several components fetching on the same page load) must share one
// in-flight refresh call — firing one per caller would both waste requests and race
// against each other, since each successful refresh rotates the refresh token cookie.
function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      if (typeof window !== 'undefined') window.__accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export const api = {
  get:    <T>(path: string)                => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
  blob:   (path: string)                    => blobRequest(path),
};

// Fetches an authenticated file (e.g. a receipt) and opens it in a new tab as a blob URL,
// since a plain <a href> navigation can't carry the Bearer token the API requires.
export async function fetchReceiptBlobUrl(path: string): Promise<void> {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// Downloads an authenticated file (e.g. a report export) with a given filename, since a
// plain <a href download> navigation can't carry the Bearer token the API requires.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window { __accessToken?: string; }
}
