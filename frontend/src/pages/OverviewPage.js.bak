import { Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { setGlobalAudio, stopGlobalAudio, STATES } from '../voice/useVoiceEngine';
import { t } from '../i18n';
import apiClient from '../services/apiClient';

import {
    Inbox, Clock, Paperclip, Sparkles, Link2, Calendar, Brain, FileText
} from 'lucide-react';

import useAudioLevelFromTTS from '../hooks/useAudioLevelFromTTS';
import useMicrophoneLevel from '../hooks/useMicrophoneLevel';
import LucyPulseCanvas from "../components/LucyPulseCanvas";
import LucyLogoAnimated from "../components/LucyLogoAnimated";

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
   PARTICLE — estado thinking: una partícula dorada que late
───────────────────────────────────────────────────────── */
function ThinkingParticle() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(3,4,8,0.97)', backdropFilter: 'blur(32px)' }}
        >
            {/* Anillos que se expanden hacia afuera */}
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className="absolute rounded-full border border-[rgba(201,178,124,0.15)]"
                    initial={{ width: 8, height: 8, opacity: 0 }}
                    animate={{
                        width: [8, 120 + i * 80],
                        height: [8, 120 + i * 80],
                        opacity: [0, 0.4, 0],
                    }}
                    transition={{
                        duration: 2.2,
                        delay: i * 0.55,
                        repeat: Infinity,
                        ease: 'easeOut',
                    }}
                />
            ))}

            {/* Núcleo: partícula dorada pulsante */}
            <motion.div
                className="relative flex items-center justify-center"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
                {/* Glow exterior */}
                <motion.div
                    className="absolute rounded-full"
                    style={{
                        width: 32, height: 32,
                        background: 'radial-gradient(circle, rgba(201,178,124,0.35) 0%, transparent 70%)',
                        filter: 'blur(8px)',
                    }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Núcleo sólido */}
                <div
                    className="relative z-10 rounded-full"
                    style={{
                        width: 8, height: 8,
                        background: 'radial-gradient(circle, #F0E2B0 0%, #C9B27C 60%, #A08952 100%)',
                        boxShadow: '0 0 12px rgba(201,178,124,0.8), 0 0 24px rgba(201,178,124,0.4)',
                    }}
                />
            </motion.div>

            {/* Texto discreto debajo */}
            <motion.p
                className="absolute bottom-[calc(50%-80px)] text-[10px] text-[rgba(201,178,124,0.3)] uppercase tracking-[0.25em]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.3] }}
                transition={{ duration: 1.2, delay: 0.4 }}
            >
                Preparando tu día…
            </motion.p>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────
   WELCOME OVERLAY — sin caja de ondas
