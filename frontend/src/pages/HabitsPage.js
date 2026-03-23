import { Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { setGlobalAudio, stopGlobalAudio } from '../voice/useVoiceEngine';
import { t } from '../i18n';
import apiClient from '../services/apiClient';

import {
    Inbox, Clock, Paperclip, Sparkles, Link2, Calendar, Brain, FileText
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import ReminderToast from '../components/ReminderToast';
import { useReminders } from '../hooks/useReminders';
import AlertToast from '../components/AlertToast';
import { useAlerts } from '../hooks/useAlerts';
import OnboardingBanner from '../components/OnboardingBanner';
import { disconnectGmail } from '../services/mailService';
import { getCalendarStatus, connectCalendar, disconnectCalendar, getTodayEvents, formatEventTime } from '../services/calendarService';

/* ─────────────────────────────────────────────────────────
   WELCOME OVERLAY
───────────────────────────────────────────────────────── */
function WelcomeOverlay({ onStart, onSkip, greeting }) {
    const [pulse, setPulse] = useState(false);
    useEffect(() => { const t = setTimeout(() => setPulse(true), 400); return () => clearTimeout(t); }, []);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(4,4,8,0.96)', backdropFilter: 'blur(32px)' }}>
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-sm w-full mx-8 text-center flex flex-col items-center gap-10">
                <div className="relative flex items-center justify-center">
                    {pulse && (<>
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.6, 2] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }} className="absolute w-24 h-24 rounded-full border border-[#C9B27C]" />
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 0.1, 0], scale: [0.8, 1.4, 1.8] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.6 }} className="absolute w-24 h-24 rounded-full border border-[#C9B27C]" />
                    </>)}
                    <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center bg-[rgba(201,178,124,0.08)] border border-[rgba(201,178,124,0.25)] shadow-[0_0_60px_rgba(201,178,124,0.12)]">
                        <svg width="28" height="28" viewBox="0 0 22 22" fill="none"><path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill="#C9B27C" /></svg>
                    </div>
                </div>
                <div className="space-y-3">
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-xs text-[rgba(255,255,255,0.25)] uppercase tracking-[0.18em]">{greeting}</motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
                        className="text-white font-light leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontStyle: 'italic' }}>
                        Soy Lucy, tu secretaria.</motion.h2>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
                        className="text-sm text-[rgba(255,255,255,0.3)] leading-relaxed">Tengo tu briefing listo.<br />Toca para escucharlo.</motion.p>
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

/* ─────────────────────────────────────────────────────────
   BRIEFING / RESPONSE OVERLAY
───────────────────────────────────────────────────────── */
function BriefingOverlay({ text, onDismiss, isSpeaking }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(6,6,8,0.88)', backdropFilter: 'blur(24px)' }}>
            <motion.div initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-xl w-full mx-6 text-center flex flex-col items-center gap-8 max-h-[85vh] overflow-y-auto">
                <div className="relative flex items-center justify-center">
                    {isSpeaking && (<>
                        <div className="absolute w-24 h-24 rounded-full border border-[rgba(201,178,124,0.15)] animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute w-16 h-16 rounded-full border border-[rgba(201,178,124,0.25)] animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                    </>)}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] transition-all duration-500 ${isSpeaking ? 'shadow-[0_0_40px_rgba(201,178,124,0.2)]' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={isSpeaking ? '#C9B27C' : 'rgba(201,178,124,0.6)'} /></svg>
                    </div>
                </div>
                <div>
                    <p className="text-xs text-[rgba(255,255,255,0.25)] uppercase tracking-[0.15em] mb-2">Lucy</p>
                    <p className="text-xs text-[rgba(201,178,124,0.5)] uppercase tracking-[0.1em]">{isSpeaking ? 'Lucy está hablando…' : 'Respuesta lista'}</p>
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
                {isSpeaking ? (
                    <button onClick={onDismiss}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
              bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)]
              text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-[0.12em]
              hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.6)]
              transition-all duration-200 mt-2">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        Detener
                    </button>
                ) : (
                    <button onClick={onDismiss} className="text-xs text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.45)] uppercase tracking-[0.12em] transition-colors duration-200 mt-1">
                        Cerrar →
                    </button>
                )}
            </motion.div>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, highlight, onClick, delay = 0 }) => (
    <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.015, y: -1 }} whileTap={{ scale: 0.985 }} onClick={onClick}
        className={`group relative rounded-2xl p-6 text-left w-full cursor-pointer transition-all duration-300 bg-[rgba(255,255,255,0.025)] border backdrop-blur-sm overflow-hidden
      ${highlight ? 'border-[rgba(201,178,124,0.2)] shadow-[0_0_40px_rgba(201,178,124,0.06),0_1px_0_rgba(255,255,255,0.05)_inset]' : 'border-[rgba(255,255,255,0.06)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'}
      hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)]`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-5 transition-all duration-300
      ${highlight ? 'bg-[rgba(201,178,124,0.1)] text-[#C9B27C]' : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.35)] group-hover:text-[rgba(255,255,255,0.6)]'}`}>{icon}</div>
        <p className="text-3xl font-light text-white mb-1.5 tracking-tight">{value}</p>
        <p className="text-xs text-[rgba(255,255,255,0.3)] uppercase tracking-[0.07em] font-medium">{label}</p>
    </motion.button>
);

