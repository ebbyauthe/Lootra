import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatError } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // Silent probe — 401 is expected for guests.
      const { data } = await api.get("/auth/me", { validateStatus: (s) => s === 200 || s === 401 });
      if (data && data.id) setUser(data); else setUser(false);
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e) };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e) };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
