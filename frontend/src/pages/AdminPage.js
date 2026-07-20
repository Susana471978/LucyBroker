import BrokerLayout from "../components/BrokerLayout";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import apiClient from "../services/apiClient";

const ROLES = ["director", "admin", "agent"];

const ROLE_LABELS = {
  director: { label: "Director", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  admin: { label: "Admin", color: "bg-[#C9A870]/15 text-[#C9A870] border-[#C9A870]/35" },
  agent: { label: "Agente", color: "bg-[#F2EFE9]/10 text-[#F2EFE9]/75 border-[#F2EFE9]/15" },
};

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchUsers = async () => {
    try {
      const { data } = await apiClient.get("/auth/users");
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await apiClient.put(`/auth/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      alert("Error al cambiar rol");
    }
  };

  const handleCreateUser = async () => {
    setFormError("");
    if (!form.name || !form.email || !form.password) {
      setFormError("Todos los campos son obligatorios");
      return;
    }
    setFormLoading(true);
    try {
      await apiClient.post("/auth/admin/create-user", form);
      setSuccessMsg(`Usuario ${form.email} creado correctamente`);
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "agent" });
      fetchUsers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      setFormError(e.response?.data?.detail || "Error al crear usuario");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <BrokerLayout>
    <div className="min-h-screen bg-[#0E0C09] text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestión de usuarios</h1>
            <p className="text-[#F2EFE9]/60 text-sm mt-1">Administra accesos y roles del equipo</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#C9A870]/15 hover:bg-[#C9A870]/25 text-[#C9A870] border border-[#C9A870]/45 px-4 py-2 rounded-[3px] text-sm font-medium transition-colors"
          >
            + Nuevo usuario
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-300 rounded-[3px] px-4 py-3 text-sm">
            {successMsg}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-[#0E0C09] border border-[#C9A870]/15 rounded-[3px] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#C9A870] border-t-transparent rounded-[3px] animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#C9A870]/15">
                  <th className="text-left text-xs text-[#F2EFE9]/60 font-medium px-6 py-3">Nombre</th>
                  <th className="text-left text-xs text-[#F2EFE9]/60 font-medium px-6 py-3">Email</th>
                  <th className="text-left text-xs text-[#F2EFE9]/60 font-medium px-6 py-3">Rol</th>
                  <th className="text-left text-xs text-[#F2EFE9]/60 font-medium px-6 py-3">Cambiar rol</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-[#C9A870]/10 ${i % 2 === 0 ? "bg-[#0E0C09]" : "bg-[#0B0907]"}`}>
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {u.name}
                      {u.id === user?.id && (
                        <span className="ml-2 text-xs text-[#F2EFE9]/45">(tú)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#F2EFE9]/80">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs border px-2 py-1 rounded-[3px] font-medium ${ROLE_LABELS[u.role]?.color || "bg-[#F2EFE9]/10 text-[#F2EFE9]/75"}`}>
                        {ROLE_LABELS[u.role]?.label || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.id !== user?.id ? (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="bg-[#0B0907] border border-[#C9A870]/20 text-[#F2EFE9]/80 text-xs rounded-[3px] px-2 py-1.5 focus:outline-none focus:border-[#C9A870]"
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-[#F2EFE9]/35">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal crear usuario */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#0E0C09] border border-[#C9A870]/20 rounded-[3px] p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-bold text-white mb-4">Nuevo usuario</h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#F2EFE9]/60 mb-1 block">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Javier Arquillo"
                    className="w-full bg-[#0B0907] border border-[#C9A870]/20 text-white rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-[#C9A870]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#F2EFE9]/60 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="javier@objetivabroker.com"
                    className="w-full bg-[#0B0907] border border-[#C9A870]/20 text-white rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-[#C9A870]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#F2EFE9]/60 mb-1 block">Contraseña</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-[#0B0907] border border-[#C9A870]/20 text-white rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-[#C9A870]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#F2EFE9]/60 mb-1 block">Rol</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-[#0B0907] border border-[#C9A870]/20 text-white rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-[#C9A870]"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="mt-3 text-xs text-red-400">{formError}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="flex-1 bg-[#F2EFE9]/06 hover:bg-[#F2EFE9]/12 text-[#F2EFE9]/80 py-2 rounded-[3px] text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={formLoading}
                  className="flex-1 bg-[#C9A870]/15 hover:bg-[#C9A870]/25 disabled:opacity-50 text-[#C9A870] border border-[#C9A870]/45 py-2 rounded-[3px] text-sm font-medium transition-colors"
                >
                  {formLoading ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </BrokerLayout>
  );
}
