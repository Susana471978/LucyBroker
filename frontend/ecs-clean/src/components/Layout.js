import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { LayoutDashboard, Mail, LogOut, Globe, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { TrialBanner, TrialExpiredOverlay } from './TrialBanner';

const Layout = ({ children }) => {
  const { user, logout, language, updateLanguage } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/app', icon: LayoutDashboard, label: t(language, 'overview') },
    { path: '/app/messages', icon: Mail, label: t(language, 'messages') },
  ];

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ];

  const isActive = (path) => location.pathname === path;

  const getNavClass = (path) => {
    let cls = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ';
    if (isActive(path)) {
      cls += 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    } else {
      cls += 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';
    }
    return cls;
  };

  return (
    <div className="min-h-screen">
      <div className="bg-neural" />
      <header className="glass-premium border-b border-white/5 sticky top-0 z-50">
        <TrialBanner />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-24 py-2">
            <Link to="/app" className="flex items-center gap-3" data-testid="logo-link">
              <img src={require('../assets/logo/LogoEmail.png')} alt="SyntexIA | Email Control System" className="h-36 w-auto" />
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path} className={getNavClass(item.path)} data-testid={'nav-' + (item.path.replace('/', '') || 'overview')}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 gap-1" data-testid="language-selector">
                    <Globe className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline uppercase text-xs">{language}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700">
                  {languages.map((lang) => (
                    <DropdownMenuItem key={lang.code} onClick={() => updateLanguage(lang.code)} className={'cursor-pointer hover:bg-slate-800 hover:text-slate-100 ' + (language === lang.code ? 'text-blue-400' : 'text-slate-300')} data-testid={'lang-' + lang.code}>
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 gap-2" data-testid="user-menu">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-300">{user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                    </div>
                    <span className="hidden sm:inline text-sm">{user ? user.name : ''}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700">
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-slate-300 hover:bg-slate-800 hover:text-slate-100" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
                    {t(language, 'logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        {children}
        <TrialExpiredOverlay />
      </main>
    </div>
  );
};

export default Layout;
