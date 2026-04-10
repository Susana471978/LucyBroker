import { motion } from 'framer-motion';

export default function WelcomeOverlay({ onStart, onSkip, greeting }) {
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
