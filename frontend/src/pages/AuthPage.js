import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import lucyActive from '../assets/Lucy.jpeg';

// ── Partículas — doradas con destellos azules ─────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const GOLD = ['rgba(201,178,124,', 'rgba(230,210,160,', 'rgba(180,155,100,'];
    const BLUE = ['rgba(0,180,216,', 'rgba(100,220,240,'];
    const particles = Array.from({ length: 70 }, (_, i) => {
      const isBlue = i > 52;
      const palette = isBlue ? BLUE : GOLD;
      return {
        x: Math.random() * 800, y: Math.random() * 900,
        r: Math.random() * (isBlue ? 1.2 : 1.6) + 0.3,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -(Math.random() * 0.35 + 0.08),
        alpha: Math.random() * 0.6 + 0.1,
        dAlpha: (Math.random() - 0.5) * 0.007,
        color: palette[Math.floor(Math.random() * palette.length)],
        drift: Math.random() * Math.PI * 2,
        dDrift: Math.random() * 0.014 + 0.004,
        isBlue,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.drift += p.dDrift;
        p.x += p.vx + Math.sin(p.drift) * 0.16;
        p.y += p.vy;
        p.alpha += p.dAlpha;
        if (p.alpha > 0.85 || p.alpha < 0.05) p.dAlpha *= -1;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha.toFixed(2)})`;
        ctx.fill();

        if (p.r > 1.0) {
          const glowRadius = p.isBlue ? p.r * 5 : p.r * 3.5;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
          g.addColorStop(0, `${p.color}${(p.alpha * 0.35).toFixed(2)})`);
          g.addColorStop(1, `${p.color}0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
      });
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }} />;
}

