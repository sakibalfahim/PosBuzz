import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '../api/types';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, onRetry?: () => void) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export type AuthProviderProps = { children: ReactNode };
