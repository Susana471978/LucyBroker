// ─────────────────────────────────────────────
// frontend/src/context/AuthContext.js
// Sin localStorage — la sesión vive en la cookie httpOnly
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { id, email, role }
  const [loading, setLoading] = useState(true);   // comprobando sesión inicial

  // ── Al montar: comprueba si hay sesión activa (cookie válida) ────────────────
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        setUser(data);
      } catch {
        setUser(null);   // no hay sesión o expiró
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    // La cookie ya la escribió el backend; solo necesitamos el perfil
    const { data: profile } = await apiClient.get("/auth/me");
    setUser(profile);
    return data;
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────────
  const register = useCallback(async (email, password, name) => {
    const { data } = await apiClient.post("/auth/register", { email, password, name });
    const { data: profile } = await apiClient.get("/auth/me");
    setUser(profile);
    return data;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  const value = { user, loading, login, register, logout };

  if (loading) {
    // Pantalla de carga mínima mientras se verifica la sesión
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
