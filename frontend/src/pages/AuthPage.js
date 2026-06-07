import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import HeroImage from '../assets/Lucy.png';
import { useAuth } from '../context/AuthContext';

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

    const GOLD = ['rgba(201,169,110,', 'rgba(230,210,160,', 'rgba(180,155,100,', 'rgba(215,195,140,'];
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * 800, y: Math.random() * 900,
      r: Math.random() * 1.6 + 0.3,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -(Math.random() * 0.35 + 0.08),
      alpha: Math.random() * 0.6 + 0.1,
      dAlpha: (Math.random() - 0.5) * 0.007,
      color: GOLD[Math.floor(Math.random() * GOLD.length)],
      drift: Math.random() * Math.PI * 2,
      dDrift: Math.random() * 0.014 + 0.004,
    }));

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
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.5);
          g.addColorStop(0, `${p.color}${(p.alpha * 0.35).toFixed(2)})`);
          g.addColorStop(1, `${p.color}0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
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

function ImageSide() {
  return (
    <div className="auth-left-col">
      <div className="auth-img-wrapper">
        <img className="auth-hero-img" src={HeroImage} alt="Objetiva — Correduría de Seguros" />
        <div className="auth-img-overlay" />
        <ParticleCanvas />
        <div className="auth-label">
          {/* OBJETIVA. — exactamente igual que la landing: Cormorant, uppercase, tracking 0.35em, sin italic */}
          <h1 className="auth-brand-name">OBJETIVA<span>.</span></h1>
          <p className="auth-tagline">
            Correduría de Seguros.<br />
            Inteligencia al servicio de tu equipo.
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
      navigate('/broker');
    } catch (err) {
      setError(err.response?.data?.detail || (isRegister ? 'Error al registrarse' : 'Error al iniciar sesión'));
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jura:wght@300;400;500&display=swap');

        .auth-root {
          min-height: 100vh;
          background: #030305;
          display: flex;
          align-items: stretch;
          overflow: hidden;
          font-family: 'Jura', sans-serif;
        }

        .auth-top-line {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(201,169,110,0.35) 30%, rgba(201,169,110,0.35) 70%, transparent);
          z-index: 20;
        }

        /* ── IZQUIERDA ── */
        .auth-left-col {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .auth-img-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .auth-hero-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 25%;
          transform: scale(0.85);
          z-index: 1;
          filter: sepia(0.5) saturate(0.5) hue-rotate(5deg) brightness(0.75);
        }
        .auth-img-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to right, #030305 0%, transparent 20%, transparent 80%, #030305 100%),
            linear-gradient(to bottom, #030305 0%, transparent 15%, transparent 60%, #030305 95%);
          z-index: 2;
          pointer-events: none;
        }
        .auth-label {
          position: relative;
          z-index: 4;
          bottom: 18%;
          padding: 0 2.5rem;
        }

        /* ── OBJETIVA. — idéntico a la landing ── */
        .auth-brand-name {
          font-family: 'Cormorant Garamond', serif !important;
          font-size: 2.2rem !important;
          font-weight: 300 !important;
          font-style: normal !important;
          color: #C9A96E !important;
          letter-spacing: 0.35em !important;
          text-transform: uppercase !important;
          line-height: 1 !important;
          margin: 0 0 0.6rem !important;
          text-shadow:
            0 0 40px rgba(201,169,110,0.7),
            0 0 80px rgba(201,169,110,0.3),
            0 2px 8px rgba(0,0,0,0.8) !important;
        }
        .auth-brand-name span {
          color: #F2EFE9 !important;
        }

        .auth-tagline {
          font-family: 'Jura', sans-serif !important;
          font-size: 0.58rem !important;
          font-weight: 400 !important;
          font-style: normal !important;
          color: rgba(242,239,233,0.55) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.22em !important;
          line-height: 2 !important;
          margin: 0 !important;
          text-shadow: 0 1px 10px rgba(0,0,0,0.9) !important;
        }

        /* ── DIVISOR ── */
        .auth-divider {
          width: 1px;
          align-self: stretch;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(201,169,110,0.25) 20%,
            rgba(201,169,110,0.35) 50%,
            rgba(201,169,110,0.25) 80%,
            transparent
          );
          flex-shrink: 0;
          z-index: 10;
        }

        /* ── PANEL DERECHO ── */
        .auth-form-side {
          flex: 0.8;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 4rem;
          position: relative;
          z-index: 10;
          min-width: 340px;
        }

        /* "ACCEDER" eyebrow */
        .auth-form-title {
          font-family: 'Jura', sans-serif;
          font-size: 0.6rem;
          font-weight: 500;
          color: #C9A96E;
          text-transform: uppercase;
          letter-spacing: 0.35em;
          margin-bottom: 2rem;
        }

        .auth-field { margin-bottom: 1.2rem; }

        /* Labels */
        .auth-field-label {
          display: block;
          font-family: 'Jura', sans-serif;
          font-size: 0.6rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: rgba(242,239,233,0.65);
          margin-bottom: 0.5rem;
        }

        .auth-input-wrapper { position: relative; }

        .auth-input-icon {
          position: absolute;
          left: 1rem; top: 50%; transform: translateY(-50%);
          width: 13px; height: 13px;
          color: rgba(201,169,110,0.5);
          pointer-events: none; z-index: 1;
        }

        /* ── INPUTS nativos — sin shadcn ── */
        .auth-native-input {
          display: block;
          width: 100%;
          height: 3.2rem;
          padding: 0 3rem 0 2.75rem;
          background: #08080c;
          border: 1px solid rgba(201,169,110,0.30);
          color: #F2EFE9;
          font-family: 'Jura', sans-serif;
          font-size: 0.82rem;
          font-weight: 400;
          letter-spacing: 0.05em;
          border-radius: 2px;
          outline: none;
          transition: border-color 0.28s, box-shadow 0.28s;
          -webkit-appearance: none;
          appearance: none;
        }
        .auth-native-input::placeholder {
          color: rgba(242,239,233,0.25);
          font-family: 'Jura', sans-serif;
        }
        .auth-native-input:focus {
          border-color: rgba(201,169,110,0.75);
          box-shadow: 0 0 0 1px rgba(201,169,110,0.12) inset, 0 0 20px rgba(201,169,110,0.12);
        }
        .auth-native-input.no-icon { padding-left: 1rem; }

        /* Autofill */
        .auth-native-input:-webkit-autofill,
        .auth-native-input:-webkit-autofill:hover,
        .auth-native-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #08080c inset !important;
          -webkit-text-fill-color: #F2EFE9 !important;
          border-color: rgba(201,169,110,0.30) !important;
          transition: background-color 9999s ease-in-out 0s !important;
        }

        /* toggle password */
        .auth-pw-toggle {
          position: absolute;
          right: 1rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(201,169,110,0.45);
          display: flex; align-items: center;
          padding: 0; z-index: 2;
          transition: color 0.2s;
        }
        .auth-pw-toggle:hover { color: rgba(201,169,110,0.9); }

        /* ── BOTÓN — igual que "SOLICITAR ACCESO" / "ACCEDER" de la landing ── */
        .auth-native-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 3.2rem;
          margin-top: 0.5rem;
          background: transparent;
          border: 1px solid #F2EFE9;
          color: #F2EFE9;
          font-family: 'Jura', sans-serif;
          font-size: 0.65rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.28s ease, color 0.28s ease, border-color 0.28s ease;
        }
        .auth-native-btn:hover:not(:disabled) {
          background: #F2EFE9;
          color: #030305;
        }
        .auth-native-btn:active:not(:disabled) {
          background: #C9A96E;
          border-color: #C9A96E;
          color: #030305;
        }
        .auth-native-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* Error */
        .auth-error {
          font-family: 'Jura', sans-serif;
          font-size: 0.68rem;
          letter-spacing: 0.05em;
          color: rgba(239,120,120,0.9);
          background: rgba(60,0,0,0.25);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 2px;
          padding: 0.6rem 0.875rem;
          margin-bottom: 1rem;
        }

        /* Toggle login/register */
        .auth-toggle {
          margin-top: 1.25rem;
          font-family: 'Jura', sans-serif;
          font-size: 0.62rem;
          letter-spacing: 0.15em;
          color: rgba(242,239,233,0.35);
          text-align: center;
          text-transform: uppercase;
        }
        .auth-toggle span {
          color: rgba(201,169,110,0.8);
          cursor: pointer;
          transition: color 0.15s;
        }
        .auth-toggle span:hover { color: #C9A96E; }

        @media (max-width: 768px) {
          .auth-root { flex-direction: column; }
          .auth-left-col { min-height: 55vh; flex: none; }
          .auth-brand-name { font-size: 2.6rem !important; }
          .auth-divider { display: none; }
          .auth-form-side { flex: none; padding: 2rem 1.5rem; min-width: unset; }
        }
      `}</style>

      <div className="auth-root">
        <div className="auth-top-line" />

        <motion.div style={{ flex: '1.2', display: 'flex', flexDirection: 'column' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
          <ImageSide />
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
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Tu nombre" required className="auth-native-input no-icon" />
                    </div>
                  </div>
                )}

                <div className="auth-field">
                  <label className="auth-field-label">Correo electrónico</label>
                  <div className="auth-input-wrapper">
                    <Mail className="auth-input-icon" strokeWidth={1.3} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="hola@tuempresa.com" autoComplete="email" required
                      className="auth-native-input" />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field-label">Contraseña</label>
                  <div className="auth-input-wrapper">
                    <Lock className="auth-input-icon" strokeWidth={1.3} />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      autoComplete={isRegister ? 'new-password' : 'current-password'} required
                      className="auth-native-input" />
                    <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(p => !p)}>
                      {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.3} /> : <Eye className="w-4 h-4" strokeWidth={1.3} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="auth-error">
                    {error}
                  </motion.div>
                )}

                <button type="submit" disabled={loading} className="auth-native-btn">
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <>{isRegister ? 'Crear cuenta' : 'Entrar'}<ArrowRight className="w-4 h-4" style={{ opacity: 0.6 }} /></>
                  }
                </button>
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