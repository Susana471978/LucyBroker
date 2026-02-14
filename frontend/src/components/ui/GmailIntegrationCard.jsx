import { useEffect, useState } from "react";
import api from "../../services/apiClient";

export default function GmailIntegrationCard() {
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailEmail, setGmailEmail] = useState("");

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await api.get("/gmail/status");

            const data = res.data?.data || res.data;

            setGmailConnected(data?.gmail_connected || false);
            setGmailEmail(data?.gmail_email || "");
        } catch (err) {
            console.error("Error checking Gmail status:", err);
        } finally {
            setLoading(false);
        }
    };

    const connectGmail = async () => {
        try {
            setConnecting(true);

            const res = await api.get("/gmail/auth");

            const data = res.data?.data || res.data;

            if (data?.auth_url) {
                window.location.href = data.auth_url;
            }
        } catch (err) {
            console.error("Error connecting Gmail:", err);
            setConnecting(false);
        }
    };

    const disconnectGmail = async () => {
        try {
            setDisconnecting(true);

            await api.post("/gmail/disconnect");

            setGmailConnected(false);
            setGmailEmail("");
        } catch (err) {
            console.error("Error disconnecting Gmail:", err);
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="mt-8 max-w-4xl">
            <div className="bg-[#0B0D12] border border-white/10 rounded-xl p-6 flex items-center justify-between transition-all duration-300">
                <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                        Integración Gmail
                    </h3>

                    {gmailConnected ? (
                        <p className="text-xs text-gray-400 mt-1">
                            Cuenta conectada: {gmailEmail}
                        </p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-1">
                            No conectado
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {gmailConnected ? (
                        <>
                            <button
                                onClick={() => (window.location.href = "/app/messages")}
                                className="text-sm text-gray-400 hover:text-white transition"
                            >
                                Ir a mensajes
                            </button>

                            <button
                                onClick={disconnectGmail}
                                disabled={disconnecting}
                                className="text-sm text-red-400 hover:text-red-300 transition"
                            >
                                {disconnecting ? "Desconectando..." : "Desconectar"}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={connectGmail}
                            disabled={connecting}
                            className="text-sm text-blue-400 hover:text-blue-300 transition"
                        >
                            {connecting ? "Conectando..." : "Conectar"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
