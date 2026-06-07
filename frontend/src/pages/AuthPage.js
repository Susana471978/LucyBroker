import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import HeroImage from '../assets/Lucy.png';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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
        <img
          className="auth-hero-img"
          src={HeroImage}
          alt="Objetiva — Correduría de Seguros"
        />
        <div className="auth-img-overlay" />
        <ParticleCanvas />
        <div className="auth-label">
          <h1 className="auth-brand">Objetiva<span>.</span></h1>
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

        /* ── VARIABLES (mismas que la landing) ── */
        :root {
          --gold:       #C9A96E;
          --gold-dim:   rgba(201,169,110,0.5);
          --gold-faint: rgba(201,169,110,0.15);
          --white:      #F2EFE9;
          --white-dim:  rgba(242,239,233,0.45);
          --black:      #030305;
        }

        .auth-root {
          min-height: 100vh;
          background: var(--black);
          display: flex;
          align-items: stretch;
          overflow: hidden;
          /* Jura como fuente base — igual que la landing */
          font-family: 'Jura', sans-serif;
        }

        .auth-top-line {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, var(--gold-faint) 30%, rgba(201,169,110,0.25) 70%, transparent);
          z-index: 20;
        }

        /* ── LADO IZQUIERDO ── */
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
            linear-gradient(to right, var(--black) 0%, transparent 20%, transparent 80%, var(--black) 100%),
            linear-gradient(to bottom, var(--black) 0%, transparent 15%, transparent 60%, var(--black) 95%);
          z-index: 2;
          pointer-events: none;
        }

        .auth-label {
          position: relative;
          z-index: 4;
          bottom: 18%;
          padding: 0 1rem;
        }

        /* OBJETIVA. — mismo tratamiento que la landing */
        .auth-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 300;
          color: var(--gold);
          letter-spacing: 0.35em;       /* igual que la landing */
          text-transform: uppercase;
          line-height: 1;
          margin: 0 0 0.55rem;
          text-shadow:
            0 0 30px rgba(201,169,110,0.6),
            0 0 60px rgba(201,169,110,0.25),
            0 2px 8px rgba(0,0,0,0.7);
        }

        .auth-brand span {
          color: var(--white);           /* el punto en blanco, como la landing */
        }

        /* Frase debajo — misma tipografía y tracking que nav items de la landing */
        .auth-tagline {
          font-family: 'Jura', sans-serif;
          font-size: 0.58rem;
          font-weight: 400;
          color: var(--white-dim);
          text-transform: uppercase;
          letter-spacing: 0.22em;
          line-height: 2;
          margin: 0;
          text-shadow: 0 1px 10px rgba(0,0,0,0.9);
        }

        /* ── DIVISOR ── */
        .auth-divider {
          width: 1px;
          align-self: stretch;
          background: linear-gradient(
            to bottom,
            transparent,
            var(--gold-faint) 20%,
            rgba(201,169,110,0.18) 50%,
            var(--gold-faint) 80%,
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
        }

        /* "ACCEDER" / "CREAR CUENTA" — mismo estilo que el eyebrow de la landing */
        .auth-form-title {
          font-family: 'Jura', sans-serif;
          font-size: 0.58rem;
          font-weight: 400;
          color: var(--gold-dim);
          text-transform: uppercase;
          letter-spacing: 0.3em;
          margin-bottom: 2rem;
        }

        .auth-field { margin-bottom: 1.2rem; }

        /* Labels — mismo tracking que nav items */
        .auth-field-label {
          display: block;
          font-family: 'Jura', sans-serif;
          font-size: 0.58rem;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: var(--white-dim);
          margin-bottom: 0.5rem;
        }

        .auth-input-wrapper { position: relative; }

        .auth-input-icon {
          position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
          width: 13px; height: 13px; color: var(--gold-faint);
          pointer-events: none; z-index: 1;
        }

        .auth-input {
          background: rgba(8,8,12,0.9) !important;
          border: 1px solid rgba(201,169,110,0.15) !important;
          color: var(--white) !important;
          padding-left: 2.75rem !important;
          transition: border-color .28s, box-shadow .28s !important;
          font-size: 0.82rem !important;
          font-family: 'Jura', sans-serif !important;
          letter-spacing: 0.05em !important;
          border-radius: 2px !important;
          box-shadow: none !important;
        }
        .auth-input::placeholder { color: rgba(242,239,233,0.20) !important; }
        .auth-input:focus {
          border-color: var(--gold-dim) !important;
          box-shadow: 0 0 0 1px rgba(201,169,110,0.08) inset, 0 0 14px rgba(201,169,110,0.10) !important;
          outline: none !important;
        }

        /* Botón — mismo estilo borde blanco que "SOLICITAR ACCESO" / "ACCEDER" de la landing */
        .auth-submit {
          width: 100%;
          background: transparent !important;
          border: 1px solid var(--white) !important;
          color: var(--white) !important;
          font-size: 0.65rem !important;
          font-family: 'Jura', sans-serif !important;
          font-weight: 400 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.28em !important;
          transition: background .28s ease, color .28s ease, border-color .28s ease, box-shadow .28s ease !important;
          border-radius: 2px !important;
          box-shadow: none !important;
        }
        .auth-submit:hover:not(:disabled) {
          background: var(--white) !important;
          color: var(--black) !important;
          border-color: var(--white) !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .auth-submit:active:not(:disabled) {
          background: var(--gold) !important;
          border-color: var(--gold) !important;
          color: var(--black) !important;
        }
        .auth-submit:disabled { opacity: 0.35 !important; }

        .auth-error {
          font-family: 'Jura', sans-serif;
          font-size: 0.68rem;
          letter-spacing: 0.05em;
          color: rgba(239,100,100,0.8);
          background: rgba(239,68,68,0.05);
          border: 1px solid rgba(239,68,68,0.1);
          border-radius: 2px;
          padding: 0.6rem 0.875rem;
          margin-bottom: 1rem;
        }

        .auth-toggle {
          margin-top: 1.25rem;
          font-family: 'Jura', sans-serif;
          font-size: 0.62rem;
          letter-spacing: 0.12em;
          color: var(--white-dim);
          text-align: center;
          text-transform: uppercase;
        }
        .auth-toggle span {
          color: var(--gold-dim);
          cursor: pointer;
          transition: color 0.15s;
        }
        .auth-toggle span:hover { color: var(--gold); }

        @media (max-width: 768px) {
          .auth-root { flex-direction: column; }
          .auth-left-col { min-height: 55vh; flex: none; }
          .auth-brand { font-size: 2.8rem; }
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
                        color: 'rgba(201,169,110,0.3)', zIndex: 10, background: 'none', border: 'none', cursor: 'pointer'
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