import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import axios from 'axios';
import {
  Mail,
  Inbox,
  CheckCircle,
  Clock,
  Paperclip,
  Sparkles,
  Send,
  Loader2,
  Link2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

/* ---------- Stat Card ---------- */
const StatCard = ({ icon, label, value, highlight, onClick }) => {
  let baseClass =
    'glass-subtle rounded-xl p-4 text-left w-full cursor-pointer transition-shadow hover:shadow-lg hover:shadow-blue-500/5 ';
  if (highlight) baseClass += 'border-blue-500/30 halo-active';

  let iconClass =
    'w-10 h-10 rounded-lg flex items-center justify-center mb-3 ';
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
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </motion.button>
  );
};

/* ---------- PAGE ---------- */
export default function OverviewPage() {
  const { language, token } = useAuth();
  const navigate = useNavigate();

  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailLoading, setGmailLoading] = useState(true);

  /* ---------- DATA ---------- */
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const emailsRes = await axios.get(`${API}/gmail/messages`, { headers });
      const emailsData = emailsRes.data?.data || emailsRes.data || [];

      setEmails(Array.isArray(emailsData) ? emailsData : []);

      const list = Array.isArray(emailsData) ? emailsData : [];
      setStats({
        total: list.length,
        prioritarios: list.filter(
          e => e.priority?.priority_label === 'PRIORITARIO'
        ).length,
        seguimiento: list.filter(
          e => e.priority?.priority_label === 'SEGUIMIENTO'
        ).length,
        with_attachments: list.filter(e => e.email?.has_attachments).length,
      });
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  /* ---------- GMAIL STATUS ---------- */
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

  /* ---------- GMAIL CONNECT ---------- */
  const handleGmailConnect = async () => {
    try {
      const res = await axios.get(`${API}/gmail/auth`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = res.data?.data?.auth_url || res.data?.auth_url;
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Gmail auth error:', err);
    }
  };

  /* ---------- IA (A2 FINAL) ---------- */
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || !token) return;

    setAiLoading(true);

    try {
      const res = await axios.post(
        `${API}/assistant`,
        { text: aiInput },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = res.data;
      setAiResponse(payload);

      // 🔥 Ejecutar acciones devueltas por el asistente
      if (payload?.actions?.length) {
        payload.actions.forEach(action => {
          if (action.type === 'navigate') {
            const { path, filter } = action.payload;
            const query = filter ? `?filter=${filter}` : '';
            navigate(`${path}${query}`);
          }
        });
      }

    } catch (err) {
      console.error('AI error:', err);
      setAiResponse({
        assistant_text: 'Ha ocurrido un error al contactar con el asistente.',
      });
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  /* ---------- PRIORITY ---------- */
  const priorityEmails = emails
    .filter((e) => e.priority?.priority_label === 'PRIORITARIO')
    .slice(0, 3);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4">
            {t(language, 'welcomeTitle')}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            {t(language, 'welcomeSubtitle')}
          </p>
        </motion.div>

        {/* GMAIL CONNECTION */}
        {!gmailLoading && (
          <div className="glass-subtle rounded-xl p-4 mb-8 flex items-center justify-between">
            {gmailConnected ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-slate-200 text-sm font-medium">
                  Correo conectado:{' '}
                  <span className="text-blue-400">{gmailEmail}</span>
                </span>
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

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Inbox />}
            label={t(language, 'allEmails')}
            value={stats?.total ?? 0}
            onClick={() => navigate('/app/messages?filter=all')}
          />
          <StatCard
            icon={<Mail />}
            label={t(language, 'priority')}
            value={stats?.prioritarios ?? 0}
            highlight
            onClick={() => navigate('/app/messages?filter=priority')}
          />
          <StatCard
            icon={<Clock />}
            label={t(language, 'followUp')}
            value={stats?.seguimiento ?? 0}
            onClick={() => navigate('/app/messages?filter=followup')}
          />
          <StatCard
            icon={<Paperclip />}
            label={t(language, 'attachments')}
            value={stats?.with_attachments ?? 0}
            onClick={() => navigate('/app/messages?filter=attachments')}
          />
        </div>

        {/* IA CARD */}
        <div className="glass-premium rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Asistente IA
            </h3>
          </div>

          <form onSubmit={handleAiSubmit} className="flex gap-3">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Escribe qué necesitas…"
            />
            <Button type="submit" disabled={aiLoading}>
              {aiLoading ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>

          {aiResponse?.assistant_text && (
            <div className="mt-4 text-slate-300">
              {aiResponse.assistant_text}
            </div>
          )}
        </div>

        {/* SILENCE MODE */}
        {!loading && priorityEmails.length === 0 && (
          <div className="glass-subtle rounded-2xl p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <p className="text-slate-400">
              Nada requiere acción inmediata
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
