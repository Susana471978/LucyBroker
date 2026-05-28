import { useEffect, useState, memo, useRef } from "react";
import apiClient from "../../services/apiClient";

function GmailIntegrationCard() {
    const handleDisconnectVisual = () => {
        setGmailConnected(false);
        setGmailEmail(null);
    };
    const [gmailConnected, setGmailConnected] = useState(null);
    const [gmailEmail, setGmailEmail] = useState(null);
    const [ready, setReady] = useState(false);
    const stableRef = useRef({ connected: null, email: null });
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            const res = await apiClient.get("/gmail/status");
            const data = res?.data?.data || res?.data || {};

            const normalizedConnected =
                Boolean(data.gmail_connected) ||
                Boolean(data.connected) ||
                Boolean(data.email);

            const nextEmail = data.email || null;

            const prev = stableRef.current;
            const changed =
                prev.connected !== normalizedConnected || prev.email !== nextEmail;

            if (changed) {
                stableRef.current = { connected: normalizedConnected, email: nextEmail };
                setGmailConnected(normalizedConnected);
                setGmailEmail(nextEmail);
            }

        } catch (error) {
            stableRef.current = { connected: false, email: null };
            setGmailConnected(false);
            setGmailEmail(null);
        } finally {
            setReady(true);
        }
    };

    const connectGmail = async () => {
        try {
            const res = await apiClient.get("/gmail/auth");
            const url = res.data?.data?.auth_url || res.data?.auth_url;
            if (url) window.location.href = url;
        } catch (err) {
            console.error("Gmail connect error:", err);
        }
    };

    useEffect(() => {
        checkStatus();
        // eslint-disable-next-line
    }, []);

    if (!ready) {
        return (
            <div className="glass-subtle rounded-xl p-5 border border-white/5">
                <div className="h-4 w-40 bg-white/10 rounded mb-3" />
                <div className="h-3 w-56 bg-white/5 rounded mb-2" />
                <div className="h-3 w-44 bg-white/5 rounded" />
                <div className="mt-4 h-9 w-full bg-white/5 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="mt-8 max-w-4xl">
            <div
                className="gmail-glass-card flex items-center justify-between px-6 py-4 rounded-2xl shadow-md border transition-all duration-300"
                style={{
                    background: "rgba(12, 18, 35, 0.65)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(201, 178, 124, 0.35)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                    borderRadius: "15px"
                }}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-semibold text-white tracking-wide truncate">
                        Integración Gmail
                    </span>
                    {gmailConnected ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs text-gray-300 truncate">
                                {gmailEmail || "Cuenta autorizada"}
                            </span>
                        </>
                    ) : (
                        <span className="text-xs text-gray-500">
                            No conectado
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                    {gmailConnected ? (
                        <>
                            <button
                                className="gmail-secondary-btn text-sm text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 transition"
                                style={{
                                    background: "none",
                                    padding: "0 10px"
                                }}
                            >
                                Ver mensajes
                            </button>

                            <button
                                onClick={handleDisconnectVisual}
                                className="gmail-champagne-btn text-sm font-semibold transition"
                                style={{
                                    color: "#C9B27C",
                                    background: "transparent",
                                    padding: "0 18px",
                                    border: "none",
                                    boxShadow: "none"
                                }}
                                onFocus={e => e.target.style.boxShadow = "0 0 0 2px #C9B27C55"}
                                onBlur={e => e.target.style.boxShadow = "none"}
                                onMouseOver={e => e.target.style.color = "#EADFA7"}
                                onMouseOut={e => e.target.style.color = "#C9B27C"}
                            >
                                Gestión de integración
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={connectGmail}
                            className="text-sm text-blue-400 hover:text-blue-300 transition"
                        >
                            Conectar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(GmailIntegrationCard);
