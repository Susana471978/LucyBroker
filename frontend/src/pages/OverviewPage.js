import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { STATES } from '../voice/useVoiceEngine';
import { t } from '../i18n';
import apiClient from '../services/apiClient';

import { Inbox, Calendar, Brain, FileText } from 'lucide-react';

import useAudioLevelFromTTS from '../hooks/useAudioLevelFromTTS';
import useMicrophoneLevel from '../hooks/useMicrophoneLevel';
import useBriefing from '../hooks/useBriefing';

import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import ReminderToast from '../components/ReminderToast';
import { useReminders } from '../hooks/useReminders';
import AlertToast from '../components/AlertToast';
import { useAlerts } from '../hooks/useAlerts';
import { disconnectGmail } from '../services/mailService';
import { getCalendarStatus, connectCalendar, disconnectCalendar, getTodayEvents } from '../services/calendarService';

import ThinkingParticle from '../components/lucy/ThinkingParticle';
import WelcomeOverlay from '../components/lucy/WelcomeOverlay';
import BriefingOverlay from '../components/lucy/BriefingOverlay';
import EventRow from '../components/lucy/EventRow';
import LucyConversationCard from '../components/lucy/LucyConversationCard';

/* ─── Design system constants ─── */
const CARD_STYLE = {
    borderRadius: '1px',
    background: 'var(--surface-glass)',
    border: '1px solid var(--border-subtle)',
};
const CARD_HOVER_STYLE = {
    borderColor: 'var(--glow-champagne-md)',
    background: 'var(--surface-glass-hover)',
};
const TAG_STYLE = {
    fontSize: '9px',
    letterSpacing: '0.12em',
    padding: '2px 7px',
    borderRadius: '1px',
    textTransform: 'uppercase',
    fontWeight: 500,
};

