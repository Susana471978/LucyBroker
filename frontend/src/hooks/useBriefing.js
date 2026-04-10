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

    const briefingDoneRef = useRef(false);
    const briefingInFlightRef = useRef(false);
    const briefingAudioRef = useRef(null);
    const audioCtxRef = useRef(null);

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
        sendToLucy,
        runBriefing,
        dismissBriefing,
        handleSkip,
        checkShowWelcome,
    };
}
