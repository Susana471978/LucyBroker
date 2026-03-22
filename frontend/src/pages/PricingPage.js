import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import axios from 'axios';
import { Check, Star, Zap, Shield, Crown, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

const FEATURE_LABELS = {
    briefing_matutino: 'Briefing matutino con IA',
    email_prioritization: 'Priorización inteligente de emails',
    email_summary: 'Resúmenes de correo',
    single_email_account: '1 cuenta de email',
    calendar_integration: 'Integración Google Calendar',
    tasks_management: 'Gestión de tareas',
    voice_commands: 'Comandos de voz (Hola Lucy)',
    multi_email_accounts: 'Hasta 3 cuentas de email',
    crm_contacts: 'CRM de contactos inteligente',
    auto_reply: 'Respuestas automáticas',
    reminders: 'Recordatorios por voz y texto',
    personal_memory: 'Memoria personal persistente',
    daily_organization: 'Organización del día',
    habits_tracking: 'Seguimiento de hábitos',
    smart_notes: 'Notas inteligentes',
    proactive_alerts: 'Alertas proactivas',
    info_search: 'Búsqueda rápida de información',
};

/* ─────────────────────────────────────────────────────────
   PLAN CARD
───────────────────────────────────────────────────────── */
const PlanCard = ({ plan, currentPlans, onCheckout, loading, featured = false, delay = 0 }) => {
    const isActive = currentPlans.includes(plan.key);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-2xl overflow-hidden transition-all duration-300
        ${featured
                    ? 'border-2 shadow-[0_0_60px_rgba(201,178,124,0.06)]'
                    : 'border'
                }`}
            style={{
                background: featured ? 'rgba(201,178,124,0.03)' : 'rgba(4,18,32,0.4)',
                borderColor: featured ? 'rgba(201,178,124,0.25)' : 'rgba(0,180,216,0.08)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = featured ? 'rgba(201,178,124,0.4)' : 'rgba(0,180,216,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = featured ? 'rgba(201,178,124,0.25)' : 'rgba(0,180,216,0.08)'; }}
        >
            {featured && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.5)] to-transparent" />
            )}

            <div className="p-6 flex flex-col h-full">
                <div className="mb-5">
                    {featured && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.1em]
              bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)] mb-3 font-medium">
                            <Star className="w-3 h-3" />
                            Más popular
                        </div>
                    )}
                    <h3 className="text-lg font-medium text-[#E0F7FA] mb-1">{plan.tier === 'basic' ? 'Básico' : plan.tier === 'pro' ? 'Pro' : 'Business'}</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-light text-[#E0F7FA]">€{plan.price}</span>
                        <span className="text-xs text-[rgba(224,247,250,0.25)]">/mes</span>
                    </div>
                </div>

                <div className="flex-1 space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                        <div key={f} className="flex items-start gap-2.5">
                            <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${featured ? 'text-[#C9B27C]' : 'text-[rgba(0,180,216,0.5)]'}`} />
                            <span className="text-xs text-[rgba(224,247,250,0.5)] leading-relaxed">
                                {FEATURE_LABELS[f] || f}
                            </span>
                        </div>
                    ))}
                </div>

                {isActive ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl
            bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.2)] text-[#00B4D8] text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Plan activo
                    </div>
                ) : (
                    <button
                        onClick={() => onCheckout(plan.key)}
                        disabled={loading}
                        className={`w-full py-3 rounded-xl text-sm font-medium transition-all duration-300
              ${featured
                                ? 'bg-[rgba(201,178,124,0.15)] border border-[rgba(201,178,124,0.3)] text-[#C9B27C] hover:bg-[rgba(201,178,124,0.25)] hover:shadow-[0_0_30px_rgba(201,178,124,0.1)]'
                                : 'bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.15)] text-[rgba(224,247,250,0.6)] hover:bg-[rgba(0,180,216,0.1)] hover:text-[#E0F7FA]'
                            }
              disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                            'Elegir plan'
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

/* ─────────────────────────────────────────────────────────
   BUNDLE CARD
───────────────────────────────────────────────────────── */
const BundleCard = ({ plan, savings, currentPlans, onCheckout, loading, delay = 0 }) => {
    const isActive = currentPlans.includes(plan.key);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl overflow-hidden border transition-all duration-300"
            style={{
                background: 'rgba(4,18,32,0.3)',
                borderColor: 'rgba(0,180,216,0.08)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,178,124,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,180,216,0.08)'; }}
        >
            <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-sm font-medium text-[#E0F7FA]">
                            {plan.tier === 'basic' ? 'Básico' : plan.tier === 'pro' ? 'Pro' : 'Business + Pro'}
                        </h4>
                        {savings > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.2)] font-medium">
                                Ahorra €{savings}/mes
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[rgba(224,247,250,0.3)]">
                        Secretaria + Asistente Personal
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-2xl font-light text-[#E0F7FA]">€{plan.price}</span>
                        <span className="text-xs text-[rgba(224,247,250,0.25)]">/mes</span>
                    </div>

                    {isActive ? (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl
              bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.2)] text-[#00B4D8] text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Activo
                        </div>
                    ) : (
                        <button
                            onClick={() => onCheckout(plan.key)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium
                bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.25)] text-[#C9B27C]
                hover:bg-[rgba(201,178,124,0.2)] hover:border-[rgba(201,178,124,0.4)]
                disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
                        >
                            {loading ? (
                                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>Elegir <ArrowRight className="w-3 h-3" /></>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

/* ─────────────────────────────────────────────────────────
   PRICING PAGE
───────────────────────────────────────────────────────── */
export default function PricingPage() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [plans, setPlans] = useState(null);
    const [currentPlans, setCurrentPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await axios.get(`${API}/billing/plans`);
                const data = res.data?.data || res.data;
                setPlans(data.plans || {});
            } catch (err) { console.error('Plans fetch:', err); }
            finally { setLoading(false); }
        };
        fetchPlans();
    }, []);

    useEffect(() => {
        if (!token) return;
        const fetchSub = async () => {
            try {
                const res = await axios.get(`${API}/billing/subscription`, { headers });
                const data = res.data?.data || res.data;
                setCurrentPlans(data.plans || []);
            } catch (err) { console.error('Subscription fetch:', err); }
        };
        fetchSub();
    }, [token]);

    const handleCheckout = async (planKey) => {
        if (!token) {
            navigate('/auth');
            return;
        }
        setCheckoutLoading(true);
        try {
            const res = await axios.post(`${API}/billing/checkout?plan=${planKey}`, {}, { headers });
            const data = res.data?.data || res.data;
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            }
        } catch (err) {
            console.error('Checkout error:', err);
            alert('Error al iniciar el pago. Inténtalo de nuevo.');
        }
        finally { setCheckoutLoading(false); }
    };

    const bundleSavings = {
        bundle_basic: (19 + 14) - 25,
        bundle_pro: (29 + 24) - 40,
        bundle_business: (49 + 24) - 55,
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center py-32">
                    <div className="w-6 h-6 border-2 border-[rgba(0,180,216,0.3)] border-t-[#00B4D8] rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">

                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center max-w-2xl mx-auto"
                >
                    <p className="text-xs text-[rgba(0,180,216,0.5)] uppercase tracking-[0.15em] font-medium mb-4">Planes</p>
                    <h1 className="font-light text-[#E0F7FA] mb-4"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', lineHeight: 1.2 }}>
                        Elige cómo quieres que <span style={{ color: '#C9B27C' }}>Lucy</span> te ayude
                    </h1>
                    <p className="text-sm text-[rgba(224,247,250,0.3)] leading-relaxed">
                        Dos productos independientes. Contrata uno, el otro, o ambos con descuento.
                    </p>
                </motion.div>

                {/* ── SECRETARIA EJECUTIVA ── */}
                <section>
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                        className="flex items-center gap-3 mb-6"
                    >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.15)]">
                            <Shield className="w-4 h-4 text-[rgba(0,180,216,0.6)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-[#E0F7FA]">Lucy Secretaria Ejecutiva</h2>
                            <p className="text-xs text-[rgba(224,247,250,0.25)]">Gestión profesional del día a día</p>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans?.executive?.map((plan, i) => (
                            <PlanCard
                                key={plan.key}
                                plan={plan}
                                currentPlans={currentPlans}
                                onCheckout={handleCheckout}
                                loading={checkoutLoading}
                                featured={plan.tier === 'pro'}
                                delay={0.15 + i * 0.08}
                            />
                        ))}
                    </div>
                </section>

                {/* ── ASISTENTE PERSONAL ── */}
                <section>
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="flex items-center gap-3 mb-6"
                    >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(0,180,216,0.06)] border border-[rgba(0,180,216,0.15)]">
                            <Zap className="w-4 h-4 text-[rgba(0,180,216,0.6)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-[#E0F7FA]">Lucy Asistente Personal</h2>
                            <p className="text-xs text-[rgba(224,247,250,0.25)]">Tu vida organizada por voz</p>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                        {plans?.personal?.map((plan, i) => (
                            <PlanCard
                                key={plan.key}
                                plan={plan}
                                currentPlans={currentPlans}
                                onCheckout={handleCheckout}
                                loading={checkoutLoading}
                                featured={plan.tier === 'pro'}
                                delay={0.35 + i * 0.08}
                            />
                        ))}
                    </div>
                </section>

                {/* ── BUNDLE ── */}
                <section>
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(201,178,124,0.06)] border border-[rgba(201,178,124,0.15)]">
                                <Crown className="w-4 h-4 text-[rgba(201,178,124,0.6)]" />
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-[#E0F7FA]">Lucy Completa</h2>
                                <p className="text-xs text-[rgba(224,247,250,0.25)]">Ambos productos con 25% de descuento</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {plans?.bundle?.map((plan, i) => (
                                <BundleCard
                                    key={plan.key}
                                    plan={plan}
                                    savings={bundleSavings[plan.key] || 0}
                                    currentPlans={currentPlans}
                                    onCheckout={handleCheckout}
                                    loading={checkoutLoading}
                                    delay={0.55 + i * 0.08}
                                />
                            ))}
                        </div>
                    </motion.div>
                </section>

                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                    className="text-center py-8"
                >
                    <p className="text-xs text-[rgba(224,247,250,0.2)] leading-relaxed max-w-md mx-auto">
                        Prueba Lucy gratis durante 4 horas. Sin compromiso, cancela cuando quieras.
                        Los precios no incluyen IVA.
                    </p>
                </motion.div>
            </div>
        </Layout>
    );
}