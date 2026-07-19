import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { RefreshCw, Paperclip, Download } from "lucide-react";
import api from "../services/apiClient";
import BrokerLayout from "../components/BrokerLayout";

const logAction = async (accion, email) => {
  try {
    await api.post("/log/accion", {
      accion,
      correo_id: email?.id || "",
      correo_asunto: email?.subject || "",
      correo_de: email?.from_email || "",
      categoria: email?.categoria || "",
      prioridad: email?.priority?.priority_label || "",
    });
  } catch (e) {}
};

const CANAL_COLORS = {
  email:      { color: "#7BA7C9", label: "Email" },
  whatsapp:   { color: "#5FAD7A", label: "WhatsApp" },
  web:        { color: "#C9A870", label: "Web" },
  formulario: { color: "#A98BC9", label: "Formulario" },
  telefono:   { color: "#C97B7B", label: "Telefono" },
};

const getCanal = (canal) =>
  CANAL_COLORS[canal] || { color: "rgba(242,239,233,0.55)", label: canal || "Otro" };

const getPriorityDot = (label) => {
  if (["ALTA","PRIORITARIO"].includes(label)) return "#f87171";
  if (["MEDIA","SEGUIMIENTO"].includes(label)) return "#C9A870";
  return "rgba(242,239,233,0.2)";
};

