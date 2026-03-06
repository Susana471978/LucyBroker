import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import videoBg from "../assets/video-fondo-ecs.mp4";

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

      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }

      navigate('/app');

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        (isRegister ? 'Error al registrarse' : 'Error al iniciar sesión')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden">

      {/* Video de fondo */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="ecs-auth-video-bg"
      >
        <source src={videoBg} type="video/mp4" />
      </video>

      {/* Contenido */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="auth-stack relative z-10"
      >

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="auth-brand"
        >

          <div className="auth-brand-icon">
            {/* Icono Lucy — estrella/diamante minimalista */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                fill="rgba(201,178,124,0.9)"
                stroke="rgba(201,178,124,0.4)"
                strokeWidth="0.5"
              />
            </svg>
          </div>

          <h1>Lucy</h1>

          <p>
            Tu secretaria ejecutiva.<br />
            Inteligencia al servicio de tu tiempo.
          </p>

        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="auth-card"
        >

          <h2>
            {isRegister ? 'Crear cuenta' : 'Acceder'}
          </h2>

          <form onSubmit={handleSubmit} className="auth-form">

            {isRegister && (
              <div className="auth-field">
                <label className="auth-field-label">Nombre</label>
                <div className="auth-input-wrapper">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    className="auth-input !h-[3.2rem] !rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ paddingLeft: '1rem' }}
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-field-label">Correo electrónico</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" strokeWidth={1.4} />
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="hola@tuempresa.com"
                  autoComplete="email"
                  required
                  className="auth-input !h-[3.2rem] !rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label">Contraseña</label>
              <div className="auth-input-wrapper relative">
                <Lock className="auth-input-icon" strokeWidth={1.4} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  className="auth-input !h-[3.2rem] !rounded-xl !pr-12 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.55)] transition-colors z-10"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" strokeWidth={1.4} />
                    : <Eye className="w-4 h-4" strokeWidth={1.4} />
                  }
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="auth-error"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="auth-submit !h-[3.2rem] !rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Crear cuenta' : 'Entrar'}
                  <ArrowRight className="w-4 h-4 ml-2 opacity-60" />
                </>
              )}
            </Button>

          </form>

          <p className="auth-secondary-link">
            {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
            <span
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
            >
              {isRegister ? 'Iniciar sesión' : 'Crear cuenta'}
            </span>
          </p>

        </motion.div>
      </motion.div>
    </div>
  );
}