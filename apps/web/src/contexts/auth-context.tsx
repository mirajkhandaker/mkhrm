'use client';

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (_email: string, _password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (_permission: string) => boolean;
  hasRole: (_role: string) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const saveToken = useCallback((token: string) => {
    if (typeof window !== 'undefined') window.__accessToken = token;
  }, []);

  useEffect(() => {
    api.post<{ accessToken: string; user: AuthUser }>('/auth/refresh')
      .then((data) => { saveToken(data.accessToken); setUser(data.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [saveToken]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password });
    saveToken(data.accessToken);
    setUser(data.user);
    router.push('/dashboard');
  }, [router, saveToken]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* best-effort */ }
    setUser(null);
    if (typeof window !== 'undefined') delete window.__accessToken;
    router.push('/login');
  }, [router]);

  const hasPermission = useCallback((p: string) => user?.permissions.includes(p) ?? false, [user]);
  const hasRole = useCallback((r: string) => user?.roles.includes(r) ?? false, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
