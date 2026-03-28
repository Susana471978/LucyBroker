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

import ExecutiveOrb from "../components/ExecutiveOrb/ExecutiveOrb";

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

    useEffect(() => {
        const t = setTimeout(() => setPulse(true), 400);
        return () => clearTimeout(t);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(4,4,8,0.96)', backdropFilter: 'blur(32px)' }}
        >
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-sm w-full mx-8 text-center flex flex-col items-center gap-10"
            >
                <div className="relative flex items-center justify-center">
                    {pulse && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.6, 2] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
                                className="absolute w-24 h-24 rounded-full border border-[#C9B27C]"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: [0, 0.1, 0], scale: [0.8, 1.4, 1.8] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
                                className="absolute w-24 h-24 rounded-full border border-[#C9B27C]"
                            />
                        </>
                    )}
                    <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center bg-[rgba(201,178,124,0.08)] border border-[rgba(201,178,124,0.25)] shadow-[0_0_60px_rgba(201,178,124,0.12)]">
                        <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
                            <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill="#C9B27C" />
                        </svg>
                    </div>
                </div>

                <div className="space-y-3">
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-caption text-[rgba(255,255,255,0.25)] uppercase tracking-[0.18em]"
                    >
                        {greeting}
                    </motion.p>

                    <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, duration: 0.6 }}
                        className="text-white font-light leading-tight"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontStyle: 'italic' }}
                    >
                        Soy Lucy, tu secretaria.
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className="text-body-sm text-[rgba(255,255,255,0.3)] leading-relaxed"
                    >
                        Tengo tu briefing listo.
                        <br />
                        Toca para escucharlo.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75, duration: 0.6 }}
                    className="flex flex-col items-center gap-4 w-full"
                >
                    <button
                        onClick={onStart}
                        className="group relative w-full py-4 rounded-2xl bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] text-[#C9B27C] text-body-sm uppercase tracking-[0.12em] font-medium hover:bg-[rgba(201,178,124,0.18)] hover:border-[rgba(201,178,124,0.5)] hover:shadow-[0_0_40px_rgba(201,178,124,0.15)] transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.4)] to-transparent" />
                        <span className="flex items-center justify-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Escuchar briefing
                        </span>
                    </button>

                    <button
                        onClick={onSkip}
                        className="text-caption text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.4)] uppercase tracking-[0.1em] transition-colors duration-200"
                    >
                        Entrar sin audio →
                    </button>
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(6,6,8,0.88)', backdropFilter: 'blur(24px)' }}
        >
            <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-xl w-full mx-6 text-center flex flex-col items-center gap-6 max-h-[85vh] overflow-y-auto"
            >
                <div className="relative flex items-center justify-center">
                    {isSpeaking && (
                        <>
                            <div className="absolute w-24 h-24 rounded-full border border-[rgba(201,178,124,0.15)] animate-ping" style={{ animationDuration: '2s' }} />
                            <div className="absolute w-16 h-16 rounded-full border border-[rgba(201,178,124,0.25)] animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                        </>
                    )}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] transition-all duration-500 ${isSpeaking ? 'shadow-[0_0_40px_rgba(201,178,124,0.2)]' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                            <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={isSpeaking ? '#C9B27C' : 'rgba(201,178,124,0.6)'} />
                        </svg>
                    </div>
                </div>

                <div>
                    <p className="text-caption text-[rgba(255,255,255,0.25)] uppercase tracking-[0.15em] mb-2">Lucy</p>
                    <p className="text-caption text-[rgba(201,178,124,0.5)] uppercase tracking-[0.1em]">
                        {isSpeaking ? 'Lucy está hablando…' : 'Respuesta lista'}
                    </p>
                </div>

                {text && (
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="font-light text-[rgba(255,255,255,0.75)] leading-relaxed text-h3 max-w-md"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}
                    >
                        "{text}"
                    </motion.p>
                )}

                {isSpeaking && (
                    <div className="flex items-end gap-1 h-6">
                        {[...Array(7)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="w-1 rounded-full bg-[#C9B27C]"
                                animate={{ height: ['4px', `${10 + i * 3}px`, '4px'] }}
                                transition={{ duration: 0.5 + i * 0.08, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
                                style={{ opacity: 0.4 + i * 0.08 }}
                            />
                        ))}
                    </div>
                )}

                {isSpeaking ? (
                    <button
                        onClick={onDismiss}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.4)] text-caption uppercase tracking-[0.12em] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.6)] transition-all duration-200 mt-2"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        Detener
                    </button>
                ) : (
                    <button
                        onClick={onDismiss}
                        className="text-caption text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.45)] uppercase tracking-[0.12em] transition-colors duration-200 mt-1"
                    >
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
    <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.012, y: -1 }}
        whileTap={{ scale: 0.985 }}
        onClick={onClick}
        className={`group relative w-full overflow-hidden card-lucy-compact border text-left transition-all duration-300 backdrop-blur-xl ${highlight
            ? 'border-[rgba(201,178,124,0.20)] bg-[linear-gradient(180deg,rgba(10,13,20,0.96)_0%,rgba(5,7,12,0.99)_100%)]'
            : 'border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(8,12,22,0.95)_0%,rgba(4,7,15,0.99)_100%)] hover:border-[rgba(88,160,255,0.16)]'
            }`}
    >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.05),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(201,178,124,0.04),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[13px] border border-[rgba(255,255,255,0.03)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent" />

        <div className="relative z-10">
            <div
                className={`mb-4 flex h-9 w-9 items-center justify-center rounded-[18px] border transition-all duration-300 ${highlight
                    ? 'border-[rgba(201,178,124,0.20)] bg-[rgba(201,178,124,0.08)] text-[rgba(230,205,140,0.95)] shadow-[0_0_14px_rgba(201,178,124,0.06)]'
                    : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(214,227,249,0.42)] group-hover:text-[rgba(230,240,255,0.78)]'
                    }`}
            >
                {icon}
            </div>

            <p className="mb-2 text-h1 font-light leading-none tracking-[-0.04em] text-[rgba(248,250,255,0.98)]">
                {value}
            </p>
            <p className="text-caption uppercase tracking-[0.08em] font-medium text-[rgba(177,189,209,0.44)]">
                {label}
            </p>
        </div>
    </motion.button>
);

