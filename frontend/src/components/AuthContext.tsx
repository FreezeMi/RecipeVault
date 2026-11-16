import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { authApi, clearRecipeCache, setUnauthorizedHandler } from '../services/api';
import { useToast } from './Toast';
import { getMessages } from '../lib/i18n';
import type { User } from '../types';

interface AuthContextType {
  authenticated: boolean;
  user: User | null;
  /** True until the initial session check has finished. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Clears local auth state without calling the server (e.g. after the server revoked the session). */
  clearSession: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const userRef = useRef<User | null>(null);

  // The admin's recipe lists contain hidden recipes, so they're dropped the moment the signed-in
  // user changes (sign-in, sign-out, expired session) and never shown to whoever comes next.
  const setUser = useCallback((next: User | null) => {
    if ((userRef.current?.id ?? null) !== (next?.id ?? null)) clearRecipeCache();
    userRef.current = next;
    setUserState(next);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.authenticated && data.user ? data.user : null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // A 401 on an authenticated request means the session expired or was revoked elsewhere.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setUser(null);
        toast.error(getMessages().session.expired);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [toast, setUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    setUser(user);
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const clearSession = useCallback(() => setUser(null), [setUser]);

  const value = useMemo(
    () => ({ authenticated: user !== null, user, loading, login, logout, clearSession, checkAuth }),
    [user, loading, login, logout, clearSession, checkAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
