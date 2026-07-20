import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../api/client';
import type { User } from '../api/types';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<User>('/api/v1/auth/me')
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, onRetry?: () => void) => {
    const res = await apiFetch<{
      accessToken: string;
      user: { id: string; email: string };
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
      onRetry: () => onRetry?.(),
    });
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // clear local session anyway
    }
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
