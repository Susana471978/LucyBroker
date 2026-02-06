import { useState } from 'react'
import '../styles/login.css'

function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('loading')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }
    } catch (submitError) {
      console.error(submitError)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="auth-shell">
      <div className="bg-neural" aria-hidden="true" />
      <div className="auth-stack">
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="9" width="22" height="14" rx="4" stroke="url(#gradient-border)" strokeWidth="1.4" />
              <path d="M6 10.5 16 18l10-7.5" stroke="url(#gradient-border)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradient-border" x1="5" y1="9" x2="30" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#93c5fd" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>Email Control</h1>
          <p>Transforma tu bandeja en un panel de decisiones. Reduce el ruido, prioriza acciones.</p>
        </div>

        <div className="auth-card">
          <h2>Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span className="auth-field-label">Correo electrónico</span>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m4 6 8 7 8-7" />
                  </svg>
                </span>
                <input
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="auth-input"
                />
              </div>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">Contraseña</span>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="5" y="11" width="14" height="9" rx="2.5" />
                    <path d="M9 11V8a3 3 0 0 1 6 0v3" />
                  </svg>
                </span>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="auth-input"
                />
              </div>
            </label>

            <button type="submit" className="auth-submit" disabled={status === 'loading'}>
              <span>Iniciar sesión</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M5 12h14" strokeLinecap="round" />
                <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          <p className="auth-secondary-link">
            ¿No tienes cuenta? <span>Registrarse</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginView
