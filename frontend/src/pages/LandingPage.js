import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Mail,
  Sparkles,
  Zap,
  Shield,
  Target,
  LayoutDashboard,
  Loader2,
  CreditCard,
  CheckCircle,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

/* ───────── Animation helpers ───────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' },
  }),
};

/* ───────── How-it-works card ───────── */
const StepCard = ({ icon, title, text, index }) => (
  <motion.div
    custom={index}
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.3 }}
    className="glass-subtle rounded-2xl p-6 flex flex-col items-start gap-4"
  >
    <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
      <span className="text-blue-400">{icon}</span>
    </div>
    <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
  </motion.div>
);

/* ───────── Benefit row ───────── */
const Benefit = ({ text }) => (
  <div className="flex items-start gap-3">
    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
    <span className="text-slate-300 text-sm">{text}</span>
  </div>
);

/* ═══════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════ */
export default function LandingPage() {
  const { token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  /* ── Scroll to hash anchor (e.g. #pricing) ── */
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  /* ── Stripe checkout (same flow as OverviewPage) ── */
  const startCheckout = async () => {
    if (!token) {
      navigate('/auth');
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await axios.post(
        `${API}/billing/checkout?plan=monthly`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const checkoutUrl =
        res.data?.data?.checkout_url ||
        res.data?.checkout_url;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else {
        console.error('No checkout URL in response:', res.data);
      }
    } catch (err) {
      console.error('Stripe checkout error:', err.response?.data || err);
      alert('Error conectando con Stripe');
    } finally {
      setCheckoutLoading(false);
    }
  };

  /* ── CTA button (reused in hero + pricing) ── */
  const CtaButton = ({ className = '' }) => (
    <Button
      onClick={startCheckout}
      disabled={checkoutLoading}
      className={`bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 px-6 py-3 text-base font-semibold ${className}`}
    >
      {checkoutLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <CreditCard className="w-5 h-5" />
      )}
      Activar suscripción
    </Button>
  );

  return (
    <div className="min-h-screen relative">
      {/* Background — same as the rest of the app */}
      <div className="bg-neural" />

      {/* ─── NAVBAR ─── */}
      <header className="glass-premium border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-28 py-3">
          <div className="flex items-center gap-3">
            {/* Logo eliminado por ausencia de archivo LogoEmail.png */}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/app')}
                  className="text-slate-300 hover:text-slate-100 gap-2 text-base font-medium"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Mi cuenta
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { logout(); navigate('/auth'); }}
                  className="text-slate-400 hover:text-red-400 gap-2 text-base font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="text-white hover:text-slate-100 gap-2 text-base font-medium"
              >
                Iniciar sesión
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-8 text-center">
        <LandingNeuralFieldCanvas style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '200px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <motion.div style={{ position: 'relative', zIndex: 1 }} variants={fadeUp} initial="hidden" animate="visible">
          <h1 className="text-4xl sm:text-6xl font-bold text-slate-100 leading-tight mb-6">
            Email Control System
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Reduce el ruido, identifica lo importante y toma decisiones más rápido.
            Un sistema inteligente que clasifica, prioriza y te asiste con IA.
          </p>
        </motion.div>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-12"
        >
          Cómo funciona
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          <StepCard
            index={0}
            icon={<Sparkles className="w-6 h-6" />}
            title="Clasificación inteligente"
            text="Analiza cada correo y lo clasifica automáticamente por urgencia, tipo y contexto. Sin reglas manuales."
          />
          <StepCard
            index={1}
            icon={<Target className="w-6 h-6" />}
            title="Prioridades reales"
            text="Identifica qué necesita acción inmediata y qué puede esperar. Tú decides, no tu bandeja."
          />
          <StepCard
            index={2}
            icon={<Zap className="w-6 h-6" />}
            title="Asistente IA"
            text="Pregunta lo que necesites: busca correos, resume hilos, filtra por remitente. En lenguaje natural."
          />
        </div>
      </section>

      {/* ─── DEMO ─── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="glass-premium rounded-2xl p-10 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-3">
            Pruébalo en acción
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
            Explora una bandeja de ejemplo y entiende cómo Email Control toma el control por ti.
          </p>

          <Button
            onClick={() => navigate(isAuthenticated ? '/app' : '/auth')}
            className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 px-6 py-3 text-base font-semibold mx-auto"
          >
            Entrar en la demo
            <ArrowRight className="w-5 h-5" />
          </Button>

          <p className="text-xs text-slate-500 mt-4">Sin tarjeta · Sin compromiso</p>
        </motion.div>
      </section>

      {/* ─── BENEFICIOS ─── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-bold text-slate-100 text-center mb-12"
        >
          Lo que cambia para ti
        </motion.h2>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="glass-subtle rounded-2xl p-8 grid sm:grid-cols-2 gap-5"
        >
          <Benefit text="Menos ruido: solo ves lo que importa" />
          <Benefit text="Más foco: prioridades claras cada mañana" />
          <Benefit text="Decisiones rápidas: contexto al instante" />
          <Benefit text="Un solo panel: todo tu correo, organizado" />
        </motion.div>
      </section>

      {/* ─── PRECIO ─── */}
      <section id="pricing" className="relative z-10 max-w-xl mx-auto px-6 py-20 text-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="glass-premium rounded-2xl p-10"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Plan mensual</h2>
          <p className="text-5xl font-bold text-gradient mb-1">19 €</p>
          <p className="text-slate-400 mb-8">/ mes · sin compromiso</p>

          <ul className="text-left max-w-xs mx-auto space-y-3 mb-8">
            <Benefit text="Clasificación automática ilimitada" />
            <Benefit text="Priorización inteligente" />
            <Benefit text="Asistente IA incluido" />
            <Benefit text="Soporte por email" />
          </ul>

          <CtaButton className="w-full justify-center" />
        </motion.div>
      </section>

      {/* ─── CIERRE ─── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20 text-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Shield className="w-8 h-8 text-slate-500 mx-auto mb-4" />
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            Tus datos están protegidos. No almacenamos contenido de correos.
            Cancela cuando quieras sin preguntas.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