/* ─────────────────────────────────────────────────────────
   ACTION CARD
───────────────────────────────────────────────────────── */
const ActionCard = ({ icon, title, description, actionLabel, onAction, connected, connectedLabel, onDisconnect, delay = 0 }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="group relative rounded-2xl p-5 bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.06)] backdrop-blur-sm overflow-hidden hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300
        ${connected ? 'bg-[rgba(0,180,216,0.08)] text-[#00B4D8] border border-[rgba(0,180,216,0.2)]' : 'bg-[rgba(201,178,124,0.08)] text-[rgba(201,178,124,0.6)] border border-[rgba(201,178,124,0.15)] group-hover:text-[#C9B27C]'}`}>{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-[rgba(255,255,255,0.8)]">{title}</h4>
                    {connected && (<div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#00B4D8] shadow-[0_0_6px_rgba(0,180,216,0.6)]" /><span className="text-xs text-[rgba(0,180,216,0.7)]">Conectado</span></div>)}
                </div>
                <p className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed mb-3">{connected ? connectedLabel : description}</p>
                {connected ? (
                    <button onClick={onDisconnect} className="text-xs text-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.5)] transition-colors duration-200">Desconectar</button>
                ) : (
                    <button onClick={onAction} className="flex items-center gap-1.5 text-xs text-[#C9B27C] hover:text-[#D4BC88] border border-[rgba(201,178,124,0.2)] hover:border-[rgba(201,178,124,0.4)] px-3 py-1.5 rounded-lg transition-all duration-200 bg-[rgba(201,178,124,0.04)] hover:bg-[rgba(201,178,124,0.1)]">
                        <Link2 className="w-3 h-3" />{actionLabel}
                    </button>
                )}
            </div>
        </div>
    </motion.div>
);

/* ─────────────────────────────────────────────────────────
   CALENDAR EVENT ROW
───────────────────────────────────────────────────────── */
const EventRow = ({ event, delay = 0 }) => (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start gap-3 py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0">
        <div className="mt-0.5 w-14 text-right flex-shrink-0">
            <span className="text-xs text-[rgba(201,178,124,0.6)] font-medium tabular-nums">{event.all_day ? 'Todo el día' : formatEventTime(event.start)}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-[rgba(255,255,255,0.75)] truncate">{event.title}</p>
            {event.location && <p className="text-xs text-[rgba(255,255,255,0.25)] truncate mt-0.5">{event.location}</p>}
            {event.attendees?.length > 0 && <p className="text-xs text-[rgba(255,255,255,0.2)] mt-0.5 truncate">con {event.attendees.slice(0, 2).join(', ')}{event.attendees.length > 2 ? ` +${event.attendees.length - 2}` : ''}</p>}
        </div>
        {event.meet_link && (
            <a href={event.meet_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(201,178,124,0.06)] border border-[rgba(201,178,124,0.15)] text-[rgba(201,178,124,0.45)] hover:text-[#C9B27C] hover:border-[rgba(201,178,124,0.3)] transition-all duration-200" title="Unirse a Meet">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </a>
        )}
    </motion.div>
);

/* ─────────────────────────────────────────────────────────
   OVERVIEW PAGE
───────────────────────────────────────────────────────── */
export default function OverviewPage() {
    const { language, token } = useAuth();
    const navigate = useNavigate();
    const { ttsEnabled, setTtsEnabled, wakeWordEnabled, wakeWordActive, handsFreeModeActive, activateHandsFreeMode, lastInteraction, cancel } = useVoice();
    const { currentAlert, dismissAlert } = useAlerts(token);
    const { currentReminder, dismissReminder } = useReminders(token, ttsEnabled);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailEmail, setGmailEmail] = useState('');
    const [gmailLoading, setGmailLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(true);
    const [todayEvents, setTodayEvents] = useState([]);
    const [calendarExpanded, setCalendarExpanded] = useState(false);

    const [showWelcome, setShowWelcome] = useState(false);
    const [briefingVisible, setBriefingVisible] = useState(false);
    const [briefingText, setBriefingText] = useState('');
    const [briefingIsSpeaking, setBriefingIsSpeaking] = useState(false);
    const briefingDoneRef = useRef(false);
    const briefingInFlightRef = useRef(false);
    const [briefingCompleted, setBriefingCompleted] = useState(!!sessionStorage.getItem(`lucy_briefing_${new Date().toDateString()}`));

    const fetchData = useCallback(async () => {
        if (!token) return;
        try {
            const emailsRes = await apiClient.get('/gmail/messages');
            const emailsData = emailsRes.data?.data || emailsRes.data || [];
            const list = Array.isArray(emailsData) ? emailsData : [];
            setStats({ total: list.length, prioritarios: list.filter(e => e.priority?.priority_label === 'PRIORITARIO').length, seguimiento: list.filter(e => e.priority?.priority_label === 'SEGUIMIENTO').length, with_attachments: list.filter(e => e.email?.has_attachments).length });
        } catch { setStats(null); }
        finally { setLoading(false); }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        apiClient.get('/gmail/status')
            .then(res => { const d = res.data?.data || res.data; setGmailConnected(!!d.gmail_connected); setGmailEmail(d.gmail_email || ''); })
            .catch(console.error).finally(() => setGmailLoading(false));
    }, [token]);

    useEffect(() => {
        if (!token) return;
        const checkCalendar = async () => {
            try { const status = await getCalendarStatus(); setCalendarConnected(!!status.calendar_connected); if (status.calendar_connected) { const events = await getTodayEvents(); setTodayEvents(Array.isArray(events) ? events : []); } }
            catch (err) { console.error('Calendar:', err); }
            finally { setCalendarLoading(false); }
        };
        checkCalendar();
    }, [token]);

    useEffect(() => { if (token) fetchData(); }, [fetchData, token]);

    // ── Mostrar welcome overlay UNA SOLA VEZ ──
    useEffect(() => {
        if (!token || gmailLoading || !gmailConnected || loading || briefingDoneRef.current) return;
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        if (sessionStorage.getItem(todayKey)) return;
        briefingDoneRef.current = true;
        const timer = setTimeout(() => setShowWelcome(true), 600);
        return () => clearTimeout(timer);
    }, [token, gmailLoading, gmailConnected, loading]);

    // ── sendToLucy — con guard contra doble ejecución ──
    const sendToLucy = useCallback(async (text) => {
        if (!text?.trim()) return;
        if (briefingInFlightRef.current) return;
        briefingInFlightRef.current = true;
        setSending(true);
        try {
            const res = await apiClient.post('/assistant', { text });
            const reply = res.data?.assistant_text || res.data?.data?.assistant_text || '';
            if (reply) {
                setBriefingText(reply);
                setBriefingVisible(true);
                setBriefingIsSpeaking(false);
                setBriefingCompleted(true);
                if (ttsEnabled) {
                    setBriefingIsSpeaking(true);
                    try {
                        const ttsRes = await apiClient.post('/tts', { text: reply }, { responseType: 'blob' });
                        const blob = ttsRes.data;
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);

                        setGlobalAudio(audio);

                        audio.onended = () => {
                            setGlobalAudio(null);
                            URL.revokeObjectURL(url);
                            setBriefingIsSpeaking(false);
                        };
                        audio.onerror = () => {
                            setGlobalAudio(null);
                            URL.revokeObjectURL(url);
                            setBriefingIsSpeaking(false);
                        };
                        await audio.play();
                    } catch { setBriefingIsSpeaking(false); }
                }
            }
            return reply;
        } catch (err) { console.error('Lucy error:', err); }
        finally {
            setSending(false);
            briefingInFlightRef.current = false;
        }
    }, [token, ttsEnabled]);

    // ── runBriefing ──
    const runBriefing = useCallback(async (promptText = 'buenos días Lucy, dame mi briefing matutino') => {
        setShowWelcome(false);
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        sessionStorage.setItem(todayKey, '1');
        await sendToLucy(promptText);
    }, [sendToLucy]);

    const handleSkip = () => {
        sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
        setShowWelcome(false);
        setBriefingCompleted(true);
    };

    const dismissBriefing = () => {
        stopGlobalAudio();
        setBriefingVisible(false);
        setBriefingIsSpeaking(false);
    };

    const handleGmailConnect = async () => { try { const res = await apiClient.get('/gmail/auth'); const url = res.data?.data?.auth_url || res.data?.auth_url; if (url) window.location.href = url; } catch (err) { console.error(err); } };
    const handleDisconnect = async () => { try { await disconnectGmail(); setGmailConnected(false); setGmailEmail(''); setStats({ total: 0, prioritarios: 0, seguimiento: 0, with_attachments: 0 }); } catch (err) { console.error(err); } };
    const handleCalendarConnect = async () => { try { await connectCalendar(); } catch (err) { console.error('Calendar connect:', err); } };
    const handleCalendarDisconnect = async () => { try { await disconnectCalendar(); setCalendarConnected(false); setTodayEvents([]); } catch (err) { console.error('Calendar disconnect:', err); } };

    const getGreeting = () => { const h = new Date().getHours(); if (h < 12) return 'Buenos días'; if (h < 20) return 'Buenas tardes'; return 'Buenas noches'; };

    return (
        <Layout>
            <AnimatePresence>{showWelcome && <WelcomeOverlay greeting={getGreeting()} onStart={() => runBriefing()} onSkip={handleSkip} />}</AnimatePresence>
            <AnimatePresence>{briefingVisible && <BriefingOverlay text={briefingText} isSpeaking={briefingIsSpeaking} onDismiss={dismissBriefing} />}</AnimatePresence>

            <div className="max-w-5xl mx-auto px-6 py-14 space-y-10">
                <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.5)] -mb-6 transition-colors duration-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>Volver
                </button>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                    <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em] font-medium mb-3">{getGreeting()}</p>
                    <h1 className="text-4xl font-light tracking-tight text-white mb-3">{t(language, 'welcomeTitle')}</h1>
                    <p className="text-sm text-[rgba(255,255,255,0.35)] max-w-xl leading-relaxed">{t(language, 'welcomeSubtitle')}</p>
                </motion.div>

                <OnboardingBanner
                    gmailConnected={gmailConnected}
                    calendarConnected={calendarConnected}
                    briefingDone={briefingCompleted}
                    onConnectGmail={handleGmailConnect}
                    onConnectCalendar={handleCalendarConnect}
                    onRunBriefing={() => { if (!briefingInFlightRef.current) runBriefing(); }}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ActionCard icon={<Inbox className="w-4.5 h-4.5" />} title="Correo" description="Conecta tu Gmail y Lucy priorizará tu bandeja cada mañana." actionLabel="Conectar correo" onAction={handleGmailConnect} connected={gmailConnected} connectedLabel={gmailEmail || 'Gmail sincronizado'} onDisconnect={handleDisconnect} delay={0.1} />
                    <ActionCard icon={<Calendar className="w-4.5 h-4.5" />} title="Agenda" description="Conecta Google Calendar para incluir eventos en tu briefing." actionLabel="Conectar agenda" onAction={handleCalendarConnect} connected={calendarConnected} connectedLabel={todayEvents.length === 0 ? 'Sin eventos hoy' : `${todayEvents.length} evento${todayEvents.length !== 1 ? 's' : ''} hoy`} onDisconnect={handleCalendarDisconnect} delay={0.15} />
                    <ActionCard icon={<Brain className="w-4.5 h-4.5" />} title="Memoria de Lucy" description="Enséñale tus preferencias: horarios, contactos clave, prioridades." actionLabel="Configurar" onAction={() => navigate('/app/settings')} connected={false} delay={0.2} />
                    <ActionCard icon={<FileText className="w-4.5 h-4.5" />} title="Resumen de correos" description="Lucy analiza tu bandeja y te prepara un briefing ejecutivo." actionLabel="Generar briefing" onAction={() => { if (!briefingInFlightRef.current) runBriefing(); }} connected={gmailConnected && stats?.total > 0} connectedLabel={stats ? `${stats.total} emails · ${stats.prioritarios} prioritarios` : 'Listo'} delay={0.25} />
                </div>

                {!calendarLoading && calendarConnected && todayEvents.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                        className="rounded-2xl border backdrop-blur-sm transition-all duration-300 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.1)] overflow-hidden">
                        <button onClick={() => setCalendarExpanded(p => !p)} className="w-full px-5 py-4 flex items-center justify-between text-left">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-3.5 h-3.5 text-[rgba(201,178,124,0.5)]" />
                                <span className="text-sm text-[rgba(255,255,255,0.5)]">Agenda de hoy — <span className="text-[rgba(255,255,255,0.7)]">{todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''}</span></span>
                            </div>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className={`transition-transform duration-300 ${calendarExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        <AnimatePresence>{calendarExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                                <div className="px-5 pb-4 border-t border-[rgba(255,255,255,0.04)] pt-3">{todayEvents.map((event, i) => <EventRow key={event.id || i} event={event} delay={i * 0.05} />)}</div>
                            </motion.div>
                        )}</AnimatePresence>
                    </motion.div>
                )}

                {!loading && stats && gmailConnected && (<>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={<Inbox className="w-4 h-4" />} label="Emails" value={stats.total} highlight onClick={() => navigate('/app/messages')} delay={0.15} />
                        <StatCard icon={<Sparkles className="w-4 h-4" />} label="Prioritarios" value={stats.prioritarios} onClick={() => navigate('/app/messages?filter=PRIORITARIO')} delay={0.2} />
                        <StatCard icon={<Clock className="w-4 h-4" />} label="Seguimiento" value={stats.seguimiento} onClick={() => navigate('/app/messages?filter=SEGUIMIENTO')} delay={0.25} />
                        <StatCard icon={<Paperclip className="w-4 h-4" />} label="Adjuntos" value={stats.with_attachments} onClick={() => navigate('/app/messages?filter=attachments')} delay={0.3} />
                    </div>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="relative rounded-2xl overflow-hidden bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.3)] to-transparent" />
                        <div className="p-8 flex flex-col gap-7">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)] transition-all duration-500 ${wakeWordActive ? 'shadow-[0_0_16px_rgba(201,178,124,0.25)]' : ''}`}>
                                            <svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={wakeWordActive ? '#C9B27C' : 'rgba(201,178,124,0.6)'} /></svg>
                                        </div>
                                        {wakeWordActive && <div className="absolute -inset-1 rounded-2xl border border-[rgba(201,178,124,0.3)] animate-ping" />}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-medium text-white tracking-wide">Lucy</h3>
                                        <p className="text-xs text-[rgba(255,255,255,0.3)] mt-0.5">{wakeWordActive ? 'Escuchando…' : wakeWordEnabled ? 'Di "Hola Lucy" o escribe abajo' : 'Asistente ejecutiva'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { if (!briefingInFlightRef.current) runBriefing('repite mi briefing matutino'); }}
                                        disabled={briefingInFlightRef.current || sending}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 bg-[rgba(201,178,124,0.06)] text-[rgba(201,178,124,0.45)] border border-[rgba(201,178,124,0.15)] hover:bg-[rgba(201,178,124,0.12)] hover:text-[#C9B27C] disabled:opacity-30"
                                        title="Repetir briefing">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                                    </button>
                                    <button onClick={() => setTtsEnabled(prev => !prev)}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${ttsEnabled ? 'bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)]' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.25)] border border-[rgba(255,255,255,0.07)]'} hover:bg-[rgba(255,255,255,0.07)]`}
                                        title={ttsEnabled ? 'Silenciar voz' : 'Activar voz'}>
                                        {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent -mx-8" />

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handsFreeModeActive ? cancel : undefined}
                                    className={`rounded-xl p-5 text-left border transition-all duration-300 ${!handsFreeModeActive ? 'bg-[rgba(201,178,124,0.07)] border-[rgba(201,178,124,0.2)]' : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.05)]'}`}>
                                    <div className="text-xl mb-3 opacity-80">🖥️</div>
                                    <p className="text-sm font-medium text-[rgba(255,255,255,0.8)] mb-1.5">Modo Escritorio</p>
                                    <p className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed">Botones, resúmenes y respuestas con un clic.</p>
                                    {!handsFreeModeActive && <div className="mt-3 text-xs text-[#C9B27C] font-medium flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#C9B27C]" />Activo</div>}
                                </button>
                                <button onClick={handsFreeModeActive ? cancel : activateHandsFreeMode}
                                    className={`rounded-xl p-5 text-left border transition-all duration-300 ${handsFreeModeActive ? 'bg-[rgba(0,180,216,0.06)] border-[rgba(0,180,216,0.2)]' : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.05)]'}`}>
                                    <div className="text-xl mb-3 opacity-80">🎧</div>
                                    <p className="text-sm font-medium text-[rgba(255,255,255,0.8)] mb-1.5">Manos Libres</p>
                                    <p className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed">Lucy te lee la bandeja en voz alta.</p>
                                    {handsFreeModeActive && <div className="mt-3 text-xs text-[#00B4D8] font-medium flex items-center gap-1.5 animate-pulse"><span className="w-1 h-1 rounded-full bg-[#00B4D8]" />Activo — pulsa silenciar para salir</div>}
                                </button>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const input = e.target.elements.lucyInput;
                                const text = input.value.trim();
                                if (!text || sending) return;
                                input.value = '';
                                await sendToLucy(text);
                            }} className="flex items-center gap-2">
                                <input name="lucyInput" type="text"
                                    placeholder={sending ? 'Lucy está pensando...' : 'Escríbele a Lucy... (recordatorios, preguntas, notas)'}
                                    disabled={sending}
                                    className="flex-1 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[rgba(255,255,255,0.7)] placeholder-[rgba(255,255,255,0.2)] focus:border-[rgba(201,178,124,0.3)] focus:outline-none transition-colors duration-200 disabled:opacity-50" />
                                <button type="submit" disabled={sending}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 border ${sending ? 'bg-[rgba(201,178,124,0.15)] border-[rgba(201,178,124,0.3)] text-[#C9B27C]' : 'bg-[rgba(201,178,124,0.08)] border-[rgba(201,178,124,0.2)] text-[rgba(201,178,124,0.5)] hover:text-[#C9B27C] hover:bg-[rgba(201,178,124,0.15)]'}`}
                                    title="Enviar">
                                    {sending ? <div className="w-4 h-4 border-2 border-[rgba(201,178,124,0.3)] border-t-[#C9B27C] rounded-full animate-spin" /> : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                    )}
                                </button>
                            </form>

                            <AnimatePresence>
                                {(lastInteraction || briefingText) && (
                                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="rounded-xl px-5 py-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] max-h-60 overflow-y-auto">
                                        <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.07em] mb-2">Lucy</p>
                                        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">{lastInteraction || briefingText}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>)}
            </div>

            <ReminderToast reminder={currentReminder} onDismiss={dismissReminder} />
            <AlertToast alert={currentAlert} onDismiss={dismissAlert} />
        </Layout>
    );
}