const TOKEN_KEY = 'posbuzz_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
  retries?: number;
  onRetry?: (attempt: number) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(status: number | null, networkError: boolean): boolean {
  if (networkError) return true;
  return status === 502 || status === 503 || status === 504;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const maxRetries = options.retries ?? 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const token = options.token !== undefined ? options.token : getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }

      const res = await fetch(url, {
        method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (isTransient(res.status, false) && attempt < maxRetries - 1) {
        options.onRetry?.(attempt + 1);
        await sleep(Math.min(1000 * 2 ** attempt, 8000));
        continue;
      }

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!res.ok) {
        const obj = (data ?? {}) as { message?: string | string[]; error?: string; statusCode?: number };
        const msg = Array.isArray(obj.message)
          ? obj.message.join(', ')
          : (obj.message ?? res.statusText);
        if (res.status === 401) {
          clearToken();
        }
        throw new ApiError(res.status, msg, obj.error);
      }

      return data as T;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError) throw err;
      if (attempt < maxRetries - 1) {
        options.onRetry?.(attempt + 1);
        await sleep(Math.min(1000 * 2 ** attempt, 8000));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
