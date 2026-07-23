import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      apiClient.get("/auth/me")
        .then(({ data }) => setUser(data?.data || data))
        .catch(() => { localStorage.removeItem("auth_token"); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    const token = data?.data?.token || data?.token;
    const userData = data?.data?.user || data?.user;
    const ssoToken = data?.data?.sso_token || data?.sso_token;
    localStorage.setItem("auth_token", token);
    if (ssoToken) localStorage.setItem("sso_token", ssoToken);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { data } = await apiClient.post("/auth/register", { email, password, name });
    const token = data?.data?.token || data?.token;
    const userData = data?.data?.user || data?.user;
    const ssoToken = data?.data?.sso_token || data?.sso_token;
    localStorage.setItem("auth_token", token);
    if (ssoToken) localStorage.setItem("sso_token", ssoToken);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("sso_token");
    setUser(null);
    window.location.href = "/auth";
  }, []);

  const value = { user, loading, login, register, logout, isAuthenticated: !!user };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}