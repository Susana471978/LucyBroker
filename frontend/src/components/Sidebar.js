import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const NAV = [
  { key: "bandeja",  label: "Bandeja",  icon: "◈", path: "/broker/bandeja",  roles: ["director","admin","agent"] },
  { key: "briefing", label: "Briefing", icon: "◉", path: "/broker/briefing", roles: ["director","admin","agent"] },
  { key: "equipo",   label: "Equipo",   icon: "◫", path: "/broker/equipo",   roles: ["director","admin"], proximamente: true },
  { key: "informes", label: "Informes", icon: "◪", path: "/broker/informes", roles: ["director","admin"], proximamente: true },
  { key: "config",   label: "Config",   icon: "◧", path: "/broker/config",   roles: ["director","admin","agent"], proximamente: true },
  { key: "usuarios", label: "Usuarios", icon: "◬", path: "/admin/users",     roles: ["director","admin"] },
];

// Modulos externos del ecosistema Objetiva (SSO via sso_token).
// proximamente:true hasta que cada modulo tenga su pagina /sso.
const MODULOS = [
  { key: "siniestros", label: "Siniestros", icon: "◱", url: "https://siniestros.objetivabroker.es", roles: ["director","admin","agent"], proximamente: true },
  { key: "crm",        label: "CRM",        icon: "◭", url: "https://crm.objetivabroker.es",        roles: ["director","admin","agent"], proximamente: true },
  { key: "clavex",     label: "Clavex",     icon: "◮", url: "https://clavex.objetivabroker.es",     roles: ["director","admin","agent"], proximamente: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || "agent";
  const visible = NAV.filter(n => n.roles.includes(role));
  const modulosVisibles = MODULOS.filter(m => m.roles.includes(role));

  const abrirModulo = (m) => {
    if (m.proximamente) return;
    const sso = localStorage.getItem("sso_token");
    if (!sso) { alert("Sesion SSO no disponible. Vuelve a iniciar sesion."); return; }
    const url = `${m.url}/sso?token=${encodeURIComponent(sso)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0, width: 200,
      background: "#F1F1F0",
      borderRight: "1px solid rgba(16,16,18,0.15)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid rgba(16,16,18,0.1)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9C7434" }}>Lucy</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(16,16,18,0.5)", marginTop: 3 }}>Broker</div>
      </div>

      <nav style={{ flex: 1, padding: "16px 0", overflowY: "auto" }}>
        {visible.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.key}
              onClick={() => { if (!item.proximamente) navigate(item.path); }}
              disabled={item.proximamente}
              title={item.proximamente ? "Disponible proximamente" : undefined}
              style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 24px",
              background: active ? "rgba(156,116,52,0.12)" : "none",
              border: "none", borderLeft: active ? "3px solid #9C7434" : "3px solid transparent",
              cursor: item.proximamente ? "default" : "pointer",
              opacity: item.proximamente ? 0.4 : 1,
              color: active ? "#9C7434" : "rgba(16,16,18,0.65)",
              fontSize: "0.85rem", fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: active ? 600 : 400, letterSpacing: "0.04em", textAlign: "left",
              transition: "all 0.18s ease",
            }}>
              <span style={{ fontSize: "0.8rem", opacity: active ? 1 : 0.75 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

        {modulosVisibles.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(16,16,18,0.1)" }}>
            <div style={{ padding: "0 24px 8px", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(16,16,18,0.4)" }}>
              Modulos
            </div>
            {modulosVisibles.map(m => (
              <button
                key={m.key}
                onClick={() => abrirModulo(m)}
                disabled={m.proximamente}
                title={m.proximamente ? "Disponible proximamente" : `Abrir ${m.label}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 24px",
                  background: "none", border: "none",
                  borderLeft: "3px solid transparent",
                  cursor: m.proximamente ? "default" : "pointer",
                  opacity: m.proximamente ? 0.4 : 1,
                  color: "rgba(16,16,18,0.65)",
                  fontSize: "0.85rem", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 400, letterSpacing: "0.04em", textAlign: "left",
                  transition: "all 0.18s ease",
                }}>
                <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>{m.icon}</span>
                {m.label}
                <span style={{ marginLeft: "auto", fontSize: "0.62rem", opacity: 0.6 }}>↗</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <div style={{ padding: "18px 24px 26px", borderTop: "1px solid rgba(16,16,18,0.1)" }}>
        <div style={{ fontSize: "0.8rem", color: "#101012", fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9C7434", marginBottom: 12 }}>{role}</div>
        <button onClick={logout} style={{ background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(16,16,18,0.5)", cursor: "pointer", padding: 0, transition: "color 0.18s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#101012"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(16,16,18,0.5)"}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
