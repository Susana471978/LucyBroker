import { motion } from 'framer-motion';

export default function ThinkingParticle() {
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
