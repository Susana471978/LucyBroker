import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';

export default function AuthPage() {
  const { login, register, language } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err.response?.data?.detail || t(language, 'invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background */}
      <div className="bg-neural" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-gradient">Email Control</h1>
          </motion.div>
          <p className="text-slate-400 text-sm">
            {t(language, 'welcomeSubtitle')}
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-premium rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-100 mb-6">
            {isLogin ? t(language, 'login') : t(language, 'register')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm text-slate-400">{t(language, 'name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" strokeWidth={1.5} />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                    placeholder="John Doe"
                    required={!isLogin}
                    data-testid="register-name-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-slate-400">{t(language, 'email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" strokeWidth={1.5} />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  placeholder="email@example.com"
                  required
                  data-testid="auth-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">{t(language, 'password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" strokeWidth={1.5} />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  placeholder="••••••••"
                  required
                  data-testid="auth-password-input"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                data-testid="auth-error-message"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl btn-glow"
              data-testid="auth-submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? t(language, 'login') : t(language, 'register')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
              data-testid="auth-toggle-mode"
            >
              {isLogin ? t(language, 'noAccount') : t(language, 'hasAccount')}
              <span className="ml-1 text-blue-400">
                {isLogin ? t(language, 'register') : t(language, 'login')}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
