import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Check } from 'lucide-react';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';

const PLANS = [
  {
    key: 'basic',
    name: 'Básico',
    price: '19',
    period: '/mes',
    badge: null,
    featured: false,
    buttonText: 'Comenzar ahora',
    features: [
      'Briefing matutino con IA',
      'Priorización inteligente de emails',
      'Resúmenes de correo',
      '1 cuenta de email',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '29',
    period: '/mes',
    badge: 'Más popular',
    featured: true,
    buttonText: 'Elegir plan',
    features: [
      'Briefing matutino con IA',
      'Priorización inteligente de emails',
      'Resúmenes de correo',
      '1 cuenta de email',
      'Integración Google Calendar',
      'Gestión de tareas',
      'Comandos de voz (Hola Lucy)',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: '49',
    period: '/mes',
    badge: null,
    featured: false,
    buttonText: 'Comenzar ahora',
    features: [
      'Briefing matutino con IA',
      'Priorización inteligente de emails',
      'Resúmenes de correo',
      '1 cuenta de email',
      'Integración Google Calendar',
      'Gestión de tareas',
      'Comandos de voz (Hola Lucy)',
      'Hasta 3 cuentas de email',
      'CRM de contactos inteligente',
      'Respuestas automáticas',
    ],
  },
];

function PlanCard({ plan, onCheckout, loadingPlan }) {
  const isLoading = loadingPlan === plan.key;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`relative rounded-[30px] p-8 md:p-10 min-h-[620px] flex flex-col justify-between ${plan.featured ? 'pricing-card-featured' : 'pricing-card-standard'
        }`}
    >
      <div>
        {plan.badge && (
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 pricing-badge">
            <Star className="w-3.5 h-3.5" />
            <span>{plan.badge}</span>
          </div>
        )}

        <h3 className="pricing-plan-name">{plan.name}</h3>

        <div className="flex items-end gap-2 mt-4 mb-10">
          <span className="pricing-price">€{plan.price}</span>
          <span className="pricing-period">{plan.period}</span>
        </div>

        <ul className="space-y-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 pricing-feature-item">
              <Check
                className={`w-4 h-4 mt-[2px] flex-shrink-0 ${plan.featured ? 'text-[#C9B27C]' : 'text-[#5DB7FF]'
                  }`}
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => onCheckout(plan)}
        disabled={isLoading}
        className={`mt-10 w-full pricing-cta ${plan.featured ? 'pricing-cta-featured' : 'pricing-cta-standard'
          }`}
      >
        {isLoading ? (
          <span className="inline-flex items-center justify-center">
            <span className="pricing-spinner" />
          </span>
        ) : (
          plan.buttonText
        )}
      </button>
    </motion.div>
  );
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState(null);

  const plans = useMemo(() => PLANS, []);

  const handleCheckout = async (plan) => {
    setLoadingPlan(plan.key);

    try {
      const response = await apiClient.post('/billing/checkout', {
        plan: plan.key,
        billing_cycle: 'monthly',
      });

      const data = response?.data?.data || response?.data || {};
      const checkoutUrl = data.checkout_url || data.url || data.session_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      throw new Error('No checkout URL returned');
    } catch (error) {
      alert('Error al iniciar el pago. Inténtalo de nuevo.');
      console.error('Checkout error:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Layout>
      <style>{`
        .pricing-shell {
          min-height: 100%;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 12%, rgba(24, 84, 190, 0.10) 0%, rgba(5, 8, 16, 0) 30%),
            radial-gradient(circle at 50% 100%, rgba(16, 76, 190, 0.10) 0%, rgba(0, 0, 0, 0) 35%),
            linear-gradient(180deg, #030508 0%, #020306 100%);
        }

        .pricing-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 14% 14%, rgba(201,178,124,0.16) 0 1px, transparent 2px),
            radial-gradient(circle at 26% 9%, rgba(201,178,124,0.12) 0 1px, transparent 2px),
            radial-gradient(circle at 44% 8%, rgba(201,178,124,0.08) 0 1px, transparent 2px),
            radial-gradient(circle at 69% 18%, rgba(201,178,124,0.10) 0 1px, transparent 2px),
            radial-gradient(circle at 84% 10%, rgba(201,178,124,0.08) 0 1px, transparent 2px);
          opacity: 0.35;
        }

        .pricing-shell::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -200px;
          transform: translateX(-50%);
          width: 1100px;
          height: 420px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at center,
            rgba(25, 94, 255, 0.18) 0%,
            rgba(25, 94, 255, 0.06) 40%,
            rgba(0, 0, 0, 0) 74%
          );
          filter: blur(52px);
          pointer-events: none;
        }

        .pricing-header {
          max-width: 880px;
          margin: 0 auto 4rem;
          text-align: center;
        }

        .pricing-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          letter-spacing: -0.03em;
          color: #F4F7FF;
          line-height: 0.96;
          font-size: clamp(3rem, 6vw, 5.2rem);
          text-align: center;
          margin: 0;
        }

        .pricing-subtitle {
          margin: 1.2rem auto 0;
          max-width: 760px;
          color: rgba(228, 238, 255, 0.52);
          font-size: 1rem;
          line-height: 1.75;
          text-align: center;
        }

        .pricing-bundle-note {
          margin: 1.75rem auto 0;
          padding: 1.2rem 1.6rem;
          max-width: 760px;
          border-radius: 22px;
          border: 1px solid rgba(88,160,255,0.16);
          background: linear-gradient(180deg, rgba(8,14,28,0.82) 0%, rgba(4,8,18,0.78) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(90,170,255,0.05),
            0 0 18px rgba(54,126,255,0.08);
          text-align: center;
        }

        .pricing-bundle-note p {
          margin: 0;
          font-size: 1.02rem;
          color: rgba(231, 241, 255, 0.70);
          line-height: 1.65;
        }

        .pricing-bundle-note strong {
          color: #C9B27C;
          font-weight: 600;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          align-items: stretch;
        }

        .pricing-card-standard,
        .pricing-card-featured {
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: transform 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease;
        }

        .pricing-card-standard:hover,
        .pricing-card-featured:hover {
          transform: translateY(-3px);
        }

        .pricing-card-standard {
          background: linear-gradient(180deg, rgba(5,10,20,0.94) 0%, rgba(3,6,12,0.97) 100%);
          border: 1px solid rgba(88,160,255,0.16);
          box-shadow:
            inset 0 0 0 1px rgba(90,170,255,0.04),
            0 0 18px rgba(20,72,180,0.08);
        }

        .pricing-card-standard:hover {
          border-color: rgba(110, 180, 255, 0.28);
          box-shadow:
            inset 0 0 0 1px rgba(90,170,255,0.06),
            0 0 22px rgba(36, 92, 210, 0.12);
        }

        .pricing-card-featured {
          background: linear-gradient(180deg, rgba(10,12,18,0.96) 0%, rgba(8,9,14,0.98) 100%);
          border: 1px solid rgba(201,178,124,0.34);
          box-shadow:
            inset 0 0 0 1px rgba(201,178,124,0.05),
            0 0 24px rgba(201,178,124,0.08);
        }

        .pricing-card-featured:hover {
          border-color: rgba(201,178,124,0.50);
          box-shadow:
            inset 0 0 0 1px rgba(201,178,124,0.06),
            0 0 30px rgba(201,178,124,0.12);
        }

        .pricing-badge {
          border: 1px solid rgba(201,178,124,0.24);
          background: rgba(201,178,124,0.07);
          color: #C9B27C;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pricing-plan-name {
          color: #F7FAFF;
          font-size: 2.15rem;
          line-height: 1;
          font-weight: 600;
          letter-spacing: -0.03em;
        }

        .pricing-price {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(3.3rem, 5vw, 4.9rem);
          line-height: 0.95;
          font-weight: 300;
          color: #F4F7FF;
          letter-spacing: -0.04em;
        }

        .pricing-period {
          font-size: 1.2rem;
          color: rgba(244,247,255,0.34);
          padding-bottom: 8px;
        }

        .pricing-feature-item {
          color: rgba(226, 239, 255, 0.66);
          font-size: 0.98rem;
          line-height: 1.58;
        }

        .pricing-cta {
          height: 56px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          transition: all 0.28s ease;
          position: relative;
          overflow: hidden;
        }

        .pricing-cta-standard {
          border: 1px solid rgba(88,160,255,0.42);
          color: #EAF4FF;
          background: linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(90,170,255,0.10),
            0 0 10px rgba(54,126,255,0.22),
            0 0 22px rgba(54,126,255,0.18);
        }

        .pricing-cta-standard:hover {
          border-color: rgba(201,178,124,0.88);
          color: #FFF7E8;
          background: linear-gradient(180deg, rgba(24,18,10,0.96) 0%, rgba(14,10,6,0.92) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(201,178,124,0.14),
            0 0 14px rgba(201,178,124,0.26),
            0 0 30px rgba(201,178,124,0.20),
            0 0 52px rgba(201,178,124,0.14);
          transform: translateY(-1px);
        }

        .pricing-cta-featured {
          border: 1px solid rgba(201,178,124,0.78);
          color: #17120A;
          background: linear-gradient(180deg, rgba(214,193,137,1) 0%, rgba(201,178,124,1) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(255,248,220,0.10),
            0 0 12px rgba(201,178,124,0.18),
            0 0 30px rgba(201,178,124,0.10);
        }

        .pricing-cta-featured:hover {
          filter: brightness(1.03);
          transform: translateY(-1px);
          box-shadow:
            inset 0 0 0 1px rgba(255,248,220,0.14),
            0 0 16px rgba(201,178,124,0.24),
            0 0 36px rgba(201,178,124,0.14);
        }

        .pricing-spinner {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.18);
          border-top-color: rgba(255,255,255,0.82);
          display: inline-block;
          animation: pricingSpin 0.8s linear infinite;
        }

        @keyframes pricingSpin {
          to { transform: rotate(360deg); }
        }

        .pricing-bottom-note {
          color: rgba(224,247,250,0.18);
          font-size: 0.82rem;
          text-align: center;
          margin-top: 2rem;
          letter-spacing: 0.04em;
        }

        @media (max-width: 1180px) {
          .pricing-grid {
            grid-template-columns: 1fr;
          }

          .pricing-card-standard,
          .pricing-card-featured {
            min-height: auto;
          }
        }

        @media (max-width: 768px) {
          .pricing-header {
            margin-bottom: 2.8rem;
          }

          .pricing-bundle-note {
            padding: 1.1rem 1.1rem;
          }

          .pricing-bundle-note p {
            font-size: 0.95rem;
          }
        }
      `}</style>

      <div className="pricing-shell px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="pricing-header"
          >
            <h2 className="pricing-title">Invierte en tu tiempo.</h2>

            <p className="pricing-subtitle">
              Elige el nivel de asistencia que necesitas para ganar claridad, foco y ejecución en tu día a día.
            </p>

            <div className="pricing-bundle-note">
              <p>
                <strong>Lucy Completa</strong> — Ambos productos desde <strong>€25/mes</strong> con 25% de descuento
              </p>
            </div>
          </motion.div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                onCheckout={handleCheckout}
                loadingPlan={loadingPlan}
              />
            ))}
          </div>

          <p className="pricing-bottom-note">
            Diseñado para profesionales que necesitan claridad, orden y ejecución.
          </p>
        </div>
      </div>
    </Layout>
  );
}