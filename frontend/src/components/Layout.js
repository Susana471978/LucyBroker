import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { LayoutDashboard, Mail, CheckSquare, Settings, LogOut, Globe, ChevronDown, Flame, Crown } from 'lucide-react';
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
          className="absolute right-0 top-full mt-3 min-w-[190px] overflow-hidden rounded-2xl border z-50 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.58),0_0_32px_rgba(36,99,235,0.08)]"
          style={{
            background: 'linear-gradient(180deg, rgba(7,12,22,0.96) 0%, rgba(3,7,16,0.98) 100%)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
          onClick={() => setOpen(false)}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(201,178,124,0.06),transparent_34%)]" />
          <div className="relative z-10">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, children, active, ...props }) {
  return (
    <button
      onClick={onClick}
      {...props}
      className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left transition-all duration-150 ${active
          ? 'text-[rgba(241,216,150,0.96)] bg-[rgba(201,178,124,0.08)]'
          : 'text-[rgba(214,227,249,0.72)] hover:text-[rgba(242,247,255,0.96)] hover:bg-[rgba(59,130,246,0.06)]'
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
  const navigate = useNavigate();

  const navItems = [
    { path: '/app', icon: LayoutDashboard, label: t(language, 'overview') },
    { path: '/app/messages', icon: Mail, label: t(language, 'messages') },
    { path: '/app/tasks', icon: CheckSquare, label: 'Tareas y recordatorios' },
  ];

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ];

  const isActive = (path) => location.pathname === path;

  const userName = user?.name || '';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-black">
      {/* ── Header ────────────────────────────────────────── */}

      <header
        className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(2,6,16,0.82)] backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.34)]"
      >
        <TrialBanner />

        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center justify-between h-[78px] gap-4">
            {/* Logo Lucy */}
            <Link
              to="/app"
              className="flex items-center gap-3 group shrink-0"
              data-testid="logo-link"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-300
                bg-[linear-gradient(180deg,rgba(16,22,38,0.95)_0%,rgba(7,11,21,0.98)_100%)]
                border-[rgba(201,178,124,0.16)]
                shadow-[0_0_20px_rgba(36,99,235,0.08)]
                group-hover:border-[rgba(201,178,124,0.30)]
                group-hover:shadow-[0_0_28px_rgba(201,178,124,0.10),0_0_24px_rgba(36,99,235,0.10)]"
              >
                <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
                  <path
                    d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                    fill="#C9B27C"
                  />
                </svg>
              </div>

              <div className="flex flex-col leading-none">
                <span
                  className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(201,178,124,0.78)]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  Executive AI
                </span>
                <span
                  className="font-light tracking-[0.05em] text-[1rem] text-[#C9B27C] group-hover:text-[rgba(237,223,184,0.98)] transition-colors duration-200"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  Lucy
                  <span className="text-[rgba(88,160,255,0.55)]">.</span>
                </span>
              </div>
            </Link>

            {/* Nav central */}
            <nav className="hidden md:flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(7,12,22,0.62)] px-2 py-2 backdrop-blur-md shadow-[0_0_30px_rgba(36,99,235,0.05)]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={'nav-' + (item.path.replace('/app', '') || 'overview')}
                    className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.78rem] font-medium uppercase tracking-[0.08em] transition-all duration-200 ${active
                        ? 'border border-[rgba(201,178,124,0.24)] bg-[linear-gradient(180deg,rgba(42,31,10,0.92)_0%,rgba(21,16,7,0.98)_100%)] text-[rgba(241,216,150,0.96)] shadow-[0_0_18px_rgba(201,178,124,0.10)]'
                        : 'border border-transparent text-[rgba(180,194,216,0.76)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(241,246,255,0.96)]'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Nav compacta móvil */}
            <nav className="flex md:hidden items-center gap-1 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(7,12,22,0.62)] px-1.5 py-1.5 backdrop-blur-md shadow-[0_0_24px_rgba(36,99,235,0.04)]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={'nav-' + (item.path.replace('/app', '') || 'overview')}
                    className={`flex items-center justify-center rounded-full p-2.5 transition-all duration-200 ${active
                        ? 'border border-[rgba(201,178,124,0.24)] bg-[linear-gradient(180deg,rgba(42,31,10,0.92)_0%,rgba(21,16,7,0.98)_100%)] text-[rgba(241,216,150,0.96)] shadow-[0_0_16px_rgba(201,178,124,0.08)]'
                        : 'border border-transparent text-[rgba(180,194,216,0.76)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(241,246,255,0.96)]'
                      }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                );
              })}
            </nav>

            {/* Derecha — idioma + usuario */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Selector de idioma */}
              <Dropdown
                trigger={
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs text-[rgba(186,200,221,0.72)] transition-all duration-200 hover:border-[rgba(88,160,255,0.14)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(242,247,255,0.96)]"
                    data-testid="language-selector"
                  >
                    <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="hidden sm:inline uppercase tracking-[0.14em]">{language}</span>
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
                    className="flex items-center gap-2 rounded-xl border border-transparent pl-1 pr-3 py-1.5 transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
                    data-testid="user-menu"
                  >
                    <div
                      className="w-9 h-9 rounded-2xl flex items-center justify-center border
                      bg-[linear-gradient(180deg,rgba(39,28,10,0.95)_0%,rgba(20,15,7,0.98)_100%)]
                      border-[rgba(201,178,124,0.22)]
                      shadow-[0_0_18px_rgba(201,178,124,0.08)]"
                    >
                      <span className="text-xs font-semibold text-[#C9B27C]">
                        {userInitial}
                      </span>
                    </div>

                    <span className="hidden sm:inline text-xs text-[rgba(214,227,249,0.62)] max-w-[120px] truncate">
                      {userName}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[rgba(214,227,249,0.30)]" />
                  </button>
                }
              >
                <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs text-[rgba(242,247,255,0.88)] font-medium">{userName}</p>
                  <p className="text-[10px] text-[rgba(180,194,216,0.46)] mt-0.5 uppercase tracking-[0.16em]">
                    Cuenta activa
                  </p>
                </div>

                <DropdownItem onClick={() => navigate('/app/habits')}>
                  <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Hábitos
                </DropdownItem>

                <DropdownItem onClick={() => navigate('/app/pricing')}>
                  <Crown className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Planes
                </DropdownItem>

                <DropdownItem onClick={() => navigate('/app/settings')}>
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

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(88,160,255,0.18)] to-transparent" />
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