export default function BandejaPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const generateDraft = async (emailId) => {
    setAiLoading(true);
    setAiDraft(null);
    try {
      const res = await api.post("/ai/draft-reply", { email_id: emailId, instructions: "", tone: "professional" });
      const drafts = res.data?.data?.drafts || res.data?.drafts || [];
      if (drafts.length > 0) setAiDraft(drafts[0]);
    } catch(e) {
      console.error("Error generando borrador:", e);
    } finally {
      setAiLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const fetchEmails = async () => {
    try {
      setSyncing(true);
      const res = await api.get("/emails");
      const data = res.data?.data || res.data || [];
      setEmails(Array.isArray(data) ? data : []);
    } catch (e) {} finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => { fetchEmails(); }, []);

  const filtrados = emails.filter(e => {
    if (filtro === "prioritario") return ["ALTA","PRIORITARIO"].includes(e.priority?.priority_label);
    if (filtro === "seguimiento") return ["MEDIA","SEGUIMIENTO"].includes(e.priority?.priority_label);
    return true;
  });

  const selectedEmail = emails.find(e => e.email?.id === selected);

  const FILTROS = [
    { key: "todos",       label: "Todos",       count: emails.length },
    { key: "prioritario", label: "Prioritarios", count: emails.filter(e => ["ALTA","PRIORITARIO"].includes(e.priority?.priority_label)).length },
    { key: "seguimiento", label: "Seguimiento",  count: emails.filter(e => ["MEDIA","SEGUIMIENTO"].includes(e.priority?.priority_label)).length },
  ];

  return (
    <BrokerLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.4rem", fontWeight: 600, color: "#F2EFE9", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Bandeja
          </h1>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,239,233,0.55)" }}>
            Comunicaciones · Email · Web · WhatsApp
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={fetchEmails} disabled={syncing}
            style={{ background: "none", border: "1px solid rgba(201,168,112,0.15)", borderRadius: 3, padding: "6px 10px", cursor: "pointer", color: "rgba(242,239,233,0.6)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", transition: "all 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(201,168,112,0.35)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(201,168,112,0.15)"}
          >
            <RefreshCw size={12} strokeWidth={1.5} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            Sincronizar
          </button>
          <button
            onClick={async () => {
              try {
                const res = await api.get("/log/pdf?fecha=" + today, { responseType: "blob" });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement("a");
                a.href = url; a.download = "informe_" + today + ".pdf"; a.click();
                window.URL.revokeObjectURL(url);
              } catch(e) {}
            }}
            style={{ background: "none", border: "1px solid rgba(201,168,112,0.15)", borderRadius: 3, padding: "6px 10px", cursor: "pointer", color: "rgba(242,239,233,0.6)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", transition: "all 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(201,168,112,0.35)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(201,168,112,0.15)"}
          >
            <Download size={12} strokeWidth={1.5} />
            Informe
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            background: filtro === f.key ? "rgba(201,168,112,0.1)" : "none",
            border: filtro === f.key ? "1px solid rgba(201,168,112,0.3)" : "1px solid rgba(242,239,233,0.06)",
            borderRadius: 20, padding: "5px 14px",
            cursor: "pointer",
            color: filtro === f.key ? "#C9A870" : "rgba(242,239,233,0.6)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "0.75rem", letterSpacing: "0.16em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.18s",
          }}>
            {f.label}
            <span style={{ background: filtro === f.key ? "rgba(201,168,112,0.2)" : "rgba(242,239,233,0.06)", borderRadius: 3, padding: "1px 6px", fontSize: "0.72rem" }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.1fr" : "1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,239,233,0.45)" }}>
              Cargando mensajes...
            </div>
          )}
          {!loading && filtrados.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,239,233,0.45)" }}>
              Sin mensajes
            </div>
          )}
          {filtrados.map(item => {
            const isSelected = selected === item.email?.id;
            const dotColor = getPriorityDot(item.priority?.priority_label);
            return (
              <div key={item.email?.id}
                onClick={() => {
                  if (!isSelected) logAction("LEIDO", { ...item.email, categoria: item.categoria, priority: item.priority });
                  setSelected(isSelected ? null : item.email?.id);
                  setAiDraft(null);
                }}
                style={{
                  padding: "14px 18px",
                  background: isSelected ? "rgba(201,168,112,0.06)" : "#0E0C09",
                  border: "1px solid",
                  borderColor: isSelected ? "rgba(201,168,112,0.2)" : "rgba(242,239,233,0.04)",
                  borderLeft: "3px solid " + (isSelected ? "#C9A870" : dotColor),
                  borderRadius: 3,
                  cursor: "pointer",
                  display: "flex", gap: 14, alignItems: "flex-start",
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(201,168,112,0.03)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#0E0C09"; }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 3, background: "rgba(201,168,112,0.06)", border: "1px solid rgba(201,168,112,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#C9A870" }}>{item.priority?.priority_score ?? "—"}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: getCanal(item.email?.canal).color, opacity: 0.8 }}>{getCanal(item.email?.canal).label}</span>
                    {item.categoria && (
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,239,233,0.55)" }}>{item.categoria}</span>
                    )}
                    {item.email?.has_attachments && <Paperclip size={10} strokeWidth={1.5} color="rgba(242,239,233,0.3)" />}
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#F2EFE9", fontWeight: 500, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.email?.subject || "(sin asunto)"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(242,239,233,0.6)" }}>{item.email?.from_name}</span>
                    <span style={{ fontSize: "0.78rem", color: "rgba(242,239,233,0.45)" }}>·</span>
                    <span style={{ fontSize: "0.78rem", color: "rgba(242,239,233,0.45)" }}>{new Date(item.email?.date).toLocaleDateString("es-ES")}</span>
                  </div>
                  {item.resumen && (
                    <div style={{ fontSize: "0.8rem", color: "rgba(242,239,233,0.6)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.resumen}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedEmail && (
          <div style={{ background: "#0E0C09", border: "1px solid rgba(201,168,112,0.1)", borderRadius: 3, padding: "24px", position: "sticky", top: 32, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(201,168,112,0.7)", marginBottom: 14 }}>Detalle</div>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1rem", fontWeight: 600, color: "#F2EFE9", letterSpacing: "-0.01em", marginBottom: 8, lineHeight: 1.3 }}>
              {selectedEmail.email?.subject}
            </h3>
            <div style={{ fontSize: "0.7rem", color: "rgba(242,239,233,0.6)", marginBottom: 16 }}>
              {selectedEmail.email?.from_name} · {selectedEmail.email?.from_email}
            </div>

            {selectedEmail.datos_clave && Object.values(selectedEmail.datos_clave).some(v => v) && (
              <div style={{ background: "rgba(201,168,112,0.03)", border: "1px solid rgba(201,168,112,0.08)", borderRadius: 3, padding: "12px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 5 }}>
                {selectedEmail.datos_clave.cliente && <div style={{ fontSize: "0.8rem" }}><span style={{ color: "rgba(242,239,233,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cliente </span><span style={{ color: "#F2EFE9" }}>{selectedEmail.datos_clave.cliente}</span></div>}
                {selectedEmail.datos_clave.poliza && <div style={{ fontSize: "0.8rem" }}><span style={{ color: "rgba(242,239,233,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Póliza </span><span style={{ color: "#C9A870" }}>{selectedEmail.datos_clave.poliza}</span></div>}
                {selectedEmail.datos_clave.aseguradora && <div style={{ fontSize: "0.8rem" }}><span style={{ color: "rgba(242,239,233,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Aseguradora </span><span style={{ color: "#F2EFE9" }}>{selectedEmail.datos_clave.aseguradora}</span></div>}
                {selectedEmail.datos_clave.urgencia && <div style={{ fontSize: "0.8rem", color: "#f87171" }}>{selectedEmail.datos_clave.urgencia}</div>}
              </div>
            )}

            {selectedEmail.resumen && (
              <p style={{ fontSize: "0.8rem", color: "rgba(242,239,233,0.55)", lineHeight: 1.7, marginBottom: 20 }}>
                {selectedEmail.resumen}
              </p>
            )}

            <div style={{ borderTop: "1px solid rgba(201,168,112,0.07)", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,239,233,0.55)" }}>Respuesta sugerida</div>
                <button
                  onClick={(e) => { e.stopPropagation(); generateDraft(selectedEmail.email?.id); }}
                  disabled={aiLoading}
                  style={{ background: "none", border: "1px solid rgba(201,168,112,0.2)", borderRadius: 3, padding: "3px 10px", cursor: "pointer", color: "#C9A870", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", opacity: aiLoading ? 0.5 : 1, transition: "all 0.18s" }}
                >
                  {aiLoading ? "Generando..." : "✦ Lucy"}
                </button>
              </div>
              <div style={{ fontSize: "0.85rem", color: "rgba(242,239,233,0.65)", lineHeight: 1.7, padding: "12px 14px", background: "rgba(201,168,112,0.02)", border: "1px solid rgba(201,168,112,0.07)", borderRadius: 3, whiteSpace: "pre-wrap", marginBottom: 12, minHeight: 80 }}>
                {aiLoading ? "Lucy está redactando..." : (aiDraft || selectedEmail.borrador || "Estimado/a " + (selectedEmail.email?.from_name?.split(" ")[0] || "") + ",\n\nGracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto a la mayor brevedad.\n\nAtentamente,\nObjetiva Broker\nCorreduría de Seguros\nSanta Cruz de Tenerife")}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); logAction("RESPONDIDO", { ...selectedEmail.email, categoria: selectedEmail.categoria, priority: selectedEmail.priority }); }}
                style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(201,168,112,0.25)", borderRadius: 3, color: "#C9A870", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,112,0.06)"; e.currentTarget.style.borderColor = "rgba(201,168,112,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(201,168,112,0.25)"; }}
              >
                Marcar como respondido
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BrokerLayout>
  );
}