───────────────────────────────────────────────────────── */
function WelcomeOverlay({ onStart, onSkip, greeting }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(4,4,8,0.97)', backdropFilter: 'blur(32px)' }}
        >
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-lg w-full mx-8 flex flex-col items-center gap-10"
            >
                <div className="space-y-4 text-center">
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="text-[11px] text-[rgba(255,255,255,0.25)] uppercase tracking-[0.18em]"
                    >
                        {greeting}
                    </motion.p>

                    <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.6 }}
                        className="text-white font-light leading-tight"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', fontStyle: 'italic' }}
                    >
                        Soy Lucy, tu secretaria.
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="text-[13px] text-[rgba(255,255,255,0.28)] leading-relaxed"
                    >
                        Tengo tu briefing listo.<br />Toca para escucharlo.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65, duration: 0.6 }}
                    className="flex flex-col items-center gap-4 w-full"
                >
                    <button
                        onClick={onStart}
                        className="group relative w-full py-4 rounded-2xl
                            bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)]
                            text-[#C9B27C] text-[11px] uppercase tracking-[0.12em] font-medium
                            hover:bg-[rgba(201,178,124,0.18)] hover:border-[rgba(201,178,124,0.5)]
                            hover:shadow-[0_0_40px_rgba(201,178,124,0.15)]
                            transition-all duration-300 overflow-hidden"
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
                        className="text-[10px] text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.4)]
                            uppercase tracking-[0.1em] transition-colors duration-200"
                    >
                        Entrar sin audio →
                    </button>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────
   BRIEFING OVERLAY
   Typewriter sincronizado con audio.currentTime real.
   Props nuevas: audioRef — ref al elemento <audio> activo
   (pásalo desde OverviewPage junto a los demás props)
───────────────────────────────────────────────────────── */
function BriefingOverlay({ text, onDismiss, isSpeaking, canvasState, canvasLevel, waveform, audioRef }) {
    const [showText, setShowText] = useState(false);
    const [visibleChars, setVisibleChars] = useState(0);
    const rafRef = useRef(null);

    // Panel derecho aparece 1.5s después del inicio del audio
    useEffect(() => {
        if (!text) { setShowText(false); return; }
        const t = setTimeout(() => setShowText(true), 1500);
        return () => clearTimeout(t);
    }, [text]);

    // Sincronización con audio.currentTime
    // Estrategia: estimamos cuántos chars se han pronunciado
    // basándonos en la velocidad real del TTS shimmer (≈14 chars/s)
    // corregida con currentTime del audio para que nunca se desvíe.
    useEffect(() => {
        if (!showText || !text) return;

        const CHARS_PER_SEC = 14; // shimmer voice ≈ 14 chars/seg (ajusta si va rápido/lento)

        const tick = () => {
            const audio = audioRef?.current;
            let elapsed;

            if (audio && !audio.paused && !audio.ended && audio.currentTime > 0) {
                // Tiempo real del audio — la referencia más precisa
                elapsed = audio.currentTime;
            } else {
                // Fallback: no hay audio activo todavía, esperar
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            const targetChars = Math.floor(elapsed * CHARS_PER_SEC);
            setVisibleChars(Math.min(targetChars, text.length));

            if (targetChars < text.length) {
                rafRef.current = requestAnimationFrame(tick);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [showText, text, audioRef]);

    // Cuando el audio termina, mostrar todo el texto
    useEffect(() => {
        if (!isSpeaking && text) {
            setVisibleChars(text.length);
        }
    }, [isSpeaking, text]);

    const displayedText = text ? text.slice(0, visibleChars) : '';
    const isFullyRevealed = visibleChars >= (text?.length ?? 0);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(3,4,8,0.97)', backdropFilter: 'blur(32px)' }}
        >
            <div className="h-full flex flex-col md:flex-row">

                {/* ══ IZQUIERDA: status / onda / botón ══ */}
                <motion.div
                    className="relative overflow-hidden flex flex-col"
                    animate={{ flex: showText ? '0 0 45%' : '1 1 100%' }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{ minHeight: '100vh' }}
                >
                    <div className="absolute inset-0 z-0">
                        <LucyPulseCanvas
                            state={canvasState}
                            level={canvasLevel}
                            waveform={waveform}
                        />
                    </div>

                    {/* Superior */}
                    <div className="relative z-20 flex-none pt-10 flex flex-col items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="text-center"
                        >
                            <p className="text-[11px] text-[rgba(201,178,124,0.45)] uppercase tracking-[0.25em] font-medium">
                                Lucy
                            </p>
                            <p className="text-[11px] text-[rgba(255,255,255,0.2)] uppercase tracking-[0.12em] mt-1.5">
                                {isSpeaking ? 'Hablando…' : text ? 'Briefing listo' : 'Revisando tu día…'}
                            </p>
                        </motion.div>
                    </div>

                    {/* Central — espacio para las ondas */}
                    <div className="relative z-10 flex-1" />

                    {/* Inferior — botón */}
                    <div className="relative z-20 flex-none pb-10 flex flex-col items-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.0, duration: 0.4 }}
                        >
                            {isSpeaking ? (
                                <button
                                    onClick={onDismiss}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                                        bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]
                                        text-[rgba(255,255,255,0.3)] text-[10px] uppercase tracking-[0.14em]
                                        hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.5)]
                                        transition-all duration-200"
                                >
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                    Detener
                                </button>
                            ) : text ? (
                                <button
                                    onClick={onDismiss}
                                    className="text-[10px] text-[rgba(255,255,255,0.15)]
                                        hover:text-[rgba(255,255,255,0.4)] uppercase tracking-[0.14em]
                                        transition-colors duration-200"
                                >
                                    Cerrar →
                                </button>
                            ) : null}
                        </motion.div>
                    </div>
                </motion.div>

                {/* ══ DERECHA: texto sincronizado ══ */}
                <AnimatePresence>
                    {showText && text && (
                        <motion.div
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="flex-1 flex flex-col justify-center relative overflow-hidden"
                        >
                            <div
                                className="absolute left-0 top-0 bottom-0 w-px"
                                style={{ background: 'linear-gradient(to bottom, transparent, rgba(201,178,124,0.15), transparent)' }}
                            />

                            <div className="h-full flex flex-col justify-center px-10 md:px-14 py-12 overflow-y-auto">
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.10 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="block leading-none text-[#C9B27C] mb-4"
                                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4rem' }}
                                >
                                    "
                                </motion.span>

                                <div
                                    className="leading-[1.85] tracking-[0.01em]"
                                    style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: 'clamp(0.82rem, 1.1vw, 1rem)',
                                    }}
                                >
                                    <span className="text-[rgba(255,255,255,0.58)]">
                                        {displayedText}
                                    </span>
                                    {!isFullyRevealed && (
                                        <span
                                            className="inline-block w-[2px] h-[1em] ml-[2px] align-middle"
                                            style={{
                                                backgroundColor: 'rgba(201,178,124,0.5)',
                                                animation: 'cursorBlink 0.8s ease-in-out infinite',
                                            }}
                                        />
                                    )}
                                </div>

                                {isFullyRevealed && (
                                    <motion.div
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 40 }}
                                        transition={{ duration: 0.6, delay: 0.2 }}
                                        className="mt-8 h-px bg-gradient-to-r from-[rgba(201,178,124,0.2)] to-transparent"
                                    />
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes cursorBlink {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0; }
                }
            `}</style>
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
        cancel,
        voiceState,
        setUIContext,
    } = useVoice();

    const { currentAlert, dismissAlert } = useAlerts(token);
    const { currentReminder, dismissReminder, checkReminders } = useReminders(token, ttsEnabled);


    // Inyectar refresh de recordatorios al contexto de voz
    useEffect(() => {
        if (setUIContext) {
            setUIContext({
                refreshReminders: checkReminders,
            });
        }
    }, [setUIContext, checkReminders]);
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
    const [welcomePhase, setWelcomePhase] = useState('idle');
    const [briefingVisible, setBriefingVisible] = useState(false);
    const [briefingText, setBriefingText] = useState('');
    const [briefingIsSpeaking, setBriefingIsSpeaking] = useState(false);
    const briefingDoneRef = useRef(false);
    const briefingInFlightRef = useRef(false);
    const [briefingCompleted, setBriefingCompleted] = useState(
        !!sessionStorage.getItem(`lucy_briefing_${new Date().toDateString()}`)
    );
    // Derived voice state booleans
    const isSpeaking = voiceState === STATES.SPEAKING || briefingIsSpeaking;
    const isListening = voiceState === STATES.LISTENING;
    const isProcessing = voiceState === STATES.PROCESSING || sending;

    // Hook TTS: activo siempre (escucha el elemento <audio> global)
    const { level: ttsLevel, waveform } = useAudioLevelFromTTS();

    // Hook micrófono: sólo activo cuando Lucy está escuchando
    const micLevel = useMicrophoneLevel(isListening);

    // Nivel unificado que se pasa al canvas:
    //   speaking  → usa el nivel del TTS
    //   listening → usa el nivel del micrófono
    //   el resto  → 0 (el canvas genera su animación autónoma)
    const canvasLevel = isSpeaking
        ? ttsLevel
        : isListening
            ? micLevel
            : 0;

    // Estado del canvas derivado del estado de voz
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
        if (!token || gmailLoading || !gmailConnected || loading || briefingDoneRef.current) return;
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        if (sessionStorage.getItem(todayKey)) return;
        briefingDoneRef.current = true;
        const timer = setTimeout(() => setShowWelcome(true), 600);
        return () => clearTimeout(timer);
    }, [token, gmailLoading, gmailConnected, loading]);



    const briefingAudioRef = useRef(null); // ref al <audio> activo del briefing

    // 2. Reemplaza sendToLucy() — guarda el audio en briefingAudioRef
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
                        const url = URL.createObjectURL(ttsRes.data);
                        const audio = new Audio(url);

                        // Guardar ref para que BriefingOverlay acceda a currentTime
                        briefingAudioRef.current = audio;

                        // Analyser para la visualización
                        let analyser = null;
                        try {
                            if (!audioCtxRef.current) {
                                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                            }
                            const ctx = audioCtxRef.current;
                            if (ctx.state === 'suspended') await ctx.resume().catch(() => { });
                            const source = ctx.createMediaElementSource(audio);
                            analyser = ctx.createAnalyser();
                            analyser.fftSize = 512;
                            analyser.smoothingTimeConstant = 0.55;
                            source.connect(analyser);
                            analyser.connect(ctx.destination);
                        } catch (ae) {
                            console.warn('[Briefing] Analyser no disponible:', ae.message);
                        }

                        setGlobalAudio({ audio, analyser });

                        audio.onended = () => {
                            setGlobalAudio(null);
                            URL.revokeObjectURL(url);
                            setBriefingIsSpeaking(false);
                            briefingAudioRef.current = null;
                        };
                        audio.onerror = () => {
                            setGlobalAudio(null);
                            URL.revokeObjectURL(url);
                            setBriefingIsSpeaking(false);
                            briefingAudioRef.current = null;
                        };

                        await audio.play();
                    } catch (err) {
                        console.error('[Briefing] TTS error:', err);
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

    // 3. runBriefing — evita el salto a OverviewPage controlando welcomePhase
    const runBriefing = useCallback(async (promptText = 'buenos días Lucy, dame mi briefing matutino') => {
        setShowWelcome(false);
        setWelcomePhase('thinking');   // partícula dorada mientras carga
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        sessionStorage.setItem(todayKey, '1');
        const reply = await sendToLucy(promptText);
        if (reply) {
            setWelcomePhase('briefing');
        } else {
            setWelcomePhase('idle');
            setShowWelcome(true);
        }
    }, [sendToLucy]);

    // 4. dismissBriefing — resetea welcomePhase
    const dismissBriefing = () => {
        stopGlobalAudio();
        setBriefingVisible(false);
        setBriefingIsSpeaking(false);
        briefingAudioRef.current = null;
        setWelcomePhase('idle');
    };

    const handleSkip = () => {
        sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
        setShowWelcome(false);
        setBriefingCompleted(true);
        setWelcomePhase('idle');
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
            <>
                <AnimatePresence mode="wait">
                    {showWelcome && welcomePhase === 'idle' && (
                        <WelcomeOverlay
                            key="welcome"
                            greeting={getGreeting()}
                            onStart={() => runBriefing()}
                            onSkip={handleSkip}
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
                                className="relative overflow-hidden rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(7,12,22,0.96)_0%,rgba(3,7,16,0.99)_100%)] backdrop-blur-xl"
                            >
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.22)] to-transparent" />

                                {/* ── Selector de modo ── */}
                                <div className="p-5 pb-0 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handsFreeModeActive && cancel()}
                                        className={`text-left px-4 py-3 rounded-[14px] border transition-all duration-300 ${!handsFreeModeActive
                                            ? 'border-[rgba(201,178,124,0.32)] bg-[rgba(201,178,124,0.055)]'
                                            : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(201,178,124,0.18)]'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-block w-[6px] h-[6px] rounded-full flex-shrink-0 transition-all duration-300 ${!handsFreeModeActive
                                                ? 'bg-[#C9B27C] shadow-[0_0_7px_rgba(201,178,124,0.75)]'
                                                : 'bg-[rgba(148,163,184,0.35)]'}`}
                                            />
                                            <span className="text-[13px] font-medium text-[rgba(244,247,255,0.88)]">🖥️ Escritorio</span>
                                        </div>
                                        <p className="text-[11px] text-[rgba(196,208,228,0.38)] leading-[1.5]">Texto. Sin distracciones.</p>
                                    </button>

                                    <button
                                        onClick={() => handsFreeModeActive ? cancel() : activateHandsFreeMode("")}
                                        className={`text-left px-4 py-3 rounded-[14px] border transition-all duration-300 ${handsFreeModeActive
                                            ? 'border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.04)]'
                                            : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(74,158,255,0.2)]'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-block w-[6px] h-[6px] rounded-full flex-shrink-0 transition-all duration-300 ${handsFreeModeActive
                                                ? 'bg-[#4A9EFF] shadow-[0_0_7px_rgba(74,158,255,0.7)]'
                                                : 'bg-[rgba(148,163,184,0.35)]'}`}
                                            />
                                            <span className="text-[13px] font-medium text-[rgba(244,247,255,0.88)]">🎧 Manos libres</span>
                                        </div>
                                        <p className="text-[11px] text-[rgba(196,208,228,0.38)] leading-[1.5]">Voz. Las ondas hablan.</p>
                                    </button>
                                </div>

                                {/* ══ CONTENIDO POR MODO ══ */}
                                <AnimatePresence mode="wait">

                                    {/* ── MODO ESCRITORIO ── */}
                                    {!handsFreeModeActive && (
                                        <motion.div
                                            key="escritorio"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="p-5 flex flex-col gap-4"
                                        >
                                            {/* Header Lucy + botones */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex items-center justify-center w-[34px] h-[34px]">
                                                        <LucyLogoAnimated />
                                                        {wakeWordActive && (
                                                            <div className="absolute -inset-1 rounded-[11px] border border-[rgba(201,178,124,0.28)] animate-ping" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-medium text-[rgba(255,255,255,0.9)]">Lucy</p>
                                                        <p className="text-[10px] text-[rgba(214,227,249,0.35)] uppercase tracking-[0.1em] mt-[1px]">
                                                            {wakeWordActive ? 'Escuchando…' : wakeWordEnabled ? 'Contigo' : 'Asistente ejecutiva'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => { if (!briefingInFlightRef.current) runBriefing('repite mi briefing matutino'); }}
                                                        disabled={briefingInFlightRef.current || sending}
                                                        className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center border border-[rgba(201,178,124,0.13)] bg-[rgba(201,178,124,0.04)] text-[rgba(201,178,124,0.42)] hover:bg-[rgba(201,178,124,0.11)] hover:text-[#C9B27C] disabled:opacity-25 transition-all duration-200"
                                                        title="Repetir briefing"
                                                    >
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                            <path d="M1 4v6h6M23 20v-6h-6" />
                                                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => { stopGlobalAudio(); setTtsEnabled(prev => !prev); }}
                                                        className={`w-[30px] h-[30px] rounded-[10px] flex items-center justify-center border transition-all duration-200 ${ttsEnabled
                                                            ? 'border-[rgba(201,178,124,0.22)] bg-[rgba(201,178,124,0.09)] text-[#C9B27C]'
                                                            : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.22)]'} hover:bg-[rgba(255,255,255,0.06)]`}
                                                        title={ttsEnabled ? 'Silenciar voz' : 'Activar voz'}
                                                    >
                                                        {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent" />

                                            {/* Respuesta Lucy en Cormorant — sin cuadro gris */}
                                            <AnimatePresence>
                                                {(lastInteraction || briefingText) && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0 }}
                                                        className="relative max-h-[88px] overflow-hidden"
                                                    >
                                                        <p
                                                            className="text-[rgba(255,255,255,0.5)]"
                                                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '15px', lineHeight: '1.85' }}
                                                        >
                                                            {lastInteraction || briefingText}
                                                        </p>
                                                        <div className="absolute inset-x-0 bottom-0 h-[22px] bg-gradient-to-t from-[rgba(3,7,16,0.99)] to-transparent pointer-events-none" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Input conversacional */}
                                            <form
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    const input = e.target.elements.lucyInput;
                                                    const text = input.value.trim();
                                                    if (!text || sending) return;
                                                    input.value = '';
                                                    await sendToLucy(text);
                                                }}
                                            >
                                                <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] focus-within:border-[rgba(201,178,124,0.16)] transition-colors duration-200">
                                                    <input
                                                        name="lucyInput"
                                                        type="text"
                                                        placeholder={sending ? 'Lucy está pensando…' : 'Escríbeme lo que necesites…'}
                                                        disabled={sending}
                                                        className="flex-1 bg-transparent text-[13px] text-[rgba(242,247,255,0.88)] placeholder:text-[rgba(160,174,198,0.28)] focus:outline-none disabled:opacity-40"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={sending}
                                                        className="w-[32px] h-[32px] rounded-[11px] flex items-center justify-center flex-shrink-0 border border-[rgba(201,178,124,0.15)] bg-[rgba(201,178,124,0.07)] text-[rgba(201,178,124,0.75)] hover:bg-[rgba(201,178,124,0.14)] hover:text-[#C9B27C] disabled:opacity-30 transition-all duration-200"
                                                    >
                                                        {sending
                                                            ? <div className="w-3 h-3 border border-[rgba(201,178,124,0.3)] border-t-[#C9B27C] rounded-full animate-spin" />
                                                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                                        }
                                                    </button>
                                                </div>
                                            </form>
                                        </motion.div>
                                    )}

                                    {/* ── MODO MANOS LIBRES ── */}
                                    {handsFreeModeActive && (
                                        <motion.div
                                            key="manos-libres"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.35 }}
                                            className="flex flex-col items-center px-6 pt-5 pb-6 gap-5"
                                        >
                                            {/* Estado Lucy */}
                                            <div className="text-center">
                                                <p className="text-[10px] text-[rgba(201,178,124,0.42)] uppercase tracking-[0.28em] font-medium mb-[5px]">Lucy</p>
                                                <div className="flex items-center justify-center gap-[7px]">
                                                    <span
                                                        className="inline-block w-[5px] h-[5px] rounded-full bg-[#C9B27C] shadow-[0_0_6px_rgba(201,178,124,0.8)]"
                                                        style={{ animation: 'lucyPulse 1.5s ease-in-out infinite' }}
                                                    />
                                                    <span className="text-[10px] text-[rgba(255,255,255,0.16)] uppercase tracking-[0.14em]">
                                                        {isSpeaking ? 'Hablando…' : isListening ? 'Escuchando…' : isProcessing ? 'Pensando…' : 'Contigo'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Banda de ondas — estrecha y centrada */}
                                            <div className="relative w-full overflow-hidden" style={{ height: '100px' }}>
                                                <LucyPulseCanvas
                                                    state={canvasState}
                                                    level={canvasLevel}
                                                    waveform={waveform}
                                                />
                                                <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[rgba(3,7,16,0.99)] to-transparent pointer-events-none z-10" />
                                                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[rgba(3,7,16,0.99)] to-transparent pointer-events-none z-10" />
                                            </div>

                                            {/* Transcript — lo que dice Lucy */}
                                            <AnimatePresence>
                                                {lastInteraction && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className="text-center min-h-[48px]"
                                                    >
                                                        <p
                                                            className="text-[rgba(255,255,255,0.32)]"
                                                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '15px', lineHeight: '1.8' }}
                                                        >
                                                            {lastInteraction}
                                                        </p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Botón detener */}
                                            <button
                                                onClick={cancel}
                                                className="flex items-center gap-2 px-5 py-[9px] rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] text-[rgba(255,255,255,0.22)] text-[10px] uppercase tracking-[0.14em] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.45)] transition-all duration-200"
                                            >
                                                <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                                </svg>
                                                Detener
                                            </button>
                                        </motion.div>
                                    )}

                                </AnimatePresence>

                                <style>{`@keyframes lucyPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
                            </motion.div>

                        </>
                    )}
                </div>

                <ReminderToast reminder={currentReminder} onDismiss={dismissReminder} />
                <AlertToast alert={currentAlert} onDismiss={dismissAlert} />
            </>
        </Layout>
    );
}

