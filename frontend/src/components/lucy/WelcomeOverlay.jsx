import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WelcomeOverlay v2.0 — Conversacion real de bienvenida
 *
 * Flujo:
 *   1. Aparece -> saluda por voz inmediatamente (speak prop)
 *   2. Escucha respuesta del usuario (SpeechRecognition propio)
 *   3. Envia al assistant -> respuesta natural + invitacion al briefing
 *   4. Si briefing detectado -> onStart()
 *   5. Si goodbye -> onSkip()
 *   6. Retry por voz a los 10s si no hay respuesta
 *   7. Botones solo como ultimo fallback (2a vez sin respuesta)
 *
 * Props:
 *   speak(text, onEnd)   -- del VoiceEngine, unico TTS
 *   userName             -- primer nombre del usuario
 *   onStart()            -- iniciar briefing
 *   onSkip()             -- cerrar overlay sin briefing
 *   onVoiceCommand(text) -- comando libre
 *   greeting             -- saludo segun hora
 */

const BRIEFING_TRIGGERS = [
    'briefing', 'que tengo hoy', 'resumen del dia', 'resumen matutino',
    'ponme al dia', 'cuentame el dia', 'como tenemos el dia',
    'como esta el dia', 'que hay hoy',
    'si cuentame', 'dale', 'venga', 'va', 'si', 'claro',
    'porfa', 'por favor', 'cuentame', 'si por favor', 'si venga',
    'dime', 'adelante', 'quiero saber', 'si quiero', 'si claro',
];

const GOODBYE_TRIGGERS = [
    'no gracias', 'no nada', 'ahora no', 'luego',
    'no lucy', 'no quiero', 'otro momento',
    'mas tarde', 'ahora mismo no',
];

