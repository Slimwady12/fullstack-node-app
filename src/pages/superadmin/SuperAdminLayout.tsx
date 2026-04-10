import { useState, useCallback, useEffect, ReactNode } from 'react';
import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  FileText,
  Users,
  Shield,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  Globe,
  ChevronDown,
  UserCog,
} from 'lucide-react';

interface NavItem {
  key: string;
  path: string;
  icon: ReactNode;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', path: '/superadmin', icon: <LayoutDashboard className="w-5 h-5" />, labelKey: 'superadmin.dashboard.title' },
  { key: 'automations', path: '/superadmin/automations', icon: <FileText className="w-5 h-5" />, labelKey: 'common.navigation.templates' },
  { key: 'lawyers', path: '/superadmin/lawyers', icon: <Users className="w-5 h-5" />, labelKey: 'common.navigation.lawyers' },
  { key: 'audit', path: '/superadmin/audit', icon: <Shield className="w-5 h-5" />, labelKey: 'superadmin.systemConfig.title' },
  { key: 'system', path: '/superadmin/system', icon: <Settings className="w-5 h-5" />, labelKey: 'superadmin.dashboard.systemSettings' },
];

const LANGUAGES = [
  { code: 'uz' as const, label: 'O\'zbekcha' },
  { code: 'ru' as const, label: 'Русский' },
  { code: 'en' as const, label: 'English' },
];

export default function SuperAdminLayout(): JSX.Element {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, activeRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState<boolean>(false);

  const unreadCount = 0;

  const currentPath = location.pathname;

  const isActive = useCallback((path: string): boolean => {
    if (path === '/superadmin') return currentPath === '/superadmin';
    return currentPath.startsWith(path);
  }, [currentPath]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/auth/login', { replace: true });
  }, [logout, navigate]);

  const handleLangSelect = useCallback((code: 'uz' | 'ru' | 'en') => {
    setLanguage(code);
    setLangMenuOpen(false);
  }, [setLanguage]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (langMenuOpen) setLangMenuOpen(false);
      if (notifMenuOpen) setNotifMenuOpen(false);
    };

    if (langMenuOpen || notifMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [langMenuOpen, notifMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <div className="animate-pulse text-slate-400 text-lg">{t('common.misc.loading' as any)}</div>
      </div>
    );
  }

  const currentLang = LANGUAGES.find(l => l.code === language);

  return (
    <div className="min-h-screen flex bg-navy-950" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-navy-900 border-r border-navy-800 fixed top-0 left-0 bottom-0 z-30" role="navigation" aria-label="Super Admin Navigation">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
          <Shield className="w-8 h-8 text-emerald-500" />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Legal Admin</h1>
            <span className="text-xs text-emerald-500 font-medium uppercase tracking-wider">{activeRole}</span>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              to={item.path}
              className={`flex items-center gap-3 px-6 py-3.5 min-h-[48px] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
                isActive(item.path)
                  ? 'bg-emerald-600/10 text-emerald-400 border-r-2 border-emerald-500'
                  : 'text-slate-400 hover:text-white hover:bg-navy-800'
              }`}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              {item.icon}
              <span className="text-sm font-medium">{t(item.labelKey as any)}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-navy-800 p-4 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={t('common.navigation.logout' as any)}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">{t('common.navigation.logout' as any)}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 w-72 bg-navy-900 z-50 transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-500" />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Legal Admin</h1>
              <span className="text-xs text-emerald-500 font-medium uppercase tracking-wider">{activeRole}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={t('common.actions.close' as any)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-6 py-4 min-h-[52px] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
                isActive(item.path)
                  ? 'bg-emerald-600/10 text-emerald-400 border-l-2 border-emerald-500'
                  : 'text-slate-400 hover:text-white hover:bg-navy-800'
              }`}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              {item.icon}
              <span className="text-sm font-medium">{t(item.labelKey as any)}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-navy-800 p-4 space-y-2">
          <button
            type="button"
            onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-4 min-h-[52px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={t('common.navigation.logout' as any)}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">{t('common.navigation.logout' as any)}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-navy-900/95 backdrop-blur-sm border-b border-navy-800 px-4 md:px-6 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="hidden md:block">
                <h2 className="text-white font-semibold text-lg">
                  {NAV_ITEMS.find(item => isActive(item.path)) ? t(NAV_ITEMS.find(item => isActive(item.path))!.labelKey as any) : t('superadmin.dashboard.title' as any)}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLangMenuOpen(!langMenuOpen); }}
                  className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] bg-navy-800 hover:bg-navy-700 rounded-lg text-slate-300 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Select language"
                  aria-expanded={langMenuOpen}
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden lg:inline">{currentLang?.label}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {langMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-44 bg-navy-800 border border-navy-700 rounded-xl shadow-modal py-1 z-30"
                    onClick={(e) => e.stopPropagation()}
                    role="menu"
                  >
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleLangSelect(lang.code)}
                        className={`w-full text-left px-4 py-3 min-h-[44px] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
                          language === lang.code
                            ? 'bg-emerald-600/10 text-emerald-400'
                            : 'text-slate-300 hover:bg-navy-700 hover:text-white'
                        }`}
                        role="menuitem"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setNotifMenuOpen(!notifMenuOpen); }}
                  className="relative w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={t('notifications.bell.title' as any)}
                  aria-expanded={notifMenuOpen}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-3 pl-2 border-l border-navy-700 ml-1">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-white text-sm font-medium truncate max-w-32">{user.name}</span>
                  <span className="text-slate-500 text-xs">{user.phone}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">Something went wrong</p>
          <p className="text-slate-500 text-sm mt-2">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
