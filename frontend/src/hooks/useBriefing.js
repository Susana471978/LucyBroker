import { useState, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';
import { stopGlobalAudio } from '../voice/useVoiceEngine';

export default function useBriefing({
    token,
    ttsEnabled,
    pendingEmail = null,
    setPendingEmail = () => {},
    listenForFollowUp = null,
    speak = null,
}) {
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomePhase, setWelcomePhase] = useState('idle');
    const [briefingVisible, setBriefingVisible] = useState(false);
    const [briefingText, setBriefingText] = useState('');
    const [briefingIsSpeaking, setBriefingIsSpeaking] = useState(false);
    const [sending, setSending] = useState(false);

    const briefingDoneRef = useRef(false);
    const briefingInFlightRef = useRef(false);

    // ── speakVia — delega siempre en el engine ───────────────────────
    const speakVia = useCallback((text, onEnd = null) => {
        if (!ttsEnabled || !text) {
            onEnd?.();
            return;
        }
        setBriefingIsSpeaking(true);
        if (speak) {
            speak(text, () => {
                setBriefingIsSpeaking(false);
                // Siempre volver a escuchar — bucle conversacional continuo
                if (listenForFollowUp) {
                    setTimeout(() => listenForFollowUp(), 400);
                }
                onEnd?.();
            });
        } else {
            setBriefingIsSpeaking(false);
            onEnd?.();
        }
    }, [ttsEnabled, speak, listenForFollowUp, pendingEmail]);

    // ── sendToLucy ───────────────────────────────────────────────────
    const sendToLucy = useCallback(async (text, options = {}) => {
        if (!text?.trim()) return;
        if (briefingInFlightRef.current) return;
        briefingInFlightRef.current = true;
        setSending(true);

        try {
            const payload = { text };
            if (options.confirm_email !== undefined) payload.confirm_email = options.confirm_email;
            if (options.pending_email_id) payload.pending_email_id = options.pending_email_id;

            const res = await apiClient.post('/assistant', payload);
            const data = res.data?.data || res.data;
            const reply = data?.assistant_text || '';

            if (data?.pending_email?.needs_confirm || data?.pending_email?.awaiting_body) {
                setPendingEmail?.(data.pending_email);
            } else {
                setPendingEmail?.(null);
            }

            if (Array.isArray(data?.actions)) {
                data.actions.forEach(action => {
                    if (action.type === 'email_sent' || action.type === 'email_cancelled') {
                        setPendingEmail?.(null);
                    }
                });
            }

            if (reply) {
                const isBriefingReply = options.confirm_email === undefined;
                if (isBriefingReply) {
                    setBriefingText(reply);
                    setBriefingVisible(true);
                }
                speakVia(reply);
            }

            return reply;
        } catch (err) {
            console.error('[Lucy] sendToLucy error:', err);
        } finally {
            setSending(false);
            briefingInFlightRef.current = false;
        }
    }, [speakVia, setPendingEmail]);

    // ── Confirmar / cancelar email ───────────────────────────────────
    const confirmEmailSend = useCallback(async () => {
        if (!pendingEmail) return;
        await sendToLucy('sí, envíalo', { confirm_email: true, pending_email_id: pendingEmail.id });
    }, [pendingEmail, sendToLucy]);

    const cancelEmailSend = useCallback(async () => {
        if (!pendingEmail) return;
        await sendToLucy('cancela', { confirm_email: false, pending_email_id: pendingEmail.id });
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
        setWelcomePhase('idle');
    }, []);

    const handleSkip = useCallback(() => {
        sessionStorage.setItem(`lucy_briefing_${new Date().toDateString()}`, '1');
        setShowWelcome(false);
        setWelcomePhase('idle');
    }, []);

    const checkShowWelcome = useCallback(({ gmailLoading, gmailConnected, loading }) => {
        if (!token || gmailLoading || !gmailConnected || loading) return;
        const todayKey = `lucy_briefing_${new Date().toDateString()}`;
        if (sessionStorage.getItem(todayKey)) return;
        sessionStorage.setItem(todayKey, 'pending');
        briefingDoneRef.current = true;
        const timer = setTimeout(() => setShowWelcome(true), 1200);
        return () => clearTimeout(timer);
    }, [token]);

    return {
        showWelcome, setShowWelcome, welcomePhase, briefingVisible, briefingText,
        briefingIsSpeaking, sending, briefingInFlightRef,
        pendingEmail, sendToLucy, confirmEmailSend, cancelEmailSend,
        runBriefing, dismissBriefing, handleSkip, checkShowWelcome,
    };
}
