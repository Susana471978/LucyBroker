import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

export default function WelcomeOverlay({ onStart, onSkip, greeting, speak, listenForFollowUp, userName }) {
    const [phase, setPhase] = useState('speaking'); // speaking | listening | ready
    const hasSpokenRef = useRef(false);

    const firstName = userName?.split(' ')[0] || '';

    useEffect(() => {
        if (hasSpokenRef.current) return;
        hasSpokenRef.current = true;

        const hour = new Date().getHours();
        const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
        const greetingText = `${saludo}${firstName ? ', ' + firstName : ''}. ¿Cómo estás hoy?`;

        if (speak) {
            speak(greetingText, () => {
                setPhase('listening');
                if (listenForFollowUp) {
                    listenForFollowUp();
                }
                // Después de 8s — el engine habrá respondido, mostramos botones
                setTimeout(() => setPhase('ready'), 8000);
            });
        } else {
            setTimeout(() => setPhase('ready'), 1500);
        }
    }, []);

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
                <div className="space-y-6 text-center w-full">
                    <motion.p className="text-[11px] text-[rgba(255,255,255,0.25)] uppercase tracking-[0.18em]">
                        {greeting}
                    </motion.p>

                    <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.6 }}
                        className="text-white font-light leading-tight"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', fontStyle: 'italic' }}
                    >
                        {phase === 'speaking' && `${firstName ? 'Hola, ' + firstName : 'Hola'}…`}
                        {phase === 'listening' && '¿Cómo estás hoy?'}
                        {phase === 'ready' && '¿Quieres que te cuente cómo tienes el día?'}
                    </motion.h2>

                    <AnimatePresence>
                        {phase === 'listening' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center justify-center gap-2"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#C9B27C] animate-pulse" />
                                <span className="text-[11px] text-[rgba(201,178,124,0.5)] uppercase tracking-[0.12em]">
                                    escuchando
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {phase === 'ready' && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
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
                                    Sí, cuéntame
                                </span>
                            </button>
                            <button
                                onClick={onSkip}
                                className="text-[10px] text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.4)]
                                    uppercase tracking-[0.1em] transition-colors duration-200"
                            >
                                Ahora no →
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
