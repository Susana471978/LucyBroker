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
  CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

/* ---------- Stat Card ---------- */
const StatCard = ({ icon, label, value, highlight, onClick }) => {
  let baseClass = 'glass-subtle rounded-xl p-4 text-left w-full ';
  if (highlight) baseClass += 'border-blue-500/30 halo-active';

  let iconClass = 'w-10 h-10 rounded-lg flex items-center justify-center mb-3 ';
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

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  /* ---------- DATA ---------- */
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [emailsRes, statsRes] = await Promise.all([
        axios.get(`${API}/emails`, { headers }),
        axios.get(`${API}/emails/stats/summary`, { headers })
      ]);

      setEmails(emailsRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  /* ---------- IA ---------- */
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || !token) return;

    setAiLoading(true);
    try {
      const res = await axios.post(
        `${API}/ai/chat`,
        { message: aiInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const payload = res.data?.data || res.data;
      setAiResponse(payload);

      if (payload?.action?.type === 'filter') {
        const params = new URLSearchParams(payload.action.payload);
        navigate('/messages?' + params.toString());
      }
    } catch (err) {
      console.error('AI error:', err);
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  /* ---------- STRIPE CHECKOUT (FIXED) ---------- */
  const startCheckout = async () => {
    if (!token) {
      alert('No hay sesión activa');
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await axios.post(
        `${API}/billing/checkout?plan=monthly`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const checkoutUrl =
        res.data?.data?.checkout_url ||
        res.data?.checkout_url;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else {
        console.error('No checkout URL in response:', res.data);
      }
    } catch (err) {
      console.error('Stripe checkout error:', err.response?.data || err);
      alert('Error conectando con Stripe');
    } finally {
      setCheckoutLoading(false);
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

        {/* STRIPE BUTTON */}
        <div className="mb-10">
          <Button
            onClick={startCheckout}
            disabled={checkoutLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
          >
            {checkoutLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CreditCard className="w-4 h-4" />
            }
            Activar suscripción
          </Button>
        </div>

        {/* STATS */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Inbox />}
              label={t(language, 'allEmails')}
              value={stats.total}
              onClick={() => navigate('/messages')}
            />
            <StatCard
              icon={<Mail />}
              label={t(language, 'priority')}
              value={stats.prioritarios}
              highlight
              onClick={() => navigate('/messages?label=PRIORITARIO')}
            />
            <StatCard
              icon={<Clock />}
              label={t(language, 'followUp')}
              value={stats.seguimiento}
              onClick={() => navigate('/messages?label=SEGUIMIENTO')}
            />
            <StatCard
              icon={<Paperclip />}
              label={t(language, 'attachments')}
              value={stats.with_attachments}
              onClick={() => navigate('/messages?attachments=true')}
            />
          </div>
        )}

        {/* IA CARD */}
        <div className="glass-premium rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-100">Asistente IA</h3>
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

          {aiResponse && (
            <div className="mt-4 text-slate-300">
              {aiResponse.assistant_text}
            </div>
          )}
        </div>

        {/* SILENCE MODE */}
        {!loading && priorityEmails.length === 0 && (
          <div className="glass-subtle rounded-2xl p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <p className="text-slate-400">Nada requiere acción inmediata</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