function LucyImageSide() {
  return (
    <div className="lucy-left-col">
      <div className="lucy-video-wrapper">
        <img
          className="lucy-video"
          src={lucyActive}
          alt="Lucy — Executive AI Assistant"
          style={{ mixBlendMode: 'screen' }}
        />
        <div className="lucy-video-overlay" />
        <ParticleCanvas />
        <div className="lucy-label">
          <h1 className="lucy-title">Lucy</h1>
          <p className="lucy-tagline">
            Tu secretaria ejecutiva.<br />
            Inteligencia al servicio de tu tiempo.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { login, register, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isAuthenticated) logout();
      if (isRegister) { await register(email, password, name); }
      else { await login(email, password); }
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.detail || (isRegister ? 'Error al registrarse' : 'Error al iniciar sesión'));
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');

        .auth-root {
          min-height: 100vh;
          background: #000000;
          display: flex;
          align-items: stretch;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        .auth-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,180,216,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,180,216,0.015) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
          z-index: 0;
        }

        .auth-top-line {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(0,180,216,0.3) 30%, rgba(201,178,124,0.3) 70%, transparent);
          z-index: 20;
        }

        /* ── LADO IZQUIERDO ── */
        .lucy-left-col {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .lucy-video-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .lucy-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 25%;
          transform: scale(0.85);
          z-index: 1;
        }

        .lucy-video-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to right,  #000000 0%, transparent 20%, transparent 80%, #000000 100%),
            linear-gradient(to bottom, #000000 0%, transparent 15%, transparent 60%, #000000 95%);
          z-index: 2;
          pointer-events: none;
        }

        .lucy-label {
          position: relative;
          z-index: 4;
          bottom: 18%;
          padding: 0 1rem;
        }

        .lucy-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 4rem;
          font-weight: 300;
          color: #C9B27C;
          letter-spacing: 0.02em;
          line-height: 1;
          margin: 0 0 0.55rem;
          text-shadow:
            0 0 30px rgba(201,178,124,0.6),
            0 0 60px rgba(201,178,124,0.25),
            0 2px 8px rgba(0,0,0,0.7);
        }

        .lucy-tagline {
          font-size: 0.62rem;
          color: rgba(224,247,250,0.5);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          line-height: 1.9;
          margin: 0;
          text-shadow: 0 1px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7);
        }

        /* ── DIVISOR ── */
        .auth-divider {
          width: 1px;
          align-self: stretch;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0,180,216,0.08) 20%,
            rgba(0,180,216,0.15) 40%,
            rgba(201,178,124,0.12) 60%,
            rgba(0,180,216,0.08) 80%,
            transparent
          );
          flex-shrink: 0;
          z-index: 10;
        }

        /* ── FORMULARIO ── */
        .auth-form-side {
          flex: 0.8;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 4rem;
          position: relative;
          z-index: 10;
          min-width: 340px;
          background: radial-gradient(ellipse 80% 60% at 20% 50%, rgba(4,18,32,0.4) 0%, transparent 70%);
        }

        .auth-form-title {
          font-size: 0.6rem;
          color: rgba(0,180,216,0.45);
          text-transform: uppercase;
          letter-spacing: 0.22em;
          margin-bottom: 2rem;
        }

        .auth-field { margin-bottom: 1.2rem; }

        .auth-field-label {
          display: block;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: rgba(224,247,250,0.2);
          margin-bottom: 0.5rem;
        }

        .auth-input-wrapper { position: relative; }

        .auth-input-icon {
          position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
          width: 13px; height: 13px; color: rgba(0,180,216,0.25);
          pointer-events: none; z-index: 1;
        }

        .auth-input {
          background: rgba(4,18,32,0.6) !important;
          border: 1px solid rgba(0,180,216,0.12) !important;
          color: rgba(224,247,250,0.8) !important;
          padding-left: 2.75rem !important;
          transition: all 0.2s !important;
          font-size: 0.85rem !important;
          font-family: 'DM Sans', sans-serif !important;
          border-radius: 0.875rem !important;
        }
        .auth-input::placeholder { color: rgba(224,247,250,0.12) !important; }
        .auth-input:focus {
          border-color: rgba(201,178,124,0.35) !important;
          background: rgba(0,180,216,0.05) !important;
          box-shadow: 0 0 0 3px rgba(0,180,216,0.06), 0 0 20px rgba(0,180,216,0.04) !important;
          outline: none !important;
        }

        .auth-submit {
          width: 100%;
          background: linear-gradient(135deg, rgba(201,178,124,0.15), rgba(0,180,216,0.08)) !important;
          border: 1px solid rgba(201,178,124,0.25) !important;
          color: #C9B27C !important;
          font-size: 0.65rem !important;
          font-family: 'DM Sans', sans-serif !important;
          text-transform: uppercase !important;
          letter-spacing: 0.15em !important;
          transition: all 0.25s !important;
          position: relative; overflow: hidden;
          border-radius: 0.875rem !important;
        }
        .auth-submit::before {
          content: ''; position: absolute; inset-x: 0; top: 0; height: 1px;
          background: linear-gradient(to right, transparent, rgba(201,178,124,0.4), rgba(0,180,216,0.3), transparent);
        }
        .auth-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(201,178,124,0.22), rgba(0,180,216,0.12)) !important;
          border-color: rgba(201,178,124,0.4) !important;
          box-shadow: 0 0 28px rgba(201,178,124,0.1), 0 0 40px rgba(0,180,216,0.06) !important;
        }
        .auth-submit:disabled { opacity: 0.35 !important; }

        .auth-error {
          font-size: 0.72rem; color: rgba(239,100,100,0.8);
          background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.1);
          border-radius: 0.75rem; padding: 0.6rem 0.875rem; margin-bottom: 1rem;
        }

        .auth-toggle {
          margin-top: 1.25rem; font-size: 0.68rem;
          color: rgba(224,247,250,0.15); text-align: center;
        }
        .auth-toggle span { color: rgba(0,180,216,0.5); cursor: pointer; transition: color 0.15s; }
        .auth-toggle span:hover { color: #00B4D8; }

        @media (max-width: 768px) {
          .auth-root { flex-direction: column; }
          .lucy-left-col { min-height: 55vh; flex: none; }
          .lucy-title { font-size: 2.8rem; }
          .auth-divider { display: none; }
          .auth-form-side { flex: none; padding: 2rem 1.5rem; min-width: unset; }
        }
      `}</style>

      <div className="auth-root">
        <div className="auth-top-line" />

        <motion.div style={{ flex: '1.2', display: 'flex', flexDirection: 'column' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
          <LucyImageSide />
        </motion.div>

        <motion.div className="auth-divider"
          initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'top' }} />

        <motion.div className="auth-form-side"
          initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
          <AnimatePresence mode="wait">
            <motion.div key={isRegister ? 'register' : 'login'}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>

              <p className="auth-form-title">{isRegister ? 'Crear cuenta' : 'Acceder'}</p>

              <form onSubmit={handleSubmit}>
                {isRegister && (
                  <div className="auth-field">
                    <label className="auth-field-label">Nombre</label>
                    <div className="auth-input-wrapper">
                      <Input type="text" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre" required
                        className="auth-input !h-[3.2rem] focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ paddingLeft: '1rem' }} />
                    </div>
                  </div>
                )}

                <div className="auth-field">
                  <label className="auth-field-label">Correo electrónico</label>
                  <div className="auth-input-wrapper">
                    <Mail className="auth-input-icon" strokeWidth={1.3} />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="hola@tuempresa.com" autoComplete="email" required
                      className="auth-input !h-[3.2rem] focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field-label">Contraseña</label>
                  <div className="auth-input-wrapper">
                    <Lock className="auth-input-icon" strokeWidth={1.3} />
                    <Input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                      autoComplete={isRegister ? 'new-password' : 'current-password'} required
                      className="auth-input !h-[3.2rem] !pr-12 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      style={{
                        position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                        color: 'rgba(0,180,216,0.25)', zIndex: 10, background: 'none', border: 'none', cursor: 'pointer'
                      }}>
                      {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.3} /> : <Eye className="w-4 h-4" strokeWidth={1.3} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="auth-error">
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={loading}
                  className="auth-submit !h-[3.2rem] focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ marginTop: '0.5rem' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>{isRegister ? 'Crear cuenta' : 'Entrar'}<ArrowRight className="w-4 h-4 ml-2" style={{ opacity: 0.5 }} /></>
                  )}
                </Button>
              </form>

              <p className="auth-toggle">
                {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
                <span onClick={() => { setIsRegister(p => !p); setError(''); }}>
                  {isRegister ? 'Iniciar sesión' : 'Crear cuenta'}
                </span>
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}