export default function OverviewPage() {
    const { user, language, token } = useAuth();
    const navigate = useNavigate();
    const {
        ttsEnabled,
        setTtsEnabled,
        wakeWordEnabled,
        wakeWordActive,
        handsFreeModeActive,
        activateHandsFreeMode,
        lastInteraction,
        cancel,
        voiceState,
        setUIContext,
        pendingEmail,
        setPendingEmail,
        listenForFollowUp,
        speak,
    } = useVoice();

    const { currentAlert, dismissAlert } = useAlerts(token);

    const { currentReminder, dismissReminder, checkReminders } = useReminders(token, ttsEnabled);

    const {
        showWelcome,
        welcomePhase,
        briefingVisible,
        briefingText,
        briefingIsSpeaking,
        sending,
        briefingInFlightRef,
        briefingAudioRef,
        sendToLucy,
        runBriefing,
        dismissBriefing,
        handleSkip,
        checkShowWelcome,
        confirmEmailSend,
        cancelEmailSend,
    } = useBriefing({ token, ttsEnabled, pendingEmail, setPendingEmail, listenForFollowUp, speak });

    // ── Alerta VIP — anuncio TTS automático ──────────────────────
    const spokenAlertRef = useRef(null);
    useEffect(() => {
        if (
            currentAlert?.type === 'vip_email' &&
            currentAlert?.tts &&
            ttsEnabled &&
            currentAlert.id !== spokenAlertRef.current
        ) {
            spokenAlertRef.current = currentAlert.id;
            sendToLucy(currentAlert.tts);
        }
    }, [currentAlert, ttsEnabled, sendToLucy]);

    // Prefill desde CRM — botón "Enviar correo"
    const location = useLocation();
    useEffect(() => {
        if (location.state?.lucyPrefill && sendToLucy) {
            const msg = location.state.lucyPrefill;
            window.history.replaceState({}, document.title); // limpiar state
            setTimeout(() => sendToLucy(msg), 800); // esperar a que Lucy esté lista
        }
    }, [location.state, sendToLucy]);

    // Inyectar refresh de recordatorios al contexto de voz
    useEffect(() => {
        if (setUIContext) {
            setUIContext({
                navigate,
                refreshReminders: checkReminders,
            });
        }
    }, [setUIContext, checkReminders, navigate]);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailEmail, setGmailEmail] = useState('');
    const [gmailLoading, setGmailLoading] = useState(true);

    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(true);
    const [todayEvents, setTodayEvents] = useState([]);
    const [calendarExpanded, setCalendarExpanded] = useState(false);

    // Derived voice state booleans
    const isSpeaking = voiceState === STATES.SPEAKING || briefingIsSpeaking;
    const isListening = voiceState === STATES.LISTENING;
    const isProcessing = voiceState === STATES.PROCESSING || sending;

    // Hook TTS: activo siempre (escucha el elemento <audio> global)
    const { level: ttsLevel, waveform } = useAudioLevelFromTTS();

    // Hook micrófono: sólo activo cuando Lucy está escuchando
    const micLevel = useMicrophoneLevel(isListening);

    const canvasLevel = isSpeaking
        ? ttsLevel
        : isListening
            ? micLevel
            : 0;

    const canvasState = isSpeaking
        ? 'speaking'
        : isListening
            ? 'listening'
            : isProcessing
                ? 'processing'
                : 'idle';

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
        return checkShowWelcome({ gmailLoading, gmailConnected, loading });
    }, [checkShowWelcome, gmailLoading, gmailConnected, loading]);

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
            <AnimatePresence mode="wait">
                {showWelcome && welcomePhase === 'idle' && (
                    <WelcomeOverlay
                        key="welcome"
                        greeting={getGreeting()}
                        onStart={() => runBriefing()}
                        onSkip={handleSkip}
                        speak={speak}
                        listenForFollowUp={listenForFollowUp}
                        userName={user?.name || ''}
                    />
                )}
                {welcomePhase === 'thinking' && (
                    <ThinkingParticle key="thinking" />
                )}
                {briefingVisible && welcomePhase === 'briefing' && (
                    <BriefingOverlay
                        key="briefing"
                        text={briefingText}
                        isSpeaking={briefingIsSpeaking}
                        onDismiss={dismissBriefing}
                        canvasState={canvasState}
                        canvasLevel={canvasLevel}
                        waveform={waveform}
                        audioRef={briefingAudioRef}
                    />
                )}
            </AnimatePresence>

            <div className="max-w-5xl mx-auto px-6 py-10" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ── Volver ── */}
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 transition-colors duration-200"
                    style={{ color: 'var(--text-tertiary)', fontSize: '11px', letterSpacing: '0.05em' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Volver
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <p style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px' }}>
                        {getGreeting()}
                    </p>
                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 'clamp(2rem, 5vw, 3rem)',
                        fontWeight: 300,
                        color: 'var(--text-primary)',
                        lineHeight: 1.1,
                        marginBottom: '8px',
                    }}>
                        {t(language, 'welcomeTitle')}
                    </h1>
                    <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        maxWidth: '36rem',
                        lineHeight: '1.6',
                    }}>
                        {t(language, 'welcomeSubtitle')}
                    </p>
                </motion.div>

                {/* ── Lucy hero ── */}
                <LucyConversationCard
                    handsFreeModeActive={handsFreeModeActive}
                    activateHandsFreeMode={activateHandsFreeMode}
                    cancel={cancel}
                    lastInteraction={lastInteraction}
                    briefingText={briefingText}
                    sending={sending}
                    sendToLucy={sendToLucy}
                    runBriefing={runBriefing}
                    briefingInFlightRef={briefingInFlightRef}
                    ttsEnabled={ttsEnabled}
                    setTtsEnabled={setTtsEnabled}
                    wakeWordEnabled={wakeWordEnabled}
                    wakeWordActive={wakeWordActive}
                    isSpeaking={isSpeaking}
                    isListening={isListening}
                    isProcessing={isProcessing}
                    canvasState={canvasState}
                    canvasLevel={canvasLevel}
                    waveform={waveform}
                    pendingEmail={pendingEmail}
                    onConfirmEmail={confirmEmailSend}
                    onCancelEmail={cancelEmailSend}
                />

                {/* ── Context grid: TU CONTEXTO ── */}
                <div>
                    <p style={{
                        fontSize: '9px',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        fontWeight: 500,
                        marginBottom: '10px',
                    }}>
                        Tu contexto
                    </p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: 'auto auto',
                        gap: '8px',
                    }}>
                        {/* Correo — spans 2 rows */}
                        <motion.button
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            onClick={gmailConnected ? () => navigate('/app/messages') : handleGmailConnect}
                            className="ctx-card text-left flex flex-col justify-between transition-all duration-300"
                            style={{
                                ...CARD_STYLE,
                                gridColumn: '1',
                                gridRow: '1 / 3',
                                padding: '14px 16px',
                            }}
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Inbox style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
                                    <span style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correo</span>
                                    {gmailConnected && (
                                        <span className="ctx-dot" style={{
                                            width: 5, height: 5,
                                            borderRadius: '50%',
                                            background: 'rgba(201,178,124,0.5)',
                                            animation: 'ctxPulse 2s ease-in-out infinite',
                                            flexShrink: 0,
                                        }} />
                                    )}
                                </div>

                                <p style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: '52px',
                                    fontWeight: 300,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1,
                                    marginBottom: '4px',
                                }}>
                                    {gmailConnected && stats ? stats.total : '—'}
                                </p>
                                <p style={{
                                    fontSize: '11px',
                                    color: 'var(--text-tertiary)',
                                }}>
                                    {gmailConnected ? (gmailEmail || 'Gmail sincronizado') : 'Sin conectar'}
                                </p>
                            </div>

                            {/* Últimas empresas */}
                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '12px' }}>
                                <p style={{
                                    fontSize: '9px',
                                    letterSpacing: '0.15em',
                                    color: 'var(--text-tertiary)',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px',
                                }}>
                                    Últimas empresas
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</p>
                            </div>
                        </motion.button>

                        {/* Agenda — top right */}
                        <motion.button
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            onClick={calendarConnected ? () => setCalendarExpanded(p => !p) : handleCalendarConnect}
                            className="ctx-card text-left transition-all duration-300"
                            style={{
                                ...CARD_STYLE,
                                padding: '14px 16px',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
                                <span style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Agenda</span>
                                {calendarConnected && (
                                    <span style={{
                                        width: 5, height: 5,
                                        borderRadius: '50%',
                                        background: 'rgba(201,178,124,0.5)',
                                        animation: 'ctxPulse 2s ease-in-out infinite',
                                        flexShrink: 0,
                                    }} />
                                )}
                            </div>
                            <p style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: '38px',
                                fontWeight: 300,
                                color: 'var(--text-primary)',
                                lineHeight: 1,
                                marginBottom: '2px',
                            }}>
                                {calendarConnected ? todayEvents.length : '—'}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                {calendarConnected
                                    ? (todayEvents.length === 0 ? 'Sin eventos hoy' : `evento${todayEvents.length !== 1 ? 's' : ''} hoy`)
                                    : 'Sin conectar'}
                            </p>
                        </motion.button>

                        {/* Resumen de correos — bottom right */}
                        <motion.button
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            onClick={() => { if (!briefingInFlightRef.current) runBriefing(); }}
                            disabled={briefingInFlightRef.current}
                            className="ctx-card text-left transition-all duration-300 disabled:opacity-40"
                            style={{
                                ...CARD_STYLE,
                                padding: '14px 16px',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <FileText style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
                                <span style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resumen</span>
                                {gmailConnected && stats?.total > 0 && (
                                    <span style={{
                                        width: 5, height: 5,
                                        borderRadius: '50%',
                                        background: 'rgba(201,178,124,0.5)',
                                        animation: 'ctxPulse 2s ease-in-out infinite',
                                        flexShrink: 0,
                                    }} />
                                )}
                            </div>
                            <p style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: '38px',
                                fontWeight: 300,
                                color: 'var(--text-primary)',
                                lineHeight: 1,
                                marginBottom: '2px',
                            }}>
                                {gmailConnected && stats ? stats.prioritarios : '—'}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                {gmailConnected && stats ? `prioritarios de ${stats.total}` : 'Sin datos'}
                            </p>
                        </motion.button>
                    </div>

                    {/* Memoria — subordinated below */}
                    <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => navigate('/app/settings')}
                        className="ctx-card w-full text-left transition-all duration-300"
                        style={{
                            ...CARD_STYLE,
                            padding: '10px 16px',
                            marginTop: '8px',
                            opacity: 0.6,
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Brain style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
                            <span style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Memoria de Lucy</span>
                            <span style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: '28px',
                                fontWeight: 300,
                                color: 'var(--text-secondary)',
                                lineHeight: 1,
                                marginLeft: 'auto',
                            }}>
                                —
                            </span>
                        </div>
                    </motion.button>
                </div>

                {/* Gmail connect/disconnect actions (only when not connected) */}
                {!gmailLoading && !gmailConnected && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="flex items-center gap-4"
                    >
                        <button
                            onClick={handleGmailConnect}
                            style={{
                                fontSize: '10px',
                                letterSpacing: '0.1em',
                                color: 'var(--champagne-dim)',
                                textTransform: 'uppercase',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Conectar correo
                        </button>
                        <button
                            onClick={handleCalendarConnect}
                            style={{
                                fontSize: '10px',
                                letterSpacing: '0.1em',
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Conectar agenda
                        </button>
                    </motion.div>
                )}

                {/* Disconnect links (when connected) */}
                {gmailConnected && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleDisconnect}
                            style={{
                                fontSize: '10px',
                                letterSpacing: '0.08em',
                                color: 'var(--text-tertiary)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Desconectar correo
                        </button>
                        {calendarConnected && (
                            <button
                                onClick={handleCalendarDisconnect}
                                style={{
                                    fontSize: '10px',
                                    letterSpacing: '0.08em',
                                    color: 'var(--text-tertiary)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                Desconectar agenda
                            </button>
                        )}
                    </div>
                )}

                {/* ── Calendar events ── */}
                {!calendarLoading && calendarConnected && todayEvents.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="overflow-hidden transition-all duration-300"
                        style={{
                            ...CARD_STYLE,
                        }}
                    >
                        <button
                            onClick={() => setCalendarExpanded(p => !p)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Calendar style={{ width: 12, height: 12, color: 'rgba(201,178,124,0.4)' }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                                    Agenda de hoy — <span style={{ color: 'var(--text-primary)' }}>{todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''}</span>
                                </span>
                            </div>

                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth="2"
                                style={{ transition: 'transform 0.3s ease', transform: calendarExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
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
                                    <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                                        {todayEvents.map((event, i) => (
                                            <EventRow key={event.id || i} event={event} delay={i * 0.05} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* ── Briefing summary: LUCY HA PREPARADO TU DÍA ── */}
                {!loading && stats && gmailConnected && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        style={CARD_STYLE}
                    >
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{
                                fontSize: '9px',
                                letterSpacing: '0.15em',
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                fontWeight: 500,
                            }}>
                                Lucy ha preparado tu día
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {stats.total > 0 && (
                                    <div className="flex items-start gap-3">
                                        <span style={{
                                            ...TAG_STYLE,
                                            color: 'rgba(201,178,124,0.5)',
                                            border: '0.5px solid var(--border-champagne)',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                        }}>HOY</span>
                                        <p style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            lineHeight: '1.6',
                                        }}>
                                            Tu bandeja tiene {stats.total} correo{stats.total !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                )}
                                {stats.prioritarios > 0 && (
                                    <div className="flex items-start gap-3">
                                        <span style={{
                                            ...TAG_STYLE,
                                            color: 'rgba(220,120,100,0.7)',
                                            border: '0.5px solid rgba(220,120,100,0.25)',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                        }}>URGENTE</span>
                                        <p style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            lineHeight: '1.6',
                                        }}>
                                            {stats.prioritarios} email{stats.prioritarios !== 1 ? 's' : ''} prioritario{stats.prioritarios !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                )}
                                {stats.seguimiento > 0 && (
                                    <div className="flex items-start gap-3">
                                        <span style={{
                                            ...TAG_STYLE,
                                            color: 'rgba(201,178,124,0.5)',
                                            border: '0.5px solid var(--border-champagne)',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                        }}>PENDIENTE</span>
                                        <p style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            lineHeight: '1.6',
                                        }}>
                                            {stats.seguimiento} conversacion{stats.seguimiento !== 1 ? 'es' : ''} en seguimiento
                                        </p>
                                    </div>
                                )}
                                {stats.with_attachments > 0 && (
                                    <div className="flex items-start gap-3">
                                        <span style={{
                                            ...TAG_STYLE,
                                            color: 'rgba(201,178,124,0.5)',
                                            border: '0.5px solid var(--border-champagne)',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                        }}>HOY</span>
                                        <p style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            lineHeight: '1.6',
                                        }}>
                                            {stats.with_attachments} correo{stats.with_attachments !== 1 ? 's' : ''} con adjuntos
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <button
                                    onClick={() => navigate('/app/messages')}
                                    style={{
                                        fontSize: '10px',
                                        letterSpacing: '0.1em',
                                        color: 'var(--champagne-dim)',
                                        textTransform: 'uppercase',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'color 0.2s ease',
                                    }}
                                >
                                    Ver correos
                                </button>
                                <button
                                    onClick={() => { if (!briefingInFlightRef.current) runBriefing(); }}
                                    disabled={briefingInFlightRef.current || sending}
                                    style={{
                                        fontSize: '10px',
                                        letterSpacing: '0.1em',
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'color 0.2s ease',
                                    }}
                                    className="disabled:opacity-30"
                                >
                                    Resumir bandeja
                                </button>
                                <button
                                    onClick={() => navigate('/app/tasks')}
                                    style={{
                                        fontSize: '10px',
                                        letterSpacing: '0.1em',
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'color 0.2s ease',
                                    }}
                                >
                                    Organizar mi día
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <ReminderToast reminder={currentReminder} onDismiss={dismissReminder} />
            <AlertToast alert={currentAlert} onDismiss={dismissAlert} />

            <style>{`
                .ctx-card:hover {
                    border-color: var(--glow-champagne-md) !important;
                    background: var(--surface-glass-hover) !important;
                }
                @keyframes ctxPulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 0.2; }
                }
            `}</style>
        </Layout>
    );
}
