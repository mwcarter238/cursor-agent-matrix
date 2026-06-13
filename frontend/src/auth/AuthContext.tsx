import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_USER = "stockwell.user";
const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Restore a previous session from localStorage on first mount.
  useEffect(() => {
    const token = getToken();
    const stored = localStorage.getItem(STORAGE_USER);
    if (token && stored) {
      try {
        setUser(JSON.parse(stored) as User);
      } catch {
        setToken(null);
      }
    }
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const res = await api.login(username, pin);
    setToken(res.token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
