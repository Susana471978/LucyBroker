import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { LayoutDashboard, Mail, CheckSquare, Settings, LogOut, Globe, ChevronDown, Flame } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { TrialBanner, TrialExpiredOverlay } from './TrialBanner';

/* ─── Dropdown propio — sin dependencia de Radix/slate ───── */
function Dropdown({ trigger, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 min-w-[160px] rounded-2xl overflow-hidden z-50
            bg-[rgba(10,10,16,0.95)] border border-[rgba(255,255,255,0.08)]
            shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, children, active }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left
        transition-colors duration-150
        ${active
          ? 'text-[#C9B27C] bg-[rgba(201,178,124,0.06)]'
          : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.04)]'
        }`}
    >
      {children}
    </button>
  );
}

/* ─── Layout ──────────────────────────────────────────────── */
const Layout = ({ children }) => {
  const { user, logout, language, updateLanguage } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/app', icon: LayoutDashboard, label: t(language, 'overview') },
    { path: '/app/messages', icon: Mail, label: t(language, 'messages') },
    { path: '/app/tasks', icon: CheckSquare, label: 'Tareas' },
  ];

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ];

  const isActive = (path) => location.pathname === path;

  const userName = user?.name || '';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen" style={{ background: '#080A0F' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(8,10,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <TrialBanner />

        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center justify-between h-16">

            {/* Logo Lucy */}
            <Link
              to="/app"
              className="flex items-center gap-3 group"
              data-testid="logo-link"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center
                bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)]
                group-hover:border-[rgba(201,178,124,0.4)] transition-all duration-300">
                <svg width="12" height="12" viewBox="0 0 22 22" fill="none">
                  <path
                    d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                    fill="#C9B27C"
                  />
                </svg>
              </div>
              <span
                className="text-[rgba(255,255,255,0.85)] font-light tracking-wide text-sm
                  group-hover:text-white transition-colors duration-200"
                style={{ fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.04em' }}
              >
                Lucy
                <span className="text-[rgba(201,178,124,0.6)]">.</span>
              </span>
            </Link>

            {/* Nav central */}
            <nav className="flex items-center gap-0.5 sm:gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={'nav-' + (item.path.replace('/app', '') || 'overview')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs uppercase
                      tracking-[0.08em] font-medium transition-all duration-200
                      ${active
                        ? 'bg-[rgba(201,178,124,0.1)] text-[#C9B27C] border border-[rgba(201,178,124,0.25)]'
                        : 'text-[rgba(255,255,255,0.35)] border border-transparent hover:text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.04)]'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Derecha — idioma + usuario */}
            <div className="flex items-center gap-1 sm:gap-2">

              {/* Selector de idioma */}
              <Dropdown
                trigger={
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                      text-[rgba(255,255,255,0.3)] border border-transparent
                      hover:text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)]
                      transition-all duration-200"
                    data-testid="language-selector"
                  >
                    <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="hidden sm:inline uppercase tracking-wider">{language}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                }
              >
                {languages.map((lang) => (
                  <DropdownItem
                    key={lang.code}
                    onClick={() => updateLanguage(lang.code)}
                    active={language === lang.code}
                  >
                    {lang.label}
                  </DropdownItem>
                ))}
              </Dropdown>

              {/* Menú usuario */}
              <Dropdown
                trigger={
                  <button
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl
                      border border-transparent hover:border-[rgba(255,255,255,0.08)]
                      hover:bg-[rgba(255,255,255,0.03)] transition-all duration-200"
                    data-testid="user-menu"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center
                      bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)]">
                      <span className="text-xs font-medium text-[#C9B27C]">
                        {userInitial}
                      </span>
                    </div>
                    <span className="hidden sm:inline text-xs text-[rgba(255,255,255,0.45)]">
                      {userName}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[rgba(255,255,255,0.2)]" />
                  </button>
                }
              >
                <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs text-[rgba(255,255,255,0.6)] font-medium">{userName}</p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.25)] mt-0.5 uppercase tracking-wider">
                    Cuenta activa
                  </p>
                </div>

                <DropdownItem onClick={() => window.location.href = '/app/habits'}>
                  <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Hábitos
                </DropdownItem>

                <DropdownItem onClick={() => window.location.href = '/app/settings'}>
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Configuración
                </DropdownItem>

                <DropdownItem onClick={logout} data-testid="logout-btn">
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {t(language, 'logout')}
                </DropdownItem>
              </Dropdown>

            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.15)] to-transparent" />
      </header>

      {/* ── Main ──────────────────────────────────────────── */}
      <main className="relative">
        {children}
        <TrialExpiredOverlay />
      </main>

    </div>
  );
};

export default Layout;