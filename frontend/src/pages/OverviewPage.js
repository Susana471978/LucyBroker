import { Volume2, VolumeX, Radio } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { t } from '../i18n';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Clock, Paperclip, Sparkles, Link2, Calendar, Brain, Plus, X, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import Layout from '../components/Layout';
import { disconnectGmail } from '../services/mailService';
import { getCalendarStatus, connectCalendar, disconnectCalendar, getTodayEvents, formatEventTime } from '../services/calendarService';
import CalendarDrawer from '../components/CalendarDrawer';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

function WelcomeOverlay({ onStart, onSkip, greeting }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPulse(true), 400); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4,4,8,0.97)', backdropFilter: 'blur(40px)' }}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-sm w-full mx-8 text-center flex flex-col items-center gap-10">
        <div className="relative flex items-center justify-center">
          {pulse && (<>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.6, 2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
              className="absolute w-24 h-24 rounded-full border border-[#C9B27C]" />
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 0.1, 0], scale: [0.8, 1.4, 1.8] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
              className="absolute w-24 h-24 rounded-full border border-[#C9B27C]" />
          </>)}
          <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center bg-[rgba(201,178,124,0.08)] border border-[rgba(201,178,124,0.25)] shadow-[0_0_60px_rgba(201,178,124,0.12)]">
            <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill="#C9B27C" />
            </svg>
          </div>
        </div>
        <div className="space-y-3">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
            className="text-xs text-[rgba(255,255,255,0.25)] uppercase tracking-[0.18em]">{greeting}</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
            className="text-white font-light leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontStyle: 'italic' }}>
            Soy Lucy, tu secretaria.</motion.h2>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
            className="text-sm text-[rgba(255,255,255,0.3)] leading-relaxed">
            Tengo tu briefing listo.<br />Toca para escucharlo.</motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }}
          className="flex flex-col items-center gap-4 w-full">
          <button onClick={onStart} className="group relative w-full py-4 rounded-2xl bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] text-[#C9B27C] text-sm uppercase tracking-[0.12em] font-medium hover:bg-[rgba(201,178,124,0.18)] hover:border-[rgba(201,178,124,0.5)] hover:shadow-[0_0_40px_rgba(201,178,124,0.15)] transition-all duration-300 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.4)] to-transparent" />
            <span className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Escuchar briefing
            </span>
          </button>
          <button onClick={onSkip} className="text-xs text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.4)] uppercase tracking-[0.1em] transition-colors duration-200">Entrar sin audio →</button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function BriefingOverlay({ text, onDismiss, isSpeaking }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(6,6,8,0.92)', backdropFilter: 'blur(24px)' }}>
      <motion.div initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-xl w-full mx-6 text-center flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center">
          {isSpeaking && (<>
            <div className="absolute w-24 h-24 rounded-full border border-[rgba(201,178,124,0.15)] animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute w-16 h-16 rounded-full border border-[rgba(201,178,124,0.25)] animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
          </>)}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] transition-all duration-500 ${isSpeaking ? 'shadow-[0_0_40px_rgba(201,178,124,0.2)]' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={isSpeaking ? '#C9B27C' : 'rgba(201,178,124,0.6)'} />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-xs text-[rgba(255,255,255,0.25)] uppercase tracking-[0.15em] mb-2">Briefing matutino</p>
          <p className="text-xs text-[rgba(201,178,124,0.5)] uppercase tracking-[0.1em]">{isSpeaking ? 'Lucy está hablando…' : 'Briefing listo'}</p>
        </div>
        {text && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="font-light text-[rgba(255,255,255,0.75)] leading-relaxed text-xl max-w-md"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>"{text}"</motion.p>
        )}
        {isSpeaking && (
          <div className="flex items-end gap-1 h-6">
            {[...Array(7)].map((_, i) => (
              <motion.div key={i} className="w-1 rounded-full bg-[#C9B27C]"
                animate={{ height: ['4px', `${10 + i * 3}px`, '4px'] }}
                transition={{ duration: 0.5 + i * 0.08, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
                style={{ opacity: 0.4 + i * 0.08 }} />
            ))}
          </div>
        )}
        <button onClick={onDismiss} className="text-xs text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.45)] uppercase tracking-[0.12em] transition-colors duration-200 mt-1">
          {isSpeaking ? 'Saltar →' : 'Entrar al panel →'}
        </button>
      </motion.div>
    </motion.div>
  );
}