function _norm(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function _isBriefing(text) {
    const n = _norm(text);
    return BRIEFING_TRIGGERS.some(t => n.includes(t));
}

function _isGoodbye(text) {
    const n = _norm(text);
    return GOODBYE_TRIGGERS.some(t => n === t || n.startsWith(t));
}

const PHASE = {
    GREETING: 'greeting',
    LISTENING: 'listening',
    THINKING: 'thinking',
    SPEAKING: 'speaking',
    FALLBACK: 'fallback',
};

export default function WelcomeOverlay({
    speak,
    userName,
    onStart,
    onSkip,
    onVoiceCommand,
    greeting,
}) {
    const [phase, setPhase] = useState(PHASE.GREETING);
    const [transcript, setTranscript] = useState('');
    const [lucyText, setLucyText] = useState('');
    const [dots, setDots] = useState('');

    const recRef = useRef(null);
    const retryRef = useRef(null);
    const retryCountRef = useRef(0);
    const mountedRef = useRef(true);

    // Animacion de puntos mientras escucha
    useEffect(() => {
        if (phase !== PHASE.LISTENING) return;
        const id = setInterval(() => {
            setDots(d => d.length >= 3 ? '' : d + '.');
        }, 500);
        return () => clearInterval(id);
    }, [phase]);

    // Cleanup al desmontar
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            stopListening();
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const stopListening = useCallback(() => {
        if (recRef.current) {
            const rec = recRef.current;
            recRef.current = null;
            rec._killed = true;
            rec.onresult = null;
            rec.onerror = null;
            rec.onend = null;
            try { rec.stop(); } catch (_) {}
        }
    }, []);

    const handleUserResponse = useCallback((text) => {
        if (mountedRef.current === false) return;
        if (_isGoodbye(text)) { onSkip(); return; }
        if (_isBriefing(text)) { onStart(); return; }

        setPhase(PHASE.THINKING);
        setTranscript('');

        import('../../services/apiClient').then(({ default: apiClient }) => {
            const prompt = '[SALUDO_BIENVENIDA] El usuario dice: "' + text + '". Responde de forma muy natural y cercana, maximo 2 frases. Al final pregunta de forma natural si quiere saber como tiene el dia.';
            apiClient.post('/assistant', { text: prompt })
                .then(res => {
                    if (mountedRef.current === false) return;
                    const reply = res.data?.data?.assistant_text || res.data?.assistant_text || '';
                    if (reply) {
                        setLucyText(reply);
                        setPhase(PHASE.SPEAKING);
                        speak(reply, () => {
                            if (mountedRef.current === false) return;
                            retryCountRef.current = 2;
                            startListeningFinal();
                        });
                    } else {
                        onStart();
                    }
                })
                .catch(() => { if (mountedRef.current) onStart(); });
        });
    }, [speak, onStart, onSkip]);

    const startListeningFinal = useCallback(() => {
        if (mountedRef.current === false) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR === undefined || SR === null) { setPhase(PHASE.FALLBACK); return; }

        stopListening();
        setPhase(PHASE.LISTENING);
        setTranscript('');

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'es-ES';
        recRef.current = rec;

        let finalText = '';
        let silenceTimer = null;

        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => {
            if (mountedRef.current) { stopListening(); setPhase(PHASE.FALLBACK); }
        }, 10000);

        rec.onresult = (event) => {
            if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            let interim = '';
            let hasFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) { finalText += event.results[i][0].transcript; hasFinal = true; }
                else { interim += event.results[i][0].transcript; }
            }
            if (mountedRef.current) setTranscript(finalText + interim);
            const timeout = (hasFinal && interim.length === 0) ? 1800 : 2500;
            silenceTimer = setTimeout(() => {
                const cmd = finalText.trim();
                stopListening();
                if (cmd.length > 0) { handleUserResponse(cmd); }
                else { setPhase(PHASE.FALLBACK); }
            }, timeout);
        };

        rec.onerror = (e) => {
            if (silenceTimer) clearTimeout(silenceTimer);
            if (retryRef.current) clearTimeout(retryRef.current);
            if (e.error !== 'aborted' && e.error !== 'no-speech') {
                console.warn('[WelcomeOverlay] startListeningFinal error:', e.error);
                if (mountedRef.current) setPhase(PHASE.FALLBACK);
            }
        };
        rec.onend = () => {
            if (rec._killed) return;
            if (silenceTimer) clearTimeout(silenceTimer);
        };

        try { rec.start(); } catch (_) { setPhase(PHASE.FALLBACK); }
    }, [stopListening, handleUserResponse]);

    const startListening = useCallback(() => {
        if (mountedRef.current === false) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR === undefined || SR === null) { setPhase(PHASE.FALLBACK); return; }

        stopListening();
        setPhase(PHASE.LISTENING);
        setTranscript('');

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'es-ES';
        recRef.current = rec;

        let finalText = '';
        let silenceTimer = null;

        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => {
            if (mountedRef.current === false) return;
            if (retryCountRef.current === 0) {
                retryCountRef.current = 1;
                stopListening();
                const retryMsg = '¿Quieres que te cuente cómo tienes el día?';
                setLucyText(retryMsg);
                setPhase(PHASE.SPEAKING);
                speak(retryMsg, () => {
                    if (mountedRef.current === false) return;
                    retryCountRef.current = 2;
                    startListeningFinal();
                });
            }
        }, 10000);

        rec.onresult = (event) => {
            if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            let interim = '';
            let hasFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) { finalText += event.results[i][0].transcript; hasFinal = true; }
                else { interim += event.results[i][0].transcript; }
            }
            if (mountedRef.current) setTranscript(finalText + interim);
            const timeout = (hasFinal && interim.length === 0) ? 1800 : 2500;
            silenceTimer = setTimeout(() => {
                const cmd = finalText.trim();
                stopListening();
                if (cmd.length > 0) { handleUserResponse(cmd); }
            }, timeout);
        };

        rec.onerror = (e) => {
            if (silenceTimer) clearTimeout(silenceTimer);
            if (retryRef.current) clearTimeout(retryRef.current);
            if (e.error !== 'aborted' && e.error !== 'no-speech') {
                console.warn('[WelcomeOverlay] rec error:', e.error);
                if (mountedRef.current) setPhase(PHASE.FALLBACK);
            }
        };
        rec.onend = () => {
            if (rec._killed) return;
            if (silenceTimer) clearTimeout(silenceTimer);
        };

        try { rec.start(); } catch (_) { setPhase(PHASE.FALLBACK); }
    }, [speak, stopListening, handleUserResponse, startListeningFinal]);

    // Saludo inicial al montar
    useEffect(() => {
        if (speak === undefined || speak === null) return;
        if (mountedRef.current === false) return;
        const firstName = userName ? userName.split(' ')[0] : '';
        const hour = new Date().getHours();
        let saludoVoz;
        if (hour < 12) {
            saludoVoz = 'Buenos días' + (firstName ? ', ' + firstName : '') + '. ¿Qué tal amaneces hoy?';
        } else if (hour < 20) {
            saludoVoz = 'Buenas tardes' + (firstName ? ', ' + firstName : '') + '. ¿Cómo estás?';
        } else {
            saludoVoz = 'Buenas noches' + (firstName ? ', ' + firstName : '') + '. ¿Qué tal ha ido el día?';
        }

        setLucyText(saludoVoz);
        setPhase(PHASE.GREETING);

        const t = setTimeout(() => {
            if (mountedRef.current === false) return;
            speak(saludoVoz, () => {
                if (mountedRef.current === false) return;
                startListening();
            });
        }, 600);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showFallback = phase === PHASE.FALLBACK;

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
                <motion.div
                    className="flex items-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <StatusDot phase={phase} />
                    <span
                        className="text-[10px] uppercase tracking-[0.18em]"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                        {phaseLabel(phase)}
                    </span>
                </motion.div>

                <div className="space-y-4 text-center w-full">
                    <AnimatePresence mode="wait">
                        {lucyText && (
                            <motion.h2
                                key={lucyText}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.5 }}
                                className="text-white font-light leading-snug"
                                style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: '2rem',
                                    fontStyle: 'italic',
                                }}
                            >
                                {lucyText}
                            </motion.h2>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {phase === PHASE.LISTENING && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[13px] leading-relaxed"
                                style={{ color: 'rgba(201,178,124,0.6)' }}
                            >
                                {transcript
                                    ? ('"' + transcript + '"')
                                    : <span style={{ color: 'rgba(255,255,255,0.2)' }}>{'Te escucho' + dots}</span>
                                }
                            </motion.p>
                        )}
                        {phase === PHASE.THINKING && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[12px]"
                                style={{ color: 'rgba(255,255,255,0.2)' }}
                            >
                                Un momento...
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {showFallback && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center gap-4 w-full"
                        >
                            <button
                                onClick={onStart}
                                className="group relative w-full py-4 rounded-2xl bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.3)] text-[#C9B27C] text-[11px] uppercase tracking-[0.12em] font-medium hover:bg-[rgba(201,178,124,0.18)] hover:border-[rgba(201,178,124,0.5)] transition-all duration-300 overflow-hidden"
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
                                className="text-[10px] uppercase tracking-[0.1em] transition-colors duration-200"
                                style={{ color: 'rgba(255,255,255,0.18)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.18)'}
                            >
                                Entrar sin audio
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}

function StatusDot({ phase }) {
    const colors = {
        greeting: '#C9B27C',
        listening: '#00B4D8',
        thinking: '#9B7ED8',
        speaking: '#C9B27C',
        fallback: 'rgba(255,255,255,0.2)',
    };
    const color = colors[phase] || 'rgba(255,255,255,0.2)';
    const pulse = phase === 'greeting' || phase === 'listening' || phase === 'speaking';

    return (
        <div style={{ position: 'relative', width: 8, height: 8 }}>
            {pulse && (
                <motion.div
                    animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
                />
            )}
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color, transition: 'background 0.4s',
            }} />
        </div>
    );
}

function phaseLabel(phase) {
    const labels = {
        greeting: 'Lucy',
        listening: 'Escuchando',
        thinking: 'Un momento',
        speaking: 'Lucy',
        fallback: 'Lucy',
    };
    return labels[phase] || '';
}
