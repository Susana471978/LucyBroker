import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import axios from 'axios';
import { Mail, Inbox, CheckCircle, Clock, Paperclip, ArrowRight, Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ icon, label, value, highlight, onClick, testId }) => {
  let baseClass = 'glass-subtle rounded-xl p-4 text-left w-full ';
  if (highlight) baseClass += 'border-blue-500/30 halo-active';
  let iconClass = 'w-10 h-10 rounded-lg flex items-center justify-center mb-3 ';
  iconClass += highlight ? 'bg-blue-500/20' : 'bg-slate-700/50';
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick} className={baseClass} data-testid={testId}>
      <div className={iconClass}>
        <span className={highlight ? 'text-blue-400' : 'text-slate-400'}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </motion.button>
  );
};

export default function OverviewPage() {
  const { language } = useAuth();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const emailsRes = await axios.get(`${API}/emails`);
      const statsRes = await axios.get(`${API}/emails/stats/summary`);
      setEmails(emailsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const response = await axios.post(`${API}/ai/chat`, { message: aiInput });
      setAiResponse(response.data);
      if (response.data.action && response.data.action.type === 'filter') {
        const params = new URLSearchParams();
        if (response.data.action.payload.label) params.set('label', response.data.action.payload.label);
        if (response.data.action.payload.has_attachments) params.set('attachments', 'true');
        navigate('/messages?' + params.toString());
      }
    } catch (error) {
      console.error('AI chat error:', error);
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  const priorityEmails = emails.filter(e => e.priority.priority_label === 'PRIORITARIO').slice(0, 3);
  const hasPriorityItems = priorityEmails.length > 0;

  const getPriorityLabel = (label) => {
    if (label === 'PRIORITARIO') return t(language, 'prioritario');
    if (label === 'SEGUIMIENTO') return t(language, 'seguimiento');
    return t(language, 'informativo');
  };

  const getPriorityClass = (label) => {
    if (label === 'PRIORITARIO') return 'priority-high';
    if (label === 'SEGUIMIENTO') return 'priority-medium';
    return 'priority-low';
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4 tracking-tight">{t(language, 'welcomeTitle')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl">{t(language, 'welcomeSubtitle')}</p>
        </motion.div>

        {stats && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Inbox className="w-5 h-5" strokeWidth={1.5} />} label={t(language, 'allEmails')} value={stats.total} onClick={() => navigate('/messages')} testId="stat-total" />
            <StatCard icon={<Mail className="w-5 h-5" strokeWidth={1.5} />} label={t(language, 'priority')} value={stats.prioritarios} highlight onClick={() => navigate('/messages?label=PRIORITARIO')} testId="stat-priority" />
            <StatCard icon={<Clock className="w-5 h-5" strokeWidth={1.5} />} label={t(language, 'followUp')} value={stats.seguimiento} onClick={() => navigate('/messages?label=SEGUIMIENTO')} testId="stat-followup" />
            <StatCard icon={<Paperclip className="w-5 h-5" strokeWidth={1.5} />} label={t(language, 'attachments')} value={stats.with_attachments} onClick={() => navigate('/messages?attachments=true')} testId="stat-attachments" />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-premium rounded-2xl p-6 mb-8 halo-card-ia ai-card" data-testid="overview-ai-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Asistente IA</h3>
              <p className="text-sm text-slate-400">¿Qué correos quieres ver?</p>
            </div>
          </div>
          <form onSubmit={handleAiSubmit} className="flex gap-3">
            <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={t(language, 'aiPlaceholder')} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500" data-testid="overview-ai-input" />
            <Button type="submit" disabled={aiLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-4" data-testid="overview-ai-submit">
              {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" strokeWidth={1.5} />}
            </Button>
          </form>
          {aiResponse && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700" data-testid="overview-ai-response">
              <p className="text-slate-300">{aiResponse.assistant_text}</p>
            </motion.div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {loading ? (
            <div className="glass-subtle rounded-2xl p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
              <p className="mt-4 text-slate-400">{t(language, 'loading')}</p>
            </div>
          ) : hasPriorityItems ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-100">{t(language, 'priorityItems')}</h2>
                <Button variant="ghost" onClick={() => navigate('/messages?label=PRIORITARIO')} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" data-testid="view-all-priority">
                  Ver todos <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="space-y-4">
                {priorityEmails.map((item, index) => (
                  <motion.div key={item.email.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * index }} className="glass-subtle rounded-xl p-4 hover:bg-slate-800/60 cursor-pointer email-card" onClick={() => navigate('/messages?selected=' + item.email.id)} data-testid={'priority-item-' + index}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={'px-2 py-0.5 rounded text-xs font-medium ' + getPriorityClass(item.priority.priority_label)}>{getPriorityLabel(item.priority.priority_label)}</span>
                          {item.email.has_attachments && <Paperclip className="w-4 h-4 text-slate-500" strokeWidth={1.5} />}
                        </div>
                        <h3 className="text-slate-100 font-medium truncate mb-1">{item.email.subject}</h3>
                        <p className="text-sm text-slate-400">{item.email.from_name} • {new Date(item.email.date).toLocaleDateString()}</p>
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{item.email.snippet}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-400">{item.priority.priority_score}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-subtle rounded-2xl p-12 text-center silence-mode" data-testid="silence-mode">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">{t(language, 'silenceMode')}</h3>
              <p className="text-slate-400">{t(language, 'silenceModeDesc')}</p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
