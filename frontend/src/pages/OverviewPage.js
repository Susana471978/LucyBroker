import { Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { t } from '../i18n';
import axios from 'axios';

import {
  Inbox,
  CheckCircle,
  Clock,
  Paperclip,
  Sparkles,
  Link2,
  Mic
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';

import { disconnectGmail } from '../services/mailService';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

/* ---------- Stat Card ---------- */
const StatCard = ({ icon, label, value, highlight, onClick }) => {
  let baseClass =
    'glass-subtle bg-slate-900/40 rounded-xl p-6 text-left w-full cursor-pointer transition-all ' +
    'shadow-[0_0_35px_rgba(29,78,216,0.22)] ' +
    'sm:shadow-[0_0_50px_rgba(29,78,216,0.12)] ' +
    'hover:shadow-[0_0_70px_rgba(29,78,216,0.25)] ';

  if (highlight) baseClass += 'border-blue-500/30 halo-active ';

  let iconClass = 'w-10 h-10 rounded-lg flex items-center justify-center mb-4 ';
  iconClass += highlight ? 'bg-blue-500/20' : 'bg-slate-700/50';

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={baseClass}
    >
      <div className={iconClass}>
        <span className={highlight ? 'text-blue-400' : 'text-slate-400'}>
          {icon}
        </span>
      </div>
      <p className="text-4xl font-semibold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </motion.button>
  );
};

/* ---------- PAGE ---------- */
export default function OverviewPage() {
  const { language, token } = useAuth();
  const navigate = useNavigate();

  const {
    voiceState,
    startListening,
    cancel,
    speak,
    ttsEnabled,
    setTtsEnabled,
    wakeWordEnabled,
    setWakeWordEnabled,
    wakeWordActive,
    handsFreeModeActive,
    activateHandsFreeMode,
    lastInteraction,
    STATES
  } = useVoice();

  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailLoading, setGmailLoading] = useState(false);

  const [executiveInput, setExecutiveInput] = useState('');
  const [executiveResponse, setExecutiveResponse] = useState(null);
  const [executiveLoading, setExecutiveLoading] = useState(false);

  const lastInputModeRef = useRef(null);
  const lastSpokenRef = useRef(null);

  const isIdle = voiceState === STATES.IDLE;
  const isListening = voiceState === STATES.LISTENING;
  const isProcessing = voiceState === STATES.PROCESSING;
  const isSpeaking = voiceState === STATES.SPEAKING;

  const executiveLabel = isIdle
    ? "Activar Executive"
    : isListening
      ? "Escuchando… (clic para cancelar)"
      : isProcessing
        ? "Procesando…"
        : isSpeaking
          ? "Hablando… (clic para cancelar)"
          : "Activar Executive";

  const handleExecutiveClick = () => {
    if (isIdle) startListening();
    else cancel();
  };

  const sendTextCommand = async () => {
    if (!executiveInput.trim()) return;
    lastInputModeRef.current = "text";

    try {
      setExecutiveLoading(true);
      const res = await axios.post(
        `${API}/assistant`,
        { text: executiveInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data?.data || res.data;
      setExecutiveResponse(data.assistant_text);
      setExecutiveInput('');
    } catch (err) {
      console.error("Executive text error:", err);
    } finally {
      setExecutiveLoading(false);
    }
  };

  useEffect(() => {
    if (!executiveResponse) return;
    if (lastInputModeRef.current !== "text") return;
    if (voiceState !== STATES.IDLE) return;
    if (!ttsEnabled) return;
    if (executiveResponse === lastSpokenRef.current) return;

    if (typeof speak === 'function') {
      speak(executiveResponse);
      lastSpokenRef.current = executiveResponse;
    }
  }, [executiveResponse, voiceState, ttsEnabled, speak, STATES]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const emailsRes = await axios.get(`${API}/gmail/messages`, { headers });
      const emailsData = emailsRes.data?.data || emailsRes.data || [];
      const list = Array.isArray(emailsData) ? emailsData : [];

      setEmails(list);
      setStats({
        total: list.length,
        prioritarios: list.filter(e => e.priority?.priority_label === 'PRIORITARIO').length,
        seguimiento: list.filter(e => e.priority?.priority_label === 'SEGUIMIENTO').length,
        with_attachments: list.filter(e => e.email?.has_attachments).length,
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setEmails([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  useEffect(() => {
    if (!token) return;
    const checkGmail = async () => {
      try {
        const res = await axios.get(`${API}/gmail/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = res.data?.data || res.data;
        setGmailConnected(!!d.gmail_connected);
        setGmailEmail(d.gmail_email || '');
      } catch (err) {
        console.error('Gmail status error:', err);
      } finally {
        setGmailLoading(false);
      }
    };
    checkGmail();
  }, [token]);

  const handleGmailConnect = async () => {
    try {
      const res = await axios.get(`${API}/gmail/auth`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = res.data?.data?.auth_url || res.data?.auth_url;
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Gmail connect error:", err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGmail();
      setGmailConnected(false);
      setGmailEmail('');
      setEmails([]);
      setStats({ total: 0, prioritarios: 0, seguimiento: 0, with_attachments: 0 });
    } catch (err) {
      console.error("Disconnect error", err);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">

        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-white mb-4">
            {t(language, 'welcomeTitle')}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            {t(language, 'welcomeSubtitle')}
          </p>
        </div>

        {!gmailLoading && (
          <div className="glass-subtle rounded-2xl p-5 flex items-center justify-between
            shadow-[0_0_35px_rgba(29,78,216,0.22)]
            sm:shadow-[0_0_50px_rgba(29,78,216,0.12)]
            hover:shadow-[0_0_70px_rgba(29,78,216,0.25)]
            transition-all">
            {gmailConnected ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-slate-200 text-sm font-medium">
                    Correo conectado:{' '}
                    <span className="text-blue-400">{gmailEmail}</span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            ) : (
              <>
                <span className="text-slate-400 text-sm">
                  Conecta tu correo para analizar tus emails
                </span>
                <Button
                  onClick={handleGmailConnect}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Conectar mi correo
                </Button>
              </>
            )}
          </div>
        )}

        {!loading && stats && gmailConnected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <StatCard
                icon={<Inbox className="w-5 h-5" />}
                label="Total Emails"
                value={stats.total}
                highlight
                onClick={() => navigate('/messages')}
              />
              <StatCard
                icon={<Sparkles className="w-5 h-5" />}
                label="Prioritarios"
                value={stats.prioritarios}
                onClick={() => navigate('/messages?filter=PRIORITARIO')}
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="Seguimiento"
                value={stats.seguimiento}
                onClick={() => navigate('/messages?filter=SEGUIMIENTO')}
              />
              <StatCard
                icon={<Paperclip className="w-5 h-5" />}
                label="Con Adjuntos"
                value={stats.with_attachments}
                onClick={() => navigate('/messages?filter=attachments')}
              />
            </div>

            <div className="glass-premium rounded-2xl p-8 border border-blue-500/20 mt-6
              shadow-[0_0_60px_rgba(29,78,216,0.15)] transition-all">
              <div className="flex flex-col gap-6">

                {/* HEADER */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">Lucy</h3>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all duration-300 ${wakeWordActive
                        ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                        : wakeWordEnabled
                          ? 'bg-slate-800 text-slate-500 border-slate-700'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${wakeWordActive ? 'bg-blue-400 animate-pulse' : wakeWordEnabled ? 'bg-slate-500' : 'bg-slate-700'
                        }`} />
                      {wakeWordActive ? 'Escuchando...' : wakeWordEnabled ? 'Di "Hola Lucy"' : 'Voz desactivada'}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setTtsEnabled(prev => !prev)}
                    className="border-slate-700 text-slate-400 hover:bg-slate-800 px-3"
                    title={ttsEnabled ? 'Desactivar voz' : 'Activar voz'}
                  >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>

                <p className="text-sm text-slate-400 -mt-2">
                  Tu asistente ejecutiva de correo. Elige cómo quieres trabajar hoy.
                </p>

                {/* SELECTOR DE MODO */}
                <div className="grid grid-cols-2 gap-4">

                  <button
                    onClick={handsFreeModeActive ? cancel : undefined}
                    className={`rounded-xl p-5 text-left border transition-all duration-300 ${!handsFreeModeActive
                        ? 'bg-blue-600/15 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 cursor-pointer'
                      }`}
                  >
                    <div className="text-2xl mb-3">🖥️</div>
                    <p className="text-sm font-medium text-white mb-1">Modo Escritorio</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Usa los botones de la app. Resume y responde correos con un clic.
                    </p>
                    {!handsFreeModeActive && (
                      <div className="mt-3 text-xs text-blue-400 font-medium">● Activo</div>
                    )}
                  </button>

                  <button
                    onClick={handsFreeModeActive ? cancel : activateHandsFreeMode}
                    className={`rounded-xl p-5 text-left border transition-all duration-300 ${handsFreeModeActive
                        ? 'bg-emerald-600/15 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 cursor-pointer'
                      }`}
                  >
                    <div className="text-2xl mb-3">🎧</div>
                    <p className="text-sm font-medium text-white mb-1">Manos Libres</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Lucy te lee la bandeja en voz alta. Ideal para el coche o mientras corres.
                    </p>
                    {handsFreeModeActive && (
                      <div className="mt-3 text-xs text-emerald-400 font-medium animate-pulse">● Activo — di "para" para salir</div>
                    )}
                  </button>

                </div>

                {/* RESPUESTA DE LUCY */}
                {lastInteraction && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm leading-relaxed">
                    <span className="text-slate-500 text-xs block mb-1">Lucy</span>
                    {lastInteraction}
                  </div>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}