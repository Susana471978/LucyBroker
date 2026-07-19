import BrokerLayout from "../components/BrokerLayout";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import api from "../services/apiClient";

export default function BriefingPage() {
  const { user } = useAuth();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] || "";

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long"
  });

  useEffect(() => {
    api.get("/emails").then(res => {
      const data = res.data?.data || res.data || [];
      setEmails(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const prioritarios = emails.filter(e => ["ALTA","PRIORITARIO"].includes(e.priority?.priority_label));
  const seguimiento = emails.filter(e => ["MEDIA","SEGUIMIENTO"].includes(e.priority?.priority_label));

  return (
    <BrokerLayout>
      <div style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.6rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(201,168,112,0.7)", marginBottom: 10 }}>{today}</div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 600, color: "#F2EFE9", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 6 }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: "0.84rem", color: "rgba(242,239,233,0.6)", letterSpacing: "0.01em" }}>
            {loading ? "Analizando tu bandeja..." :
              prioritarios.length > 0
                ? `Tienes ${prioritarios.length} mensaje${prioritarios.length > 1 ? "s" : ""} prioritario${prioritarios.length > 1 ? "s" : ""} esperando.`
                : "Tu bandeja está al día."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { label: "Total", value: emails.length, color: "#F2EFE9" },
            { label: "Prioritarios", value: prioritarios.length, color: "#C9A870" },
            { label: "Seguimiento", value: seguimiento.length, color: "rgba(242,239,233,0.6)" },
          ].map(m => (
            <div key={m.label} style={{ background: "#0E0C09", border: "1px solid rgba(201,168,112,0.08)", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "2rem", fontWeight: 700, color: m.color, lineHeight: 1, marginBottom: 6 }}>{loading ? "—" : m.value}</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(242,239,233,0.55)" }}>{m.label}</div>
            </div>
          ))}
        </div>

        {!loading && prioritarios.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(201,168,112,0.7)", marginBottom: 12 }}>Requieren atención</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {prioritarios.slice(0, 5).map(e => (
                <div key={e.email?.id} style={{ background: "#0E0C09", border: "1px solid rgba(201,168,112,0.12)", borderLeft: "2px solid #C9A870", borderRadius: 3, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "#F2EFE9", fontWeight: 500, marginBottom: 3 }}>{e.email?.subject || "(sin asunto)"}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(242,239,233,0.6)" }}>{e.email?.from_name || e.email?.from_email}</div>
                  </div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#C9A870", opacity: 0.7 }}>Prioritario</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && emails.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(242,239,233,0.45)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Sin mensajes hoy
          </div>
        )}
      </div>
    </BrokerLayout>
  );
}