/* ─────────────────────────────────────────────────────────
   ACTION CARD
───────────────────────────────────────────────────────── */
const ActionCard = ({ icon, title, description, actionLabel, onAction, connected, connectedLabel, onDisconnect, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`group relative overflow-hidden card-lucy-compact border backdrop-blur-xl transition-all duration-300 ${connected
            ? 'border-[rgba(88,160,255,0.15)] bg-[linear-gradient(180deg,rgba(6,12,24,0.96)_0%,rgba(3,8,18,0.99)_100%)]'
            : 'border-[rgba(201,178,124,0.13)] bg-[linear-gradient(180deg,rgba(10,13,20,0.96)_0%,rgba(5,7,12,0.99)_100%)] hover:border-[rgba(201,178,124,0.18)]'
            }`}
    >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(201,178,124,0.04),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[13px] border border-[rgba(255,255,255,0.03)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent" />

        <div className="relative z-10 flex items-start gap-3">
            <div
                className={`flex h-8 w-8 items-center justify-center rounded-[14px] border flex-shrink-0 transition-all duration-300 ${connected
                    ? 'border-[rgba(88,160,255,0.20)] bg-[rgba(88,160,255,0.08)] text-[#00B4D8] shadow-[0_0_16px_rgba(36,99,235,0.06)]'
                    : 'border-[rgba(201,178,124,0.18)] bg-[rgba(201,178,124,0.08)] text-[rgba(201,178,124,0.72)] group-hover:text-[#C9B27C]'
                    }`}
            >
                {icon}
            </div>

            <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h4 className="text-h3 font-medium tracking-[-0.02em] text-[rgba(244,247,255,0.95)]">
                        {title}
                    </h4>

                    {connected && (
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-[#00B4D8] shadow-[0_0_8px_rgba(0,180,216,0.65)]" />
                            <span className="text-body-sm text-[rgba(0,180,216,0.86)]">Conectado</span>
                        </div>
                    )}
                </div>

                <p className="mb-3 text-body-sm leading-[1.6] text-[rgba(196,208,228,0.42)]">
                    {connected ? connectedLabel : description}
                </p>

                {connected ? (
                    <button
                        onClick={onDisconnect}
                        className="text-body-sm font-medium text-[rgba(170,186,210,0.52)] transition-colors duration-200 hover:text-[rgba(241,246,255,0.84)]"
                    >
                        Desconectar
                    </button>
                ) : (
                    <button
                        onClick={onAction}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,178,124,0.22)] bg-[linear-gradient(180deg,rgba(40,30,11,0.90)_0%,rgba(22,16,7,0.98)_100%)] px-3.5 py-2 text-caption font-medium text-[rgba(232,205,138,0.96)] transition-all duration-200 hover:border-[rgba(201,178,124,0.34)] hover:text-[rgba(246,223,160,0.98)] hover:shadow-[0_0_14px_rgba(201,178,124,0.10)]"
                    >
                        <Link2 className="w-3.5 h-3.5" />
                        {actionLabel}
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
    <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start gap-3 py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0"
    >
        <div className="mt-0.5 w-14 text-right flex-shrink-0">
            <span className="text-caption text-[rgba(201,178,124,0.6)] font-medium tabular-nums">
                {event.all_day ? 'Todo el día' : formatEventTime(event.start)}
            </span>
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-body-sm text-[rgba(255,255,255,0.75)] truncate">{event.title}</p>
            {event.location && <p className="text-caption text-[rgba(255,255,255,0.25)] truncate mt-0.5">{event.location}</p>}
            {event.attendees?.length > 0 && (
                <p className="text-caption text-[rgba(255,255,255,0.2)] mt-0.5 truncate">
                    con {event.attendees.slice(0, 2).join(', ')}
                    {event.attendees.length > 2 ? ` +${event.attendees.length - 2}` : ''}
                </p>
            )}
        </div>

        {event.meet_link && (
            <a
                href={event.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(201,178,124,0.06)] border border-[rgba(201,178,124,0.15)] text-[rgba(201,178,124,0.45)] hover:text-[#C9B27C] hover:border-[rgba(201,178,124,0.3)] transition-all duration-200"
                title="Unirse a Meet"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
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
    const {
        ttsEnabled,
        setTtsEnabled,
        wakeWordEnabled,
        wakeWordActive,
        handsFreeModeActive,
        activateHandsFreeMode,
        lastInteraction,
        cancel
    } = useVoice();

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
    const [briefingCompleted, setBriefingCompleted] = useState(
        !!sessionStorage.getItem(`lucy_briefing_${new Date().toDateString()}`)
    );

    const fetchData = useCallback(async () => {
        if (!token) return;
        try {
            const emailsRes = await apiClient.get('/gmail/messages');
            const emailsData = emailsRes.data?.data || emailsRes.data || [];
            const list = Array.isArray(emailsData) ? emailsData : [];
            setStats({
                total: list.length,
                prioritarios: list.filter(e => e.priority?.priority_label === 'PRIORITARIO').length,
                seguimiento: list.filter(e => e.priority?.priority_label === 'SEGUIMIENTO').length,
                with_attachments: list.filter(e => e.email?.has_attachments).length
            });
        } catch {
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        apiClient.get('/gmail/status')
            .then(res => {
                const d = res.data?.data || res.data;
                setGmailConnected(!!d.gmail_connected);
                setGmailEmail(d.gmail_email || '');
            })
            .catch(console.error)
            .finally(() => setGmailLoading(false));
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
            } catch (err) {
                console.error('Calendar:', err);
            } finally {
                setCalendarLoading(false);
            }
        };
        checkCalendar();
    }, [token]);

    useEffect(() => {
        if (token) fetchData();
    }, [fetchData, token]);

    useEffect(() => {
        if (!token || gmailLoading || !gmailConnected || loading || briefingDoneRef.current) return;
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        if (sessionStorage.getItem(todayKey)) return;
        briefingDoneRef.current = true;
        const timer = setTimeout(() => setShowWelcome(true), 600);
        return () => clearTimeout(timer);
    }, [token, gmailLoading, gmailConnected, loading]);

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
                    } catch {
                        setBriefingIsSpeaking(false);
                    }
                }
            }

            return reply;
        } catch (err) {
            console.error('Lucy error:', err);
        } finally {
            setSending(false);
            briefingInFlightRef.current = false;
        }
    }, [ttsEnabled]);

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

    const handleGmailConnect = async () => {
        try {
            const res = await apiClient.get('/gmail/auth');
            const url = res.data?.data?.auth_url || res.data?.auth_url;
            if (url) window.location.href = url;
        } catch (err) {
            console.error(err);
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnectGmail();
            setGmailConnected(false);
            setGmailEmail('');
            setStats({ total: 0, prioritarios: 0, seguimiento: 0, with_attachments: 0 });
        } catch (err) {
            console.error(err);
        }
    };

    const handleCalendarConnect = async () => {
        try {
            await connectCalendar();
        } catch (err) {
            console.error('Calendar connect:', err);
        }
    };

    const handleCalendarDisconnect = async () => {
        try {
            await disconnectCalendar();
            setCalendarConnected(false);
            setTodayEvents([]);
        } catch (err) {
            console.error('Calendar disconnect:', err);
        }
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 20) return 'Buenas tardes';
        return 'Buenas noches';
    };

    return (
        <Layout>
            <AnimatePresence>
                {showWelcome && (
                    <WelcomeOverlay
                        greeting={getGreeting()}
                        onStart={() => runBriefing()}
                        onSkip={handleSkip}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {briefingVisible && (
                    <BriefingOverlay
                        text={briefingText}
                        isSpeaking={briefingIsSpeaking}
                        onDismiss={dismissBriefing}
                    />
                )}
            </AnimatePresence>

            <div className="max-w-5xl mx-auto px-6 py-14 space-y-10">
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-caption text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.5)] -mb-6 transition-colors duration-200"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <p className="text-caption text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em] font-medium mb-3">
                        {getGreeting()}
                    </p>
                    <h1 className="font-light tracking-tight text-white mb-3"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem' }}>
                        {t(language, 'welcomeTitle')}
                    </h1>
                    <p className="text-body-sm text-[rgba(255,255,255,0.35)] max-w-xl leading-relaxed">
                        {t(language, 'welcomeSubtitle')}
                    </p>
                </motion.div>

                <OnboardingBanner
                    gmailConnected={gmailConnected}
                    calendarConnected={calendarConnected}
                    briefingDone={briefingCompleted}
                    onConnectGmail={handleGmailConnect}
                    onConnectCalendar={handleCalendarConnect}
                    onRunBriefing={() => {
                        if (!briefingInFlightRef.current) runBriefing();
                    }}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ActionCard
                        icon={<Inbox className="w-5 h-5" />}
                        title="Correo"
                        description="Conecta tu Gmail y Lucy priorizará tu bandeja cada mañana."
                        actionLabel="Conectar correo"
                        onAction={handleGmailConnect}
                        connected={gmailConnected}
                        connectedLabel={gmailEmail || 'Gmail sincronizado'}
                        onDisconnect={handleDisconnect}
                        delay={0.1}
                    />

                    <ActionCard
                        icon={<Calendar className="w-5 h-5" />}
                        title="Agenda"
                        description="Conecta Google Calendar para incluir eventos en tu briefing."
                        actionLabel="Conectar agenda"
                        onAction={handleCalendarConnect}
                        connected={calendarConnected}
                        connectedLabel={todayEvents.length === 0 ? 'Sin eventos hoy' : `${todayEvents.length} evento${todayEvents.length !== 1 ? 's' : ''} hoy`}
                        onDisconnect={handleCalendarDisconnect}
                        delay={0.15}
                    />

                    <ActionCard
                        icon={<Brain className="w-5 h-5" />}
                        title="Memoria de Lucy"
                        description="Enséñale tus preferencias: horarios, contactos clave, prioridades."
                        actionLabel="Configurar"
                        onAction={() => navigate('/app/settings')}
                        connected={false}
                        delay={0.2}
                    />

                    <ActionCard
                        icon={<FileText className="w-5 h-5" />}
                        title="Resumen de correos"
                        description="Lucy analiza tu bandeja y te prepara un briefing ejecutivo."
                        actionLabel="Generar briefing"
                        onAction={() => {
                            if (!briefingInFlightRef.current) runBriefing();
                        }}
                        connected={gmailConnected && stats?.total > 0}
                        connectedLabel={stats ? `${stats.total} emails · ${stats.prioritarios} prioritarios` : 'Listo'}
                        delay={0.25}
                    />
                </div>

                {!calendarLoading && calendarConnected && todayEvents.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="rounded-2xl border backdrop-blur-sm transition-all duration-300 bg-[rgba(255,255,255,0.025)] border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.1)] overflow-hidden"
                    >
                        <button
                            onClick={() => setCalendarExpanded(p => !p)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Calendar className="w-3.5 h-3.5 text-[rgba(201,178,124,0.5)]" />
                                <span className="text-body-sm text-[rgba(255,255,255,0.5)]">
                                    Agenda de hoy — <span className="text-[rgba(255,255,255,0.7)]">{todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''}</span>
                                </span>
                            </div>

                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="2"
                                className={`transition-transform duration-300 ${calendarExpanded ? 'rotate-180' : ''}`}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        <AnimatePresence>
                            {calendarExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-5 pb-4 border-t border-[rgba(255,255,255,0.04)] pt-3">
                                        {todayEvents.map((event, i) => (
                                            <EventRow key={event.id || i} event={event} delay={i * 0.05} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {!loading && stats && gmailConnected && (
                    <>
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="card-lucy border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(8,12,22,0.95)_0%,rgba(4,7,15,0.99)_100%)] backdrop-blur-xl"
                        >
                            <div className="flex flex-col gap-4">
                                <h3 className="text-h3 font-medium text-[rgba(248,250,255,0.95)] tracking-[-0.02em]">
                                    Hoy Lucy ha preparado esto para ti
                                </h3>

                                <div className="flex flex-col gap-3">
                                    {stats.total > 0 && (
                                        <div className="flex items-start gap-3">
                                            <Inbox className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                                Tu bandeja tiene <span className="text-[rgba(255,255,255,0.8)]">{stats.total}</span> correo{stats.total !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )}
                                    {stats.prioritarios > 0 && (
                                        <div className="flex items-start gap-3">
                                            <Sparkles className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                                Tienes <span className="text-[rgba(201,178,124,0.9)]">{stats.prioritarios}</span> email{stats.prioritarios !== 1 ? 's' : ''} prioritario{stats.prioritarios !== 1 ? 's' : ''} pendiente{stats.prioritarios !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )}
                                    {stats.seguimiento > 0 && (
                                        <div className="flex items-start gap-3">
                                            <Clock className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                                Tienes <span className="text-[rgba(255,255,255,0.8)]">{stats.seguimiento}</span> conversacion{stats.seguimiento !== 1 ? 'es' : ''} en seguimiento
                                            </p>
                                        </div>
                                    )}
                                    {stats.with_attachments > 0 && (
                                        <div className="flex items-start gap-3">
                                            <Paperclip className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                                <span className="text-[rgba(255,255,255,0.8)]">{stats.with_attachments}</span> correo{stats.with_attachments !== 1 ? 's' : ''} con adjuntos
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                                    <button
                                        onClick={() => navigate('/app/messages')}
                                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,178,124,0.18)] bg-[linear-gradient(180deg,rgba(40,30,11,0.90)_0%,rgba(22,16,7,0.98)_100%)] px-4 py-2.5 text-caption font-medium text-[rgba(232,205,138,0.96)] transition-all duration-200 hover:border-[rgba(201,178,124,0.34)] hover:shadow-[0_0_14px_rgba(201,178,124,0.10)]"
                                    >
                                        <Inbox className="w-3.5 h-3.5" />
                                        Ver mis correos
                                    </button>
                                    <button
                                        onClick={() => { if (!briefingInFlightRef.current) runBriefing(); }}
                                        disabled={briefingInFlightRef.current || sending}
                                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-caption font-medium text-[rgba(196,208,228,0.55)] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:text-[rgba(255,255,255,0.75)] disabled:opacity-30"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Resumir mi bandeja
                                    </button>
                                    <button
                                        onClick={() => navigate('/app/tasks')}
                                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-caption font-medium text-[rgba(196,208,228,0.55)] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:text-[rgba(255,255,255,0.75)]"
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                        Organizar mi día
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="relative overflow-hidden card-lucy-comfy border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(7,12,22,0.92)_0%,rgba(3,7,16,0.97)_100%)] backdrop-blur-xl"
                        >
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(201,178,124,0.05),transparent_28%)]" />
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.3)] to-transparent" />

                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center bg-[linear-gradient(180deg,rgba(39,28,10,0.95)_0%,rgba(20,15,7,0.98)_100%)] border border-[rgba(201,178,124,0.22)] transition-all duration-500 ${wakeWordActive ? 'shadow-[0_0_22px_rgba(201,178,124,0.20)]' : 'shadow-[0_0_14px_rgba(201,178,124,0.08)]'}`}>
                                                <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
                                                    <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill={wakeWordActive ? '#C9B27C' : 'rgba(201,178,124,0.7)'} />
                                                </svg>
                                            </div>
                                            {wakeWordActive && (
                                                <div className="absolute -inset-1 rounded-[18px] border border-[rgba(201,178,124,0.28)] animate-ping" />
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-h3 text-white tracking-wide">Lucy</h3>
                                            <p className="text-caption text-[rgba(214,227,249,0.46)] mt-0.5">
                                                {wakeWordActive
                                                    ? 'Escuchando…'
                                                    : wakeWordEnabled
                                                        ? 'Estoy contigo. Escríbeme o háblame cuando quieras.'
                                                        : 'Asistente ejecutiva'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (!briefingInFlightRef.current) runBriefing('repite mi briefing matutino');
                                            }}
                                            disabled={briefingInFlightRef.current || sending}
                                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[rgba(201,178,124,0.06)] text-[rgba(201,178,124,0.48)] border border-[rgba(201,178,124,0.15)] hover:bg-[rgba(201,178,124,0.12)] hover:text-[#C9B27C] disabled:opacity-30"
                                            title="Repetir briefing"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                <path d="M1 4v6h6M23 20v-6h-6" />
                                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                                            </svg>
                                        </button>

                                        <button
                                            onClick={() => setTtsEnabled(prev => !prev)}
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${ttsEnabled ? 'bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)]' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.25)] border border-[rgba(255,255,255,0.07)]'} hover:bg-[rgba(255,255,255,0.07)]`}
                                            title={ttsEnabled ? 'Silenciar voz' : 'Activar voz'}
                                        >
                                            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent -mx-8" />

                                <div className="flex justify-center items-center py-16 min-h-[320px]">
                                    <div className="w-[360px] h-[240px] flex items-center justify-center">
                                        <ExecutiveOrb
                                            state={
                                                wakeWordActive
                                                    ? "listening"
                                                    : briefingIsSpeaking
                                                        ? "speaking"
                                                        : sending
                                                            ? "processing"
                                                            : "idle"
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={handsFreeModeActive ? cancel : undefined}
                                        className={`group relative overflow-hidden card-lucy border text-left transition-all duration-300 ${!handsFreeModeActive
                                            ? 'border-[rgba(201,178,124,0.30)] bg-[linear-gradient(180deg,rgba(5,10,20,0.96)_0%,rgba(3,7,16,0.98)_100%)]'
                                            : 'border-[rgba(88,160,255,0.18)] bg-[linear-gradient(180deg,rgba(4,10,24,0.96)_0%,rgba(3,8,20,0.98)_100%)] hover:border-[rgba(88,160,255,0.28)]'
                                            }`}
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,178,124,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.06),transparent_36%)] opacity-90" />
                                        <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-[rgba(255,255,255,0.03)]" />

                                        <div className="relative z-10">
                                            <div className="mb-5 flex items-center gap-3">
                                                <div
                                                    className={`flex h-9 w-9 items-center justify-center rounded-[18px] border text-h3 transition-all duration-300 ${!handsFreeModeActive
                                                        ? 'border-[rgba(201,178,124,0.24)] bg-[rgba(201,178,124,0.08)] text-[rgba(230,205,140,0.96)] shadow-[0_0_18px_rgba(201,178,124,0.08)]'
                                                        : 'border-[rgba(88,160,255,0.16)] bg-[rgba(88,160,255,0.06)] text-[rgba(184,214,255,0.92)]'
                                                        }`}
                                                >
                                                    🖥️
                                                </div>

                                                <div className="min-w-0">
                                                    <h3
                                                        className={`text-h3 font-medium tracking-[-0.02em] ${!handsFreeModeActive
                                                            ? 'text-[rgba(248,240,218,0.98)]'
                                                            : 'text-[rgba(242,247,255,0.96)]'
                                                            }`}
                                                    >
                                                        Modo Escritorio
                                                    </h3>
                                                </div>
                                            </div>

                                            <p
                                                className={`max-w-[34rem] text-body leading-[1.7] ${!handsFreeModeActive
                                                    ? 'text-[rgba(232,220,182,0.72)]'
                                                    : 'text-[rgba(214,227,249,0.68)]'
                                                    }`}
                                            >
                                                Botones, resúmenes y respuestas con un clic.
                                            </p>

                                            <div className="mt-5 flex items-center gap-2">
                                                <span
                                                    className={`inline-block h-2.5 w-2.5 rounded-full ${!handsFreeModeActive
                                                        ? 'bg-[rgba(222,188,106,0.95)] shadow-[0_0_12px_rgba(222,188,106,0.55)]'
                                                        : 'bg-[rgba(148,163,184,0.55)]'
                                                        }`}
                                                />
                                                <span
                                                    className={`text-caption font-medium ${!handsFreeModeActive
                                                        ? 'text-[rgba(237,211,143,0.95)]'
                                                        : 'text-[rgba(176,190,212,0.70)]'
                                                        }`}
                                                >
                                                    Activo
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={handsFreeModeActive ? cancel : activateHandsFreeMode}
                                        className={`group relative overflow-hidden card-lucy border text-left transition-all duration-300 ${handsFreeModeActive
                                            ? 'border-[rgba(201,178,124,0.30)] bg-[linear-gradient(180deg,rgba(5,10,20,0.96)_0%,rgba(3,7,16,0.98)_100%)]'
                                            : 'border-[rgba(88,160,255,0.18)] bg-[linear-gradient(180deg,rgba(4,10,24,0.96)_0%,rgba(3,8,20,0.98)_100%)] hover:border-[rgba(88,160,255,0.28)]'
                                            }`}
                                    >
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(201,178,124,0.05),transparent_34%)] opacity-90" />
                                        <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-[rgba(255,255,255,0.03)]" />

                                        <div className="relative z-10">
                                            <div className="mb-5 flex items-center gap-3">
                                                <div
                                                    className={`flex h-9 w-9 items-center justify-center rounded-[18px] border text-h3 transition-all duration-300 ${handsFreeModeActive
                                                        ? 'border-[rgba(201,178,124,0.24)] bg-[rgba(201,178,124,0.08)] text-[rgba(230,205,140,0.96)] shadow-[0_0_18px_rgba(201,178,124,0.08)]'
                                                        : 'border-[rgba(88,160,255,0.16)] bg-[rgba(88,160,255,0.06)] text-[rgba(214,228,255,0.90)]'
                                                        }`}
                                                >
                                                    🎧
                                                </div>

                                                <div className="min-w-0">
                                                    <h3
                                                        className={`text-h3 font-medium tracking-[-0.02em] ${handsFreeModeActive
                                                            ? 'text-[rgba(248,240,218,0.98)]'
                                                            : 'text-[rgba(242,247,255,0.96)]'
                                                            }`}
                                                    >
                                                        Manos Libres
                                                    </h3>
                                                </div>
                                            </div>

                                            <p
                                                className={`max-w-[34rem] text-body leading-[1.7] ${handsFreeModeActive
                                                    ? 'text-[rgba(232,220,182,0.72)]'
                                                    : 'text-[rgba(214,227,249,0.68)]'
                                                    }`}
                                            >
                                                Lucy te lee la bandeja en voz alta.
                                            </p>

                                            <div className="mt-5 flex items-center gap-2">
                                                <span
                                                    className={`inline-block h-2.5 w-2.5 rounded-full ${handsFreeModeActive
                                                        ? 'bg-[rgba(222,188,106,0.95)] shadow-[0_0_12px_rgba(222,188,106,0.55)]'
                                                        : 'bg-[rgba(148,163,184,0.55)]'
                                                        }`}
                                                />
                                                <span
                                                    className={`text-caption font-medium ${handsFreeModeActive
                                                        ? 'text-[rgba(237,211,143,0.95)]'
                                                        : 'text-[rgba(176,190,212,0.70)]'
                                                        }`}
                                                >
                                                    {handsFreeModeActive ? 'Activo' : 'Disponible'}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const input = e.target.elements.lucyInput;
                                        const text = input.value.trim();
                                        if (!text || sending) return;
                                        input.value = '';
                                        await sendToLucy(text);
                                    }}
                                    className="relative mt-2"
                                >
                                    <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[radial-gradient(circle_at_left,rgba(59,130,246,0.06),transparent_30%),radial-gradient(circle_at_right,rgba(201,178,124,0.05),transparent_26%)]" />

                                    <div className="relative flex items-center gap-3 rounded-[26px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(5,9,18,0.92)_0%,rgba(3,6,14,0.97)_100%)] px-4 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.42),0_0_24px_rgba(36,99,235,0.06)]">
                                        <input
                                            name="lucyInput"
                                            type="text"
                                            placeholder={sending ? 'Lucy está pensando...' : 'Escríbeme lo que necesites… (tareas, ideas, recordatorios)'}
                                            disabled={sending}
                                            className="flex-1 bg-transparent px-1 py-1 text-body-sm text-[rgba(242,247,255,0.92)] placeholder:text-[rgba(160,174,198,0.34)] focus:outline-none disabled:opacity-50"
                                        />

                                        <button
                                            type="submit"
                                            disabled={sending}
                                            className={`w-12 h-12 rounded-[18px] flex items-center justify-center flex-shrink-0 transition-all duration-200 border ${sending
                                                ? 'bg-[rgba(201,178,124,0.15)] border-[rgba(201,178,124,0.3)] text-[#C9B27C]'
                                                : 'bg-[linear-gradient(180deg,rgba(46,34,12,0.96)_0%,rgba(24,18,8,0.98)_100%)] border-[rgba(201,178,124,0.18)] text-[rgba(224,196,126,0.92)] hover:border-[rgba(201,178,124,0.34)] hover:text-[rgba(245,219,152,0.98)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.40),0_0_24px_rgba(201,178,124,0.16)]'
                                                }`}
                                            title="Enviar"
                                        >
                                            {sending ? (
                                                <div className="w-4 h-4 border-2 border-[rgba(201,178,124,0.3)] border-t-[#C9B27C] rounded-full animate-spin" />
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                    <line x1="22" y1="2" x2="11" y2="13" />
                                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </form>

                                <AnimatePresence>
                                    {(lastInteraction || briefingText) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="card-lucy bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] max-h-60 overflow-y-auto"
                                        >
                                            <p className="text-caption text-[rgba(255,255,255,0.2)] uppercase tracking-[0.07em] mb-3">Lucy</p>
                                            <p className="text-body text-[rgba(255,255,255,0.6)] leading-relaxed">
                                                {lastInteraction || briefingText}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </>
                )}
            </div>

            <ReminderToast reminder={currentReminder} onDismiss={dismissReminder} />
            <AlertToast alert={currentAlert} onDismiss={dismissAlert} />
        </Layout>
    );
}