const MEMORY_CATEGORIES = [
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'preferencia', label: 'Preferencia' },
  { value: 'general', label: 'General' },
];

const CAT_STYLES = {
  proyecto: { dot: 'bg-blue-400', label: 'Proyecto', text: 'text-blue-400', border: 'border-[rgba(96,165,250,0.15)]' },
  cliente: { dot: 'bg-[#C9B27C]', label: 'Cliente', text: 'text-[#C9B27C]', border: 'border-[rgba(201,178,124,0.15)]' },
  preferencia: { dot: 'bg-purple-400', label: 'Preferencia', text: 'text-purple-400', border: 'border-[rgba(192,132,252,0.15)]' },
  general: { dot: 'bg-[rgba(255,255,255,0.2)]', label: 'General', text: 'text-[rgba(255,255,255,0.3)]', border: 'border-[rgba(255,255,255,0.06)]' },
};

function MemorySection() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/memory')
      .then(res => setNotes(res.data?.data?.notes || res.data?.notes || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.post('/memory', { text: text.trim(), category });
      setNotes(res.data?.data?.notes || res.data?.notes || []);
      setText(''); setShowForm(false);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiClient.delete(`/memory/${id}`);
      setNotes(res.data?.data?.notes || res.data?.notes || []);
    } catch (e) { console.error(e); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{ background: 'rgba(201,178,124,0.02)', border: '1px solid rgba(201,178,124,0.14)' }}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.6)] to-transparent" />
      <div className="px-4 sm:px-8 pt-7 pb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,178,124,0.07)', border: '1px solid rgba(201,178,124,0.18)' }}>
            <Brain className="w-4 h-4 text-[rgba(201,178,124,0.7)]" />
          </div>
          <div>
            <p className="text-xs text-[rgba(255,255,255,0.25)] uppercase tracking-[0.15em]">Memoria de Lucy</p>
            <p className="text-xs text-[rgba(255,255,255,0.12)] mt-0.5"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
              Lo que Lucy sabe de ti — siempre presente en cada respuesta.
            </p>
          </div>
        </div>
        {(!loading && notes.length > 0 || showForm) && (
          <button
            onClick={() => setShowForm(p => !p)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] uppercase tracking-[0.1em] border transition-all duration-200 flex-shrink-0 ${showForm ? 'bg-[rgba(201,178,124,0.1)] border-[rgba(201,178,124,0.3)] text-[#C9B27C]' : 'bg-transparent border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.2)] hover:text-[#C9B27C] hover:border-[rgba(201,178,124,0.2)]'}`}>
            <Plus className="w-3 h-3" />
            Añadir memoria
          </button>
        )}
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[rgba(201,178,124,0.08)]">
            <div className="px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-start gap-3 sm:gap-6">
              <textarea
                autoFocus value={text} onChange={e => setText(e.target.value)}
                placeholder="Ej: Emergent es mi cliente más importante y prefieren comunicación directa…"
                rows={2}
                className="flex-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(201,178,124,0.12)] rounded-xl px-4 py-3 text-sm text-[rgba(255,255,255,0.6)] placeholder:text-[rgba(255,255,255,0.1)] resize-none outline-none focus:border-[rgba(201,178,124,0.3)] transition-all leading-relaxed"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }} />
              <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {MEMORY_CATEGORIES.map(c => {
                    const s = CAT_STYLES[c.value] || CAT_STYLES.general;
                    return (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-[0.08em] border transition-all ${category === c.value ? `${s.text} bg-[rgba(255,255,255,0.04)] ${s.border}` : 'text-[rgba(255,255,255,0.18)] border-transparent hover:border-[rgba(255,255,255,0.06)]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleAdd} disabled={saving || !text.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs uppercase tracking-[0.08em] bg-[rgba(201,178,124,0.08)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)] hover:bg-[rgba(201,178,124,0.14)] transition-all disabled:opacity-30">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="border-t border-[rgba(201,178,124,0.06)]">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-4 h-4 text-[rgba(201,178,124,0.3)] animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-10">
            <div className="flex-1">
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '1.15rem' }}
                className="text-[rgba(255,255,255,0.28)] leading-relaxed mb-1.5">
                Todo lo que me cuentes, lo usaré para trabajar mejor para ti.
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.1)] leading-relaxed max-w-lg">
                Tus preferencias, clientes clave, proyectos activos — Lucy los tendrá siempre en mente al responder.
              </p>
            </div>
            <button onClick={() => setShowForm(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-[0.1em] text-[rgba(201,178,124,0.5)] hover:text-[#C9B27C] border border-[rgba(201,178,124,0.12)] hover:border-[rgba(201,178,124,0.3)] hover:bg-[rgba(201,178,124,0.05)] transition-all">
              <Plus className="w-3.5 h-3.5" />
              Primera memoria
            </button>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {notes.map((note, i) => {
                const s = CAT_STYLES[note.category] || CAT_STYLES.general;
                return (
                  <motion.div key={note.id}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className={`group flex items-start gap-3 px-4 py-3 rounded-xl border ${s.border} hover:bg-[rgba(255,255,255,0.02)] transition-all`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${s.dot}`} />
                    <p className="flex-1 text-sm text-[rgba(255,255,255,0.45)] leading-relaxed"
                      style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                      {note.text}
                    </p>
                    <button onClick={() => handleDelete(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-[rgba(255,255,255,0.1)] hover:text-[rgba(255,100,100,0.5)] transition-all flex-shrink-0 mt-1">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function OverviewPage() {
  const { language, token, user } = useAuth();
  const navigate = useNavigate();
  const { ttsEnabled, setTtsEnabled, wakeWordEnabled, setWakeWordEnabled, wakeWordActive, handsFreeModeActive, activateHandsFreeMode, lastInteraction, cancel } = useVoice();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailLoading, setGmailLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [todayEvents, setTodayEvents] = useState([]);
  const [radar, setRadar] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [briefingVisible, setBriefingVisible] = useState(false);
  const [briefingText, setBriefingText] = useState('');
  const [briefingIsSpeaking, setBriefingIsSpeaking] = useState(false);
  const briefingDoneRef = useRef(false);
  const briefingAudioRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const emailsRes = await axios.get(`${API}/gmail/messages`, { headers });
      const emailsData = emailsRes.data?.data || emailsRes.data || [];
      const list = Array.isArray(emailsData) ? emailsData : [];
      setStats({
        total: list.length,
        prioritarios: list.filter(e => e.priority?.priority_label === 'PRIORITARIO').length,
        seguimiento: list.filter(e => e.priority?.priority_label === 'SEGUIMIENTO').length,
        with_attachments: list.filter(e => e.email?.has_attachments).length,
      });
    } catch { setStats(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/gmail/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { const d = res.data?.data || res.data; setGmailConnected(!!d.gmail_connected); setGmailEmail(d.gmail_email || ''); })
      .catch(console.error).finally(() => setGmailLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const checkCalendar = async () => {
      try {
        const status = await getCalendarStatus();
        setCalendarConnected(!!status.calendar_connected);
        if (status.calendar_connected) {
          const events = await getTodayEvents();
          setTodayEvents(Array.isArray(events) ? events : []);
        }
      } catch (err) { console.error('Calendar:', err); }
      finally { setCalendarLoading(false); }
    };
    checkCalendar();
  }, [token]);

  useEffect(() => { if (token) fetchData(); }, [fetchData, token]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/contacts/radar?days_silent=5&limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { const d = res.data?.data || res.data; setRadar(Array.isArray(d) ? d : []); })
      .catch(() => setRadar([]));
  }, [token]);

  useEffect(() => {
    if (!token || gmailLoading || !gmailConnected || loading || briefingDoneRef.current) return;
    const todayKey = `lucy_briefing_${new Date().toDateString()}`;
    if (sessionStorage.getItem(todayKey)) return;
    briefingDoneRef.current = true;
    const timer = setTimeout(() => setShowWelcome(true), 800);
    return () => clearTimeout(timer);
  }, [token, gmailLoading, gmailConnected, loading]);

  const runBriefing = useCallback(async (promptText = 'buenos dias Lucy, dame mi briefing matutino') => {
    setShowWelcome(false); setBriefingVisible(true); setBriefingIsSpeaking(true); setBriefingText('');
    setWakeWordEnabled(false);
    sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
    try {
      const res = await axios.post(`${API}/assistant`, { text: promptText }, { headers: { Authorization: `Bearer ${token}` } });
      const text = res.data?.assistant_text || res.data?.data?.assistant_text || '';
      setBriefingText(text);
      if (text && ttsEnabled) {
        const ttsRes = await fetch(`${API}/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
        if (ttsRes.ok) {
          const audio = new Audio(URL.createObjectURL(await ttsRes.blob()));
          briefingAudioRef.current = audio;
          audio.onended = () => { setBriefingIsSpeaking(false); setWakeWordEnabled(true); briefingAudioRef.current = null; };
          audio.onerror = () => { setBriefingIsSpeaking(false); setWakeWordEnabled(true); briefingAudioRef.current = null; };
          await audio.play();
        } else { setBriefingIsSpeaking(false); }
      } else { setBriefingIsSpeaking(false); }
    } catch { setBriefingIsSpeaking(false); }
  }, [token, ttsEnabled, setWakeWordEnabled]);

  const handleSkip = () => {
    sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
    setShowWelcome(false);
  };

  // ── FIX: comando de voz "parar" / "silencio" detiene el briefing ────────
  useEffect(() => {
    if (!lastInteraction) return;
    const txt = lastInteraction.toLowerCase();
    const isStop = ['parar', 'para', 'silencio', 'detén', 'detente', 'stop', 'calla', 'basta'].some(c => txt.includes(c));
    if (isStop) {
      if (briefingAudioRef.current) {
        briefingAudioRef.current.pause();
        briefingAudioRef.current = null;
      }
      setBriefingIsSpeaking(false);
      setBriefingVisible(false);
      cancel();
    }
  }, [lastInteraction, cancel]);

  const dismissBriefing = () => {
    if (briefingAudioRef.current) { briefingAudioRef.current.pause(); briefingAudioRef.current = null; }
    setBriefingVisible(false);
    setBriefingIsSpeaking(false);
  };

  const handleGmailConnect = async () => {
    try { const res = await axios.get(`${API}/gmail/auth`, { headers: { Authorization: `Bearer ${token}` } }); const url = res.data?.data?.auth_url || res.data?.auth_url; if (url) window.location.href = url; } catch (err) { console.error(err); }
  };
  const handleDisconnect = async () => {
    try { await disconnectGmail(); setGmailConnected(false); setGmailEmail(''); setStats({ total: 0, prioritarios: 0, seguimiento: 0, with_attachments: 0 }); } catch (err) { console.error(err); }
  };
  const handleCalendarConnect = async () => { try { await connectCalendar(); } catch (err) { console.error(err); } };
  const handleCalendarDisconnect = async () => { try { await disconnectCalendar(); setCalendarConnected(false); setTodayEvents([]); } catch (err) { console.error(err); } };

  const getGreeting = () => { const h = new Date().getHours(); if (h < 12) return 'Buenos dias'; if (h < 20) return 'Buenas tardes'; return 'Buenas noches'; };
  const formatDate = () => new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const userName = user?.name?.split(' ')[0] || '';
  const isReady = !loading && !gmailLoading && gmailConnected;

  return (
    <Layout>
      <CalendarDrawer open={showCalendar} onClose={() => setShowCalendar(false)} />
      <AnimatePresence>
        {showWelcome && <WelcomeOverlay greeting={getGreeting()} onStart={() => runBriefing()} onSkip={handleSkip} />}
      </AnimatePresence>
      <AnimatePresence>
        {briefingVisible && <BriefingOverlay text={briefingText} isSpeaking={briefingIsSpeaking} onDismiss={dismissBriefing} />}
      </AnimatePresence>

      <div className="min-h-screen" style={{ background: '#080A0F' }}>

        {/* CABECERA EDITORIAL */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, ease: 'easeOut' }}
          className="relative border-b border-[rgba(201,178,124,0.08)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9B27C] to-transparent opacity-40" />
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(201,178,124,0.5) 40px, rgba(201,178,124,0.5) 41px)`
          }} />
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 relative">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
              className="flex items-center justify-between mb-6 sm:mb-8 flex-wrap gap-3">
              <p className="text-xs text-[rgba(201,178,124,0.5)] uppercase tracking-[0.2em] font-medium capitalize">{formatDate()}</p>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

                {/* ── FIX: botón silencio para el audio activo ── */}
                <button
                  onClick={() => {
                    if (ttsEnabled) {
                      if (briefingAudioRef.current) {
                        briefingAudioRef.current.pause();
                        briefingAudioRef.current = null;
                      }
                      setBriefingIsSpeaking(false);
                      setBriefingVisible(false);
                      cancel();
                    }
                    setTtsEnabled(prev => !prev);
                  }}
                  className={`flex items-center gap-2 text-xs uppercase tracking-[0.1em] transition-all duration-200 px-3 py-1.5 rounded-lg border ${ttsEnabled ? 'text-[#C9B27C] border-[rgba(201,178,124,0.2)] bg-[rgba(201,178,124,0.06)]' : 'text-[rgba(255,255,255,0.2)] border-[rgba(255,255,255,0.06)]'}`}>
                  {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  <span>Voz</span>
                </button>

                <button onClick={() => runBriefing('repite mi briefing matutino')}
                  className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[rgba(255,255,255,0.2)] hover:text-[rgba(201,178,124,0.6)] transition-colors px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,178,124,0.15)]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                  <span>Briefing</span>
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.15em] mb-3">{getGreeting()}</p>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.1 }}
                className="text-white mb-4">
                {userName && <>{userName},<br /></>}
                <span className="italic text-[rgba(255,255,255,0.55)]">tu dia esta listo.</span>
              </h1>
            </motion.div>

            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="origin-left h-px bg-gradient-to-r from-[rgba(201,178,124,0.4)] via-[rgba(201,178,124,0.1)] to-transparent mt-8" />
          </div>
        </motion.div>

        {/* CUERPO */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">

          {!gmailLoading && !gmailConnected && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
              className="mb-10 rounded-2xl p-5 sm:p-8 border border-[rgba(201,178,124,0.12)] bg-[rgba(201,178,124,0.03)]">
              <p className="text-xs text-[rgba(201,178,124,0.5)] uppercase tracking-[0.15em] mb-3">Para empezar</p>
              <p className="text-[rgba(255,255,255,0.45)] leading-relaxed mb-6"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontStyle: 'italic' }}>
                Conecta tu correo y Lucy revisara tu bandeja, priorizara lo que importa y te preparara un briefing cada manana.
              </p>
              <button onClick={handleGmailConnect}
                className="inline-flex items-center gap-2 text-sm text-[#C9B27C] border border-[rgba(201,178,124,0.3)] px-5 py-2.5 rounded-xl bg-[rgba(201,178,124,0.06)] hover:bg-[rgba(201,178,124,0.12)] hover:border-[rgba(201,178,124,0.5)] transition-all duration-200">
                <Link2 className="w-3.5 h-3.5" />Conectar correo
              </button>
            </motion.div>
          )}

          {isReady && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Columna izquierda */}
                <div className="lg:col-span-2 space-y-5">

                  {/* Carta de Lucy */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="relative rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.35)] to-transparent" />
                    <div className="p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)] transition-all duration-500 ${wakeWordActive ? 'shadow-[0_0_20px_rgba(201,178,124,0.3)]' : ''}`}>
                          <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
                            <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={wakeWordActive ? '#C9B27C' : 'rgba(201,178,124,0.7)'} />
                          </svg>
                          {wakeWordActive && <div className="absolute -inset-1 rounded-2xl border border-[rgba(201,178,124,0.3)] animate-ping" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Lucy</p>
                          <p className="text-xs text-[rgba(255,255,255,0.25)]">
                            {wakeWordActive ? 'Escuchando...' : wakeWordEnabled ? 'Di "Hola Lucy"' : 'Tu secretaria personal'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-7">
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.75, fontStyle: 'italic' }}
                          className="text-[rgba(255,255,255,0.6)]">
                          {stats.total === 0 ? (
                            <>Tu bandeja esta vacia. Sin pendientes.</>
                          ) : stats.prioritarios > 0 ? (
                            <>Tienes <span className="text-[#C9B27C] not-italic font-medium">{stats.total} mensajes</span> en tu bandeja.{' '}
                              <span className="text-white not-italic">{stats.prioritarios} requieren tu atencion</span> hoy.{stats.seguimiento > 0 && <> {stats.seguimiento} en seguimiento.</>}</>
                          ) : (
                            <>Tienes <span className="text-[#C9B27C] not-italic font-medium">{stats.total} mensajes</span> en tu bandeja.{stats.seguimiento > 0 && <> <span className="text-white not-italic">{stats.seguimiento} en seguimiento</span>.</>}</>
                          )}
                        </p>
                        {calendarConnected && (
                          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.75, fontStyle: 'italic' }}
                            className="text-[rgba(255,255,255,0.6)]">
                            {todayEvents.length === 0 ? (
                              <>Tu agenda esta libre hoy.</>
                            ) : todayEvents.length === 1 ? (
                              <>Un compromiso en agenda: <span className="text-white not-italic">{todayEvents[0].title}</span>{!todayEvents[0].all_day && <> a las <span className="text-[#C9B27C] not-italic">{formatEventTime(todayEvents[0].start)}</span></>}.</>
                            ) : (
                              <><span className="text-[#C9B27C] not-italic font-medium">{todayEvents.length} eventos</span> en agenda. Primero: <span className="text-white not-italic">{todayEvents[0].title}</span>{!todayEvents[0].all_day && <> a las <span className="text-[#C9B27C] not-italic">{formatEventTime(todayEvents[0].start)}</span></>}.</>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent mb-6" />

                      {/* Modos */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-[rgba(255,255,255,0.12)] uppercase tracking-[0.18em] mb-3">Cómo quieres trabajar hoy</p>
                        <button
                          onClick={handsFreeModeActive ? cancel : undefined}
                          className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-300 ${!handsFreeModeActive ? 'bg-[rgba(201,178,124,0.05)] border-[rgba(201,178,124,0.2)]' : 'bg-transparent border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)]'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${!handsFreeModeActive ? 'bg-[rgba(201,178,124,0.12)] border border-[rgba(201,178,124,0.25)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={!handsFreeModeActive ? '#C9B27C' : 'rgba(255,255,255,0.25)'} strokeWidth="1.8">
                                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className={`text-sm transition-colors duration-200 ${!handsFreeModeActive ? 'text-[rgba(255,255,255,0.8)]' : 'text-[rgba(255,255,255,0.3)]'}`}>Escritorio</p>
                              <p className="text-[11px] text-[rgba(255,255,255,0.18)] mt-0.5">Revisión visual, resúmenes al pulsar</p>
                            </div>
                          </div>
                          {!handsFreeModeActive && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C9B27C] shadow-[0_0_6px_rgba(201,178,124,0.7)]" />
                              <span className="text-[10px] text-[#C9B27C] uppercase tracking-[0.1em]">Activo</span>
                            </div>
                          )}
                        </button>

                        <button
                          onClick={handsFreeModeActive ? cancel : activateHandsFreeMode}
                          className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-300 ${handsFreeModeActive ? 'bg-[rgba(52,211,153,0.04)] border-[rgba(52,211,153,0.18)]' : 'bg-transparent border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)]'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${handsFreeModeActive ? 'bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.2)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={handsFreeModeActive ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.25)'} strokeWidth="1.8">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className={`text-sm transition-colors duration-200 ${handsFreeModeActive ? 'text-[rgba(255,255,255,0.8)]' : 'text-[rgba(255,255,255,0.3)]'}`}>Manos libres</p>
                              <p className="text-[11px] text-[rgba(255,255,255,0.18)] mt-0.5">Lucy te lee en voz alta mientras trabajas</p>
                            </div>
                          </div>
                          {handsFreeModeActive && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse" />
                              <span className="text-[10px] text-emerald-400 uppercase tracking-[0.1em]">Activo</span>
                            </div>
                          )}
                        </button>
                      </div>

                      <AnimatePresence>
                        {lastInteraction && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-4 rounded-xl px-4 py-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                            <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.07em] mb-1.5">Lucy respondio</p>
                            <p className="text-sm text-[rgba(255,255,255,0.55)] leading-relaxed">{lastInteraction}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  {/* RADAR DE OPORTUNIDADES */}
                  <AnimatePresence>
                    {radar.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="rounded-2xl overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-[rgba(201,178,124,0.5)]" />
                            <p className="text-xs text-[rgba(255,255,255,0.3)] uppercase tracking-[0.1em]">Radar de oportunidades</p>
                          </div>
                          <p className="text-xs text-[rgba(201,178,124,0.4)]">{radar.length} contacto{radar.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="divide-y divide-[rgba(255,255,255,0.03)]">
                          {radar.map((contact, i) => (
                            <motion.div key={contact.contact_email} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.55 + i * 0.05 }}
                              className="px-6 py-4 flex items-start gap-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-medium"
                                style={{ background: contact.is_vip ? 'rgba(201,178,124,0.12)' : 'rgba(255,255,255,0.04)', color: contact.is_vip ? '#C9B27C' : 'rgba(255,255,255,0.3)', border: contact.is_vip ? '1px solid rgba(201,178,124,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                                {(contact.contact_name || contact.contact_email || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm text-[rgba(255,255,255,0.7)] truncate">{contact.contact_name || contact.contact_email}</p>
                                  {contact.is_vip && <span className="text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)] flex-shrink-0">VIP</span>}
                                  {contact.has_pending_action && <span className="text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.08)] text-red-400 border border-[rgba(239,68,68,0.15)] flex-shrink-0">Pendiente</span>}
                                </div>
                                <p className="text-xs text-[rgba(255,255,255,0.2)] truncate">{contact.reasons?.[0] || ''}</p>
                                {contact.last_subject && (
                                  <p className="text-xs text-[rgba(255,255,255,0.15)] truncate mt-0.5">"{contact.last_subject}"</p>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                {contact.days_since_contact != null && (
                                  <p className="text-xs text-[rgba(201,178,124,0.4)] tabular-nums">{contact.days_since_contact}d</p>
                                )}
                                <p className="text-xs text-[rgba(255,255,255,0.12)] mt-0.5">{contact.interaction_count}x</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Agenda de hoy */}
                  {calendarConnected && todayEvents.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
                      className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[rgba(201,178,124,0.5)]" />
                          <p className="text-xs text-[rgba(255,255,255,0.3)] uppercase tracking-[0.1em]">Agenda de hoy</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setShowCalendar(true)} className="text-xs text-[#C9B27C] hover:text-[#D4BC88] transition-colors">Ver todo →</button>
                          <p className="text-xs text-[rgba(201,178,124,0.4)]">{todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="divide-y divide-[rgba(255,255,255,0.03)]">
                        {todayEvents.map((event, i) => (
                          <motion.div key={event.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.06 }}
                            className="px-6 py-3.5 flex items-center gap-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                            <div className="w-12 text-right flex-shrink-0">
                              <span className="text-xs text-[rgba(201,178,124,0.55)] tabular-nums font-medium">
                                {event.all_day ? 'Todo el dia' : formatEventTime(event.start)}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-[rgba(201,178,124,0.15)] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[rgba(255,255,255,0.7)] truncate">{event.title}</p>
                              {event.location && <p className="text-xs text-[rgba(255,255,255,0.2)] truncate mt-0.5">{event.location}</p>}
                            </div>
                            {event.meet_link && (
                              <a href={event.meet_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                className="flex-shrink-0 text-xs text-[rgba(201,178,124,0.4)] hover:text-[#C9B27C] border border-[rgba(201,178,124,0.12)] hover:border-[rgba(201,178,124,0.3)] px-2.5 py-1 rounded-lg transition-all">
                                Meet
                              </a>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Columna derecha */}
                <div className="space-y-4">
                  <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
                    className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.04)]">
                      <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Tu bandeja</p>
                    </div>
                    <div className="divide-y divide-[rgba(255,255,255,0.03)]">
                      {[
                        { label: 'Total', value: stats.total, icon: <Inbox className="w-3.5 h-3.5" />, onClick: () => navigate('/app/messages'), gold: true },
                        { label: 'Prioritarios', value: stats.prioritarios, icon: <Sparkles className="w-3.5 h-3.5" />, onClick: () => navigate('/app/messages?filter=PRIORITARIO') },
                        { label: 'Seguimiento', value: stats.seguimiento, icon: <Clock className="w-3.5 h-3.5" />, onClick: () => navigate('/app/messages?filter=SEGUIMIENTO') },
                        { label: 'Con adjuntos', value: stats.with_attachments, icon: <Paperclip className="w-3.5 h-3.5" />, onClick: () => navigate('/app/messages?filter=attachments') },
                      ].map(({ label, value, icon, onClick, gold }) => (
                        <button key={label} onClick={onClick}
                          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                          <div className="flex items-center gap-2.5">
                            <span className={`${gold ? 'text-[rgba(201,178,124,0.5)]' : 'text-[rgba(255,255,255,0.2)]'} group-hover:text-[rgba(255,255,255,0.4)] transition-colors`}>{icon}</span>
                            <span className="text-sm text-[rgba(255,255,255,0.35)] group-hover:text-[rgba(255,255,255,0.55)] transition-colors">{label}</span>
                          </div>
                          <span className={`text-lg font-light tabular-nums ${gold ? 'text-[#C9B27C]' : 'text-[rgba(255,255,255,0.6)]'}`}>{value}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
                    className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.04)]">
                      <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Servicios</p>
                    </div>
                    <div className="p-3 space-y-1.5">

                      {/* Correo */}
                      <div className={`flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-200 ${gmailConnected ? 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.05)]' : 'border-[rgba(255,255,255,0.03)]'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${gmailConnected ? 'bg-[rgba(52,211,153,0.07)] border border-[rgba(52,211,153,0.15)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={gmailConnected ? 'rgba(52,211,153,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.8">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                            </svg>
                          </div>
                          <div>
                            <p className={`text-sm ${gmailConnected ? 'text-[rgba(255,255,255,0.6)]' : 'text-[rgba(255,255,255,0.2)]'}`}>Correo</p>
                            {gmailConnected && gmailEmail && (
                              <p className="text-[10px] text-[rgba(255,255,255,0.18)] truncate max-w-[120px]">{gmailEmail}</p>
                            )}
                          </div>
                        </div>
                        {gmailConnected ? (
                          <button onClick={handleDisconnect} className="text-[10px] text-[rgba(255,255,255,0.12)] hover:text-[rgba(255,100,100,0.4)] uppercase tracking-[0.08em] transition-colors">Desconectar</button>
                        ) : (
                          <button onClick={handleGmailConnect} className="text-[10px] text-[#C9B27C] hover:text-[#D4BC88] uppercase tracking-[0.08em] border border-[rgba(201,178,124,0.2)] px-2.5 py-1 rounded-lg bg-[rgba(201,178,124,0.05)] hover:bg-[rgba(201,178,124,0.1)] transition-all">Conectar</button>
                        )}
                      </div>

                      {/* Agenda */}
                      <div className={`flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-200 ${calendarConnected ? 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.05)]' : 'border-[rgba(255,255,255,0.03)]'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${calendarConnected ? 'bg-[rgba(52,211,153,0.07)] border border-[rgba(52,211,153,0.15)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={calendarConnected ? 'rgba(52,211,153,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.8">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>
                          <div>
                            <p className={`text-sm ${calendarConnected ? 'text-[rgba(255,255,255,0.6)]' : 'text-[rgba(255,255,255,0.2)]'}`}>Agenda</p>
                            {calendarConnected && todayEvents.length > 0 && (
                              <p className="text-[10px] text-[rgba(255,255,255,0.18)]">{todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''} hoy</p>
                            )}
                            {calendarConnected && todayEvents.length === 0 && (
                              <p className="text-[10px] text-[rgba(255,255,255,0.18)]">Libre hoy</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {calendarConnected && (
                            <button onClick={() => setShowCalendar(true)} className="text-[10px] text-[#C9B27C] hover:text-[#D4BC88] uppercase tracking-[0.08em] transition-colors">Ver</button>
                          )}
                          {calendarConnected ? (
                            <button onClick={handleCalendarDisconnect} className="text-[10px] text-[rgba(255,255,255,0.12)] hover:text-[rgba(255,100,100,0.4)] uppercase tracking-[0.08em] transition-colors">Desconectar</button>
                          ) : (
                            <button onClick={handleCalendarConnect} className="text-[10px] text-[#C9B27C] hover:text-[#D4BC88] uppercase tracking-[0.08em] border border-[rgba(201,178,124,0.2)] px-2.5 py-1 rounded-lg bg-[rgba(201,178,124,0.05)] hover:bg-[rgba(201,178,124,0.1)] transition-all">Conectar</button>
                          )}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                </div>
              </div>

              {/* MEMORIA DE LUCY */}
              <MemorySection />

            </div>
          )}

          {(loading || gmailLoading) && (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay }}
                    className="w-1 h-1 rounded-full bg-[#C9B27C]" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PIE EDITORIAL */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pb-8">
          <div className="h-px bg-gradient-to-r from-[rgba(201,178,124,0.08)] via-[rgba(201,178,124,0.15)] to-[rgba(201,178,124,0.08)]" />
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[rgba(255,255,255,0.08)] uppercase tracking-[0.15em]">Lucy · Secretaria Personal</p>
            <p className="text-xs text-[rgba(255,255,255,0.08)] uppercase tracking-[0.15em]">Edicion privada</p>
          </div>
        </div>

      </div>
    </Layout>
  );
}