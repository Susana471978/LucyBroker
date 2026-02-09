import { useAuth } from '../context/AuthContext';
import { Clock, AlertCircle, CreditCard, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

/**
 * Formats remaining seconds into a human-readable string.
 */
function formatTime(seconds) {
  if (seconds <= 0) return '0 min';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

/**
 * Glassmorphism trial banner — always visible in the sticky header.
 * Hidden for subscribed users or when trial data is unavailable.
 */
export function TrialBanner() {
  const { trial } = useAuth();
  const navigate = useNavigate();

  // Don't render for subscribed users or missing data
  if (!trial || trial.subscription_active) return null;

  const remaining = trial.trial_remaining ?? 0;
  const isLow = remaining <= 600;       // ≤ 10 min
  const isCritical = remaining <= 120;  // ≤ 2 min

  const bgClass = isCritical
    ? 'bg-red-500/15 border-b border-red-500/25'
    : isLow
      ? 'bg-amber-500/10 border-b border-amber-500/20'
      : 'bg-blue-500/8 border-b border-blue-500/15';

  const accentClass = isCritical
    ? 'text-red-400'
    : isLow
      ? 'text-amber-400'
      : 'text-blue-400';

  const pillBg = isCritical
    ? 'bg-red-500/20 border-red-500/30 text-red-300'
    : isLow
      ? 'bg-amber-500/20 border-amber-500/30 text-amber-200'
      : 'bg-blue-500/15 border-blue-500/25 text-blue-200';

  return (
    <div
      className={
        'relative flex items-center justify-center gap-3 py-2.5 px-4 backdrop-blur-md ' +
        bgClass
      }
    >
      {/* Icon */}
      <Clock className={'w-4 h-4 shrink-0 ' + accentClass} />

      {/* Label */}
      <span className="text-sm text-slate-300 font-medium">
        Prueba gratuita
      </span>

      {/* Time pill */}
      <span
        className={
          'inline-flex items-center gap-1.5 text-sm font-bold px-3 py-0.5 rounded-full border ' +
          pillBg
        }
      >
        {formatTime(remaining)}
      </span>

      {/* Discrete CTA */}
      <button
        onClick={() => navigate('/#pricing')}
        className={
          'ml-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg ' +
          'bg-blue-600/80 hover:bg-blue-500 text-white/90 hover:text-white ' +
          'transition-colors duration-200 backdrop-blur-sm'
        }
      >
        <Sparkles className="w-3 h-3" />
        Activar plan
      </button>
    </div>
  );
}

/**
 * Full-screen blocking overlay when trial has expired.
 * Shows message + subscribe CTA. Renders nothing if trial is active or user is subscribed.
 */
export function TrialExpiredOverlay() {
  const { trial, token } = useAuth();
  const navigate = useNavigate();

  // Don't block if no trial data, user is subscribed, or trial is still active
  if (!trial || trial.subscription_active || !trial.trial_expired) return null;

  const handleSubscribe = () => {
    // Navigate to landing page pricing — single source of checkout
    navigate('/#pricing');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="glass-premium rounded-2xl p-10 max-w-md w-full mx-4 text-center border border-white/10">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-3">
          Tu periodo de prueba ha finalizado
        </h2>
        <p className="text-slate-400 mb-8">
          Activa tu suscripción para continuar usando todas las funcionalidades.
        </p>
        <Button
          onClick={handleSubscribe}
          className="bg-blue-600 hover:bg-blue-500 text-white w-full py-3 text-base font-semibold flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Activar suscripción
        </Button>
      </div>
    </div>
  );
}
