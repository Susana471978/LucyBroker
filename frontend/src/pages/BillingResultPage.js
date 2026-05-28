// frontend/src/pages/BillingResultPage.js

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import { Check, X, ArrowRight } from 'lucide-react';

export function BillingSuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate('/app');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [navigate]);

    return (
        <Layout>
            <div className="max-w-md mx-auto px-6 py-32 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-8"
                >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center
            bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.25)]">
                        <Check className="w-8 h-8 text-emerald-400" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-light text-[var(--text-primary)] mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            ¡Bienvenido a Lucy!
                        </h1>
                        <p className="text-sm text-[rgba(255,255,255,0.4)] leading-relaxed">
                            Tu suscripción está activa. Lucy ya tiene acceso completo a todas las funciones de tu plan.
                        </p>
                    </div>

                    <button onClick={() => navigate('/app')}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.25)] text-[var(--champagne)]
              hover:bg-[rgba(201,178,124,0.2)] transition-all duration-300">
                        Ir al panel <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-xs text-[rgba(255,255,255,0.15)]">
                        Redirigiendo en {countdown}s...
                    </p>
                </motion.div>
            </div>
        </Layout>
    );
}

export function BillingCancelPage() {
    const navigate = useNavigate();

    return (
        <Layout>
            <div className="max-w-md mx-auto px-6 py-32 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-8"
                >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center
            bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)]">
                        <X className="w-8 h-8 text-[var(--text-tertiary)]" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-light text-[var(--text-primary)] mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            Pago cancelado
                        </h1>
                        <p className="text-sm text-[rgba(255,255,255,0.4)] leading-relaxed">
                            No se ha realizado ningún cargo. Puedes volver a elegir un plan cuando quieras.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => navigate('/app/pricing')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.25)] text-[var(--champagne)]
                hover:bg-[rgba(201,178,124,0.2)] transition-all duration-300">
                            Ver planes
                        </button>
                        <button onClick={() => navigate('/app')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                border border-[var(--border-subtle)] text-[rgba(255,255,255,0.4)]
                hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300">
                            Ir al panel
                        </button>
                    </div>
                </motion.div>
            </div>
        </Layout>
    );
}