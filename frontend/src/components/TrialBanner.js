import { useAuth } from '../context/AuthContext';
import { Clock, AlertCircle, CreditCard, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatTime(seconds) {
  if (seconds <= 0) return '0 min';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

/* ─── Trial Banner ────────────────────────────────────────
   Franja superior del header — visible durante el trial
───────────────────────────────────────────────────────── */
export function TrialBanner() {
  const { trial } = useAuth();
  const navigate = useNavigate();

  if (!trial || trial.subscription_active) return null;

  const remaining = trial.trial_remaining ?? 0;
  const isLow = remaining <= 600;   // ≤ 10 min
  const isCritical = remaining <= 120;   // ≤ 2 min

  /* Colores según urgencia — sin azul, sistema champagne/ámbar/rojo */
  const bg = isCritical
    ? 'rgba(120,20,20,0.25)'
    : isLow
      ? 'rgba(120,80,10,0.2)'
      : 'rgba(201,178,124,0.06)';

  const borderColor = isCritical
    ? 'rgba(255,80,80,0.2)'
    : isLow
      ? 'rgba(255,180,50,0.2)'
      : 'rgba(201,178,124,0.15)';

  const timeColor = isCritical
    ? 'rgba(255,140,140,0.9)'
    : isLow
      ? 'rgba(255,200,80,0.9)'
      : '#C9B27C';

  const timeBg = isCritical
    ? 'rgba(255,60,60,0.12)'
    : isLow
      ? 'rgba(255,160,30,0.1)'
      : 'rgba(201,178,124,0.08)';

  const timeBorder = isCritical
    ? 'rgba(255,80,80,0.25)'
    : isLow
      ? 'rgba(255,180,50,0.25)'
      : 'rgba(201,178,124,0.2)';

  return (
    <div
      className="flex items-center justify-center gap-3 py-2 px-4"
      style={{
        background: bg,
        borderBottom: `1px solid ${borderColor}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Icono */}
      <Clock
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: timeColor, opacity: 0.7 }}
        strokeWidth={1.5}
      />

      {/* Label */}
      <span className="text-xs text-[rgba(255,255,255,0.4)] uppercase tracking-[0.08em]">
        Prueba gratuita
      </span>

      {/* Tiempo restante */}
      <span
        className="text-xs font-medium px-2.5 py-0.5 rounded-full border"
        style={{
          color: timeColor,
          background: timeBg,
          borderColor: timeBorder,
        }}
      >
        {formatTime(remaining)}
      </span>

      {/* CTA */}
      <button
        onClick={() => navigate('/#pricing')}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]
          font-medium px-3 py-1 rounded-lg transition-all duration-200
          bg-[rgba(201,178,124,0.1)] text-[rgba(201,178,124,0.7)]
          border border-[rgba(201,178,124,0.2)]
          hover:bg-[rgba(201,178,124,0.18)] hover:text-[#C9B27C]
          hover:border-[rgba(201,178,124,0.35)]"
      >
        <Sparkles className="w-3 h-3" />
        Activar plan
      </button>
    </div>
  );
}

/* ─── Trial Expired Overlay ───────────────────────────────
   Bloquea la pantalla cuando el trial ha expirado
───────────────────────────────────────────────────────── */
export function TrialExpiredOverlay() {
  const { trial, user } = useAuth();
  const navigate = useNavigate();

  if (!trial || trial.subscription_active || !trial.trial_expired) return null;
  if (user?.is_admin) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'rgba(4,4,8,0.92)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div
        className="relative max-w-sm w-full mx-5 rounded-2xl p-10 text-center overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Línea dorada superior */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.3)] to-transparent" />

        {/* Icono */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-7
          bg-[rgba(255,80,80,0.08)] border border-[rgba(255,80,80,0.2)]">
          <AlertCircle className="w-6 h-6 text-[rgba(255,140,140,0.7)]" strokeWidth={1.5} />
        </div>

        {/* Icono Lucy pequeño */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-5 h-5 rounded-md flex items-center justify-center
            bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)]">
            <svg width="10" height="10" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                fill="rgba(201,178,124,0.7)"
              />
            </svg>
          </div>
          <span className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.12em]">
            Lucy
          </span>
        </div>

        <h2
          className="text-xl font-light text-white mb-3 leading-snug"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '1.5rem' }}
        >
          Tu período de prueba<br />ha finalizado.
        </h2>

        <p className="text-sm text-[rgba(255,255,255,0.3)] mb-8 leading-relaxed">
          Activa tu suscripción para seguir contando con Lucy como tu secretaria ejecutiva.
        </p>

        {/* Botón */}
        <button
          onClick={() => navigate('/#pricing')}
          className="relative w-full py-3.5 rounded-xl text-sm uppercase tracking-[0.1em]
            font-medium transition-all duration-300 overflow-hidden
            bg-[rgba(201,178,124,0.12)] text-[#C9B27C]
            border border-[rgba(201,178,124,0.3)]
            hover:bg-[rgba(201,178,124,0.2)] hover:border-[rgba(201,178,124,0.5)]
            hover:shadow-[0_0_40px_rgba(201,178,124,0.15)]"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.4)] to-transparent" />
          <span className="flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4" strokeWidth={1.5} />
            Activar suscripción
          </span>
        </button>
      </div>
    </div>
  );
}