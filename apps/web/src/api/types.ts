import { apiFetch } from './client';

export type User = { id: string; email: string; createdAt?: string };

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string };
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: string;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type Sale = {
  id: string;
  userId: string;
  totalAmount: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: string;
    product: { id: string; name: string; sku: string };
  }>;
};

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    }),
  me: () => apiFetch<User>('/api/v1/auth/me'),
  logout: () => apiFetch<{ ok: true }>('/api/v1/auth/logout', { method: 'POST' }),
};

export const productsApi = {
  list: (params: { page?: number; limit?: number; q?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.q) sp.set('q', params.q);
    const qs = sp.toString();
    return apiFetch<Paginated<Product>>(`/api/v1/products${qs ? `?${qs}` : ''}`);
  },
  create: (body: { name: string; sku: string; price: string; stockQuantity: number }) =>
    apiFetch<Product>('/api/v1/products', { method: 'POST', body }),
  update: (
    id: string,
    body: Partial<{ name: string; sku: string; price: string; stockQuantity: number }>,
  ) => apiFetch<Product>(`/api/v1/products/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/api/v1/products/${id}`, { method: 'DELETE' }),
};

export const salesApi = {
  list: (params: { page?: number; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return apiFetch<Paginated<Sale>>(`/api/v1/sales${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiFetch<Sale>(`/api/v1/sales/${id}`),
  create: (
    items: Array<{ productId: string; quantity: number }>,
    idempotencyKey: string,
    onRetry?: (n: number) => void,
  ) =>
    apiFetch<Sale>('/api/v1/sales', {
      method: 'POST',
      body: { items },
      idempotencyKey,
      onRetry,
    }),
};
