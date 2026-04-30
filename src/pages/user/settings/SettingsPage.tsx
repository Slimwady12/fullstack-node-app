import { useState, useCallback, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import { transaction } from '../../../services/db';
import * as auth from '../../../services/auth';
import {
  UserCircle,
  Bell,
  Shield,
  Globe,
  UserCog,
  Download,
  Trash2,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react';

const LANGUAGES = [
  { code: 'uz' as const, label: 'O\'zbekcha' },
  { code: 'ru' as const, label: 'Русский' },
  { code: 'en' as const, label: 'English' },
];

export default function SettingsPage(): JSX.Element {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { user, activeRole, setActiveRole, logout } = useAuth();
  const { data, loading, refresh } = useRealtimeSync();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emailNotif, setEmailNotif] = useState<boolean>(true);
  const [pushNotif, setPushNotif] = useState<boolean>(true);
  const [quietStart, setQuietStart] = useState<string>('22:00');
  const [quietEnd, setQuietEnd] = useState<string>('07:00');
  const [showPhone, setShowPhone] = useState<boolean>(false);
  const [showEmail, setShowEmail] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [avatarUploading, setAvatarUploading] = useState<boolean>(false);

  useEffect(() => {
    if (user && data?.users) {
      const currentUserData = data.users.find(u => u.id === user.userId);
      if (currentUserData) {
        setName(currentUserData.name);
        setEmail(currentUserData.profile?.email || '');
        setEmailNotif(currentUserData.notifications?.email ?? true);
        setPushNotif(currentUserData.notifications?.push ?? true);
        setQuietStart(currentUserData.notifications?.quietHours?.start || '22:00');
        setQuietEnd(currentUserData.notifications?.quietHours?.end || '07:00');
        setShowPhone(currentUserData.privacy?.showPhone ?? false);
        setShowEmail(currentUserData.privacy?.showEmail ?? false);
      }
    }
  }, [user, data]);

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const currentUser = data?.users?.find(u => u.id === user?.userId);

  const handleSaveProfile = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      await transaction<void>((db) => {
        const idx = db.users.findIndex(u => u.id === user.userId);
        if (idx === -1) throw new Error('User not found');
        db.users[idx].name = name.trim() || db.users[idx].name;
        if (email.trim()) db.users[idx].profile.email = email.trim();
        db.users[idx].notifications.email = emailNotif;
        db.users[idx].notifications.push = pushNotif;
        db.users[idx].notifications.quietHours = { start: quietStart, end: quietEnd };
        db.users[idx].privacy.showPhone = showPhone;
        db.users[idx].privacy.showEmail = showEmail;

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.userId,
          action: 'PROFILE_UPDATED',
          details: { name: db.users[idx].name, email: db.users[idx].profile.email },
          timestamp: new Date().toISOString(),
          activeRole: activeRole || 'user',
        });
        return db;
      });
      setSaveStatus('success');
      refresh();
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [user, name, email, emailNotif, pushNotif, quietStart, quietEnd, showPhone, showEmail, activeRole, refresh]);

  const handleAvatarUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const responseData = await res.json();
      if (responseData.success && currentUser) {
        await transaction<void>((db) => {
          const idx = db.users.findIndex(u => u.id === user.userId);
          if (idx === -1) throw new Error('User not found');
          db.users[idx].profile.avatar = responseData.data.filename;
          return db;
        });
        refresh();
      }
    } catch {
      // ignore
    } finally {
      setAvatarUploading(false);
    }
  }, [user, currentUser, refresh]);

  const handleExport = useCallback(async () => {
    if (!user || !data) return;
    setExporting(true);
    try {
      const userData = data.users.find(u => u.id === user.userId);
      const exportData = {
        profile: userData,
        documents: data.documents?.filter(d => d.userId === user.userId),
        jobs: data.jobs?.filter(j => j.userId === user.userId),
        chats: data.aiChats?.filter(c => c.userId === user.userId),
        notifications: data.notifications?.filter(n => n.userId === user.userId),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-assistant-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [user, data]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete(`/api/users/${user.userId}`, {
        data: { userId: user.userId },
      });
      auth.logout();
      navigate('/auth/login', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setDeleteError(axiosErr.response?.data?.error || t('errors.deleteFailed' as any));
      setDeleting(false);
    }
  }, [user, t, navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/auth/login', { replace: true });
  }, [logout, navigate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-32">
      <h1 className="text-2xl font-bold text-white">{t('user.settings.title' as any)}</h1>

      {saveStatus === 'success' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3" role="alert">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-400">{t('common.misc.success' as any)}</p>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{t('errors.saveFailed' as any)}</p>
        </div>
      )}

      {/* Profile Section */}
      <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
          <UserCircle className="w-5 h-5 text-emerald-500" />
          <h2 className="text-white font-semibold">{t('user.settings.profile' as any)}</h2>
        </div>
        <div className="p-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {currentUser?.profile?.avatar ? (
                <img src={`/uploads/${currentUser.profile.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-8 h-8 text-emerald-500" />
              )}
            </div>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 hover:bg-navy-700 rounded-lg cursor-pointer text-sm text-slate-300 min-h-[44px] transition-colors focus-within:ring-2 focus-within:ring-emerald-500">
              {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{t('common.actions.upload' as any)}</span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
            </label>
          </div>

          <form onSubmit={handleSaveProfile} noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="settings-name" className="block text-sm font-medium text-slate-300 mb-2">{t('common.labels.name' as any)}</label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                />
              </div>
              <div>
                <label htmlFor="settings-phone" className="block text-sm font-medium text-slate-300 mb-2">{t('common.labels.phone' as any)}</label>
                <input
                  id="settings-phone"
                  type="text"
                  value={user?.phone || ''}
                  disabled
                  className="w-full px-4 py-3 bg-navy-800/50 border border-navy-700 rounded-xl text-slate-500 text-sm min-h-[48px] cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="block text-sm font-medium text-slate-300 mb-2">{t('common.labels.email' as any)}</label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('user.settings.emailPlaceholder' as any)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                />
              </div>

              {/* Notifications */}
              <div className="pt-4 border-t border-navy-800 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">{t('user.settings.notifications' as any)}</h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-300">{t('settings.notifications.emailNotifications' as any)}</span>
                  <ToggleSwitch checked={emailNotif} onChange={setEmailNotif} ariaLabel={t('settings.notifications.emailNotifications' as any)} />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-300">{t('settings.notifications.pushNotifications' as any)}</span>
                  <ToggleSwitch checked={pushNotif} onChange={setPushNotif} ariaLabel={t('settings.notifications.pushNotifications' as any)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('settings.privacy.quietHoursStart' as any)}</label>
                    <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('settings.privacy.quietHoursEnd' as any)}</label>
                    <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]" />
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="pt-4 border-t border-navy-800 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">{t('user.settings.privacy' as any)}</h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-300">{t('settings.privacy.showPhone' as any)}</span>
                  <ToggleSwitch checked={showPhone} onChange={setShowPhone} ariaLabel={t('settings.privacy.showPhone' as any)} />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-300">{t('settings.privacy.showEmail' as any)}</span>
                  <ToggleSwitch checked={showEmail} onChange={setShowEmail} ariaLabel={t('settings.privacy.showEmail' as any)} />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-busy={saving}
              >
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{t('common.misc.loading' as any)}</span></> : <><CheckCircle2 className="w-5 h-5" /><span>{t('common.actions.save' as any)}</span></>}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Language */}
      <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
          <Globe className="w-5 h-5 text-emerald-500" />
          <h2 className="text-white font-semibold">{t('user.settings.language' as any)}</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  language === lang.code
                    ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-navy-800 text-slate-400 border border-navy-700 hover:border-navy-600'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Role Switcher */}
      {user && user.roles.length > 1 && (
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <UserCog className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">Switch Role</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {user.roles.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveRole(role)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    activeRole === role
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-navy-800 text-slate-400 border border-navy-700 hover:border-navy-600'
                  }`}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Export */}
      <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
          <Download className="w-5 h-5 text-emerald-500" />
          <h2 className="text-white font-semibold">{t('user.settings.exportData' as any)}</h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-400 mb-4">{t('settings.export.description' as any)}</p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{t('settings.export.export' as any)}</span>
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-navy-900 border border-red-500/30 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-red-400 font-semibold">{t('settings.delete.title' as any)}</h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-400 mb-2">{t('settings.delete.warning' as any)}</p>
          <p className="text-xs text-slate-500 mb-4">{t('settings.delete.description' as any)}</p>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('settings.delete.title' as any)}</span>
          </button>
        </div>
      </section>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-navy-900 border border-navy-800 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <LogOut className="w-5 h-5" />
        <span>{t('common.navigation.logout' as any)}</span>
      </button>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !deleting && setDeleteConfirm(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-white">{t('settings.delete.title' as any)}</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-slate-300">{t('settings.delete.confirmDialog' as any)}</p>
              {deleteError && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{deleteError}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('settings.delete.cancel' as any)}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-busy={deleting}
              >
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t('common.misc.loading' as any)}</span></> : <><Trash2 className="w-4 h-4" /><span>{t('settings.delete.confirm' as any)}</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, ariaLabel, disabled = false }: ToggleSwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 min-w-[48px] min-h-[44px] flex items-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-emerald-600' : 'bg-navy-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
