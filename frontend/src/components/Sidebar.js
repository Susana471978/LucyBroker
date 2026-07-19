import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const NAV = [
  { key: "bandeja",  label: "Bandeja",  icon: "◈", path: "/broker/bandeja",  roles: ["director","admin","agent"] },
  { key: "briefing", label: "Briefing", icon: "◉", path: "/broker/briefing", roles: ["director","admin","agent"] },
  { key: "equipo",   label: "Equipo",   icon: "◫", path: "/broker/equipo",   roles: ["director","admin"] },
  { key: "informes", label: "Informes", icon: "◪", path: "/broker/informes", roles: ["director","admin"] },
  { key: "config",   label: "Config",   icon: "◧", path: "/broker/config",   roles: ["director","admin","agent"] },
  { key: "usuarios", label: "Usuarios", icon: "◬", path: "/admin/users",     roles: ["director","admin"] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || "agent";
  const visible = NAV.filter(n => n.roles.includes(role));

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0, width: 200,
      background: "#0B0907",
      borderRight: "1px solid rgba(201,168,112,0.08)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid rgba(201,168,112,0.06)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#C9A870" }}>Lucy</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.55rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(242,239,233,0.55)", marginTop: 3 }}>Broker</div>
      </div>

      <nav style={{ flex: 1, padding: "16px 0", overflowY: "auto" }}>
        {visible.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button key={item.key} onClick={() => navigate(item.path)} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 24px",
              background: active ? "rgba(201,168,112,0.07)" : "none",
              border: "none", borderLeft: active ? "2px solid #C9A870" : "2px solid transparent",
              cursor: "pointer",
              color: active ? "#C9A870" : "rgba(242,239,233,0.6)",
              fontSize: "0.78rem", fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: active ? 600 : 400, letterSpacing: "0.04em", textAlign: "left",
              transition: "all 0.18s ease",
            }}>
              <span style={{ fontSize: "0.7rem", opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(201,168,112,0.06)" }}>
        <div style={{ fontSize: "0.72rem", color: "rgba(242,239,233,0.75)", fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,112,0.7)", marginBottom: 12 }}>{role}</div>
        <button onClick={logout} style={{ background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(242,239,233,0.45)", cursor: "pointer", padding: 0, transition: "color 0.18s" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(242,239,233,0.5)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(242,239,233,0.2)"}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
