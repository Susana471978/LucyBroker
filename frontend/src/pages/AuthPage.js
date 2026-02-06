import { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function AuthPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell relative">

      {/* Background */}
      <div
        className="bg-neural pointer-events-none"
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="auth-stack relative z-10"
      >
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="auth-brand"
        >
          <div className="auth-brand-icon">
            <Mail className="w-7 h-7 text-blue-100" strokeWidth={1.4} />
          </div>

          <h1>Email Control</h1>

          <p>
            Transforma tu bandeja en un panel de decisiones.
            Reduce el ruido, prioriza acciones.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="auth-card"
        >
          <h2>Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="auth-form">

            {/* Email */}
            <div className="auth-field">
              <label className="auth-field-label">
                Correo electrónico
              </label>

              <div className="auth-input-wrapper">
                <Mail
                  className="auth-input-icon"
                  strokeWidth={1.4}
                />

                <Input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="email@example.com"
                  autoComplete="email"
                  required
                  className="auth-input !h-14 !rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="auth-email-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-field-label">
                Contraseña
              </label>

              <div className="auth-input-wrapper">
                <Lock
                  className="auth-input-icon"
                  strokeWidth={1.4}
                />

                <Input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="auth-input !h-14 !rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="auth-password-input"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="auth-error"
                data-testid="auth-error-message"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="auth-submit !h-14 !rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="auth-submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>

          </form>

          <p className="auth-secondary-link">
            ¿No tienes cuenta? <span>Registrarse</span>
          </p>

        </motion.div>
      </motion.div>
    </div>
  );
}
