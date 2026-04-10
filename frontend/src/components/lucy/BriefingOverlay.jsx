import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LucyPulseCanvas from '../LucyPulseCanvas';

export default function BriefingOverlay({ text, onDismiss, isSpeaking, canvasState, canvasLevel, waveform, audioRef }) {
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
