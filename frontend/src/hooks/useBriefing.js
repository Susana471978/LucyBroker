import { useState, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';
import { setGlobalAudio, stopGlobalAudio } from '../voice/useVoiceEngine';

export default function useBriefing({ token, ttsEnabled }) {
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomePhase, setWelcomePhase] = useState('idle');
    const [briefingVisible, setBriefingVisible] = useState(false);
    const [briefingText, setBriefingText] = useState('');
    const [briefingIsSpeaking, setBriefingIsSpeaking] = useState(false);
    const [sending, setSending] = useState(false);

    // ── Email pendiente de confirmación ──────────────────────────────
    // { id, to_name, to_email, subject, body, needs_confirm }
    const [pendingEmail, setPendingEmail] = useState(null);

    const briefingDoneRef = useRef(false);
    const briefingInFlightRef = useRef(false);
    const briefingAudioRef = useRef(null);
    const audioCtxRef = useRef(null);

    // ── TTS helper reutilizable ──────────────────────────────────────
    const speakText = useCallback(async (text) => {
        if (!ttsEnabled || !text) return;
        setBriefingIsSpeaking(true);
        try {
            const ttsRes = await apiClient.post('/tts', { text }, { responseType: 'blob' });
            const url = URL.createObjectURL(ttsRes.data);
            const audio = new Audio(url);
            briefingAudioRef.current = audio;

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
    }, [ttsEnabled]);

    // ── sendToLucy — envío principal al asistente ────────────────────
    // Acepta opciones opcionales para el flujo de confirmación de email
    const sendToLucy = useCallback(async (text, options = {}) => {
        if (!text?.trim()) return;
        if (briefingInFlightRef.current) return;
        briefingInFlightRef.current = true;
        setSending(true);

        try {
            // Construir payload — incluye datos de confirmación si los hay
            const payload = { text };
            if (options.confirm_email !== undefined) {
                payload.confirm_email = options.confirm_email;
            }
            if (options.pending_email_id) {
                payload.pending_email_id = options.pending_email_id;
            }

            const res = await apiClient.post('/assistant', payload);
            const data = res.data?.data || res.data;
            const reply = data?.assistant_text || '';

            // ── Gestionar email pendiente ────────────────────────────
            if (data?.pending_email?.needs_confirm) {
                // Lucy ha redactado un borrador — mostrar panel de confirmación
                setPendingEmail(data.pending_email);
            } else {
                // Cualquier otra respuesta limpia el pending (envío confirmado, cancelado, etc.)
                setPendingEmail(null);
            }

            // ── Acciones de navegación / UI ──────────────────────────
            if (Array.isArray(data?.actions)) {
                data.actions.forEach(action => {
                    if (action.type === 'email_sent') {
                        setPendingEmail(null);
                    }
                    if (action.type === 'email_cancelled') {
                        setPendingEmail(null);
                    }
                });
            }

            if (reply) {
                // Solo mostrar overlay de briefing si es un briefing real
                // (no para confirmaciones de email u otras respuestas cortas)
                const isBriefingReply = reply.length > 200 || 
                    options.confirm_email === undefined;
                if (isBriefingReply && options.confirm_email === undefined) {
                    setBriefingText(reply);
                    setBriefingVisible(true);
                }
                setBriefingIsSpeaking(false);
                await speakText(reply);
            }

            return reply;
        } catch (err) {
            console.error('Lucy error:', err);
        } finally {
            setSending(false);
            briefingInFlightRef.current = false;
        }
    }, [speakText]);

    // ── Confirmar envío de email ─────────────────────────────────────
    const confirmEmailSend = useCallback(async () => {
        if (!pendingEmail) return;
        await sendToLucy('sí, envíalo', {
            confirm_email: true,
            pending_email_id: pendingEmail.id,
        });
    }, [pendingEmail, sendToLucy]);

    // ── Cancelar email pendiente ─────────────────────────────────────
    const cancelEmailSend = useCallback(async () => {
        if (!pendingEmail) return;
        await sendToLucy('cancela', {
            confirm_email: false,
            pending_email_id: pendingEmail.id,
        });
    }, [pendingEmail, sendToLucy]);

    // ── Briefing ─────────────────────────────────────────────────────
    const runBriefing = useCallback(async (promptText = 'buenos días Lucy, dame mi briefing matutino') => {
        setShowWelcome(false);
        setWelcomePhase('thinking');
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

    const dismissBriefing = useCallback(() => {
        stopGlobalAudio();
        setBriefingVisible(false);
        setBriefingIsSpeaking(false);
        briefingAudioRef.current = null;
        setWelcomePhase('idle');
    }, []);

    const handleSkip = useCallback(() => {
        sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
        setShowWelcome(false);
        setWelcomePhase('idle');
    }, []);

    const checkShowWelcome = useCallback(({ gmailLoading, gmailConnected, loading }) => {
        if (!token || gmailLoading || !gmailConnected || loading || briefingDoneRef.current) return;
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        if (sessionStorage.getItem(todayKey)) return;
        briefingDoneRef.current = true;
        const timer = setTimeout(() => setShowWelcome(true), 600);
        return () => clearTimeout(timer);
    }, [token]);

    return {
        showWelcome,
        welcomePhase,
        briefingVisible,
        briefingText,
        briefingIsSpeaking,
        sending,
        briefingInFlightRef,
        briefingAudioRef,
        pendingEmail,
        sendToLucy,
        confirmEmailSend,
        cancelEmailSend,
        runBriefing,
        dismissBriefing,
        handleSkip,
        checkShowWelcome,
    };
}