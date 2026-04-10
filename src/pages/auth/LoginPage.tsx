import { useState, useCallback, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import * as auth from '../../services/auth';
import { Loader2, Shield, User } from 'lucide-react';

const PHONE_PREFIX = '+998';
const PHONE_DIGITS = 9;

function formatPhone(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 5) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

export default function LoginPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  const formattedPhone = `${PHONE_PREFIX}${digits.length > 0 ? ' ' : ''}${formatPhone(digits)}`;

  const handleDigitChange = useCallback((value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
    setDigits(cleaned);
    setError('');
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    if (digits.length !== PHONE_DIGITS) {
      setError(t('validation.phone' as any));
      return;
    }

    const phone = `${PHONE_PREFIX}${digits}`;
    setLoading(true);
    setError('');

    try {
      const result = auth.login(phone);

      if (result.isSuperAdmin) {
        setIsSuperAdmin(true);
        const session: auth.Session = {
          userId: 'superadmin-001',
          phone,
          name: 'Super Admin',
          roles: ['admin'],
          activeRole: 'admin',
          joinedAt: new Date().toISOString(),
        };
        auth.setSession(session);
        navigate('/superadmin', { replace: true });
        return;
      }

      if (result.requiresOtp) {
        navigate(`/auth/otp?phone=${encodeURIComponent(phone)}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unexpected' as any));
    } finally {
      setLoading(false);
    }
  }, [digits, navigate, t]);

  const handleDevLogin = useCallback(async () => {
    setDigits('901234567');
    setLoading(true);
    setError('');

    try {
      const phone = `${PHONE_PREFIX}901234567`;
      auth.login(phone);
      navigate(`/auth/otp?phone=${encodeURIComponent(phone)}`, { replace: true });
    } catch {
      setError(t('errors.unexpected' as any));
    } finally {
      setLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => {
    const saved = localStorage.getItem(auth.SESSION_STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved) as auth.Session;
        if (session.userId) {
          navigate('/user', { replace: true });
        }
      } catch {
        localStorage.removeItem(auth.SESSION_STORAGE_KEY);
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-navy-900 rounded-2xl shadow-card p-6 md:p-8 border border-navy-800">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              {t('auth.login.title' as any)}
            </h1>
            <p className="text-slate-400 mt-2 text-center text-sm">
              {t('auth.login.subtitle' as any)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                {t('common.labels.phone' as any)}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base select-none pointer-events-none" dir="ltr">
                  {PHONE_PREFIX}
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={digits}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleDigitChange(e.target.value)}
                  placeholder="XX XXX XX XX"
                  className="w-full pl-20 pr-4 py-3.5 bg-navy-800 border border-navy-700 rounded-xl text-white text-lg tracking-wider placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[52px]"
                  aria-label={t('common.labels.phone' as any)}
                  aria-invalid={error.length > 0}
                  aria-describedby={error ? 'phone-error' : undefined}
                  autoFocus
                />
              </div>
              {digits.length > 0 && (
                <p className="mt-2 text-sm text-emerald-400">
                  {formattedPhone}
                </p>
              )}
              {error && (
                <p id="phone-error" className="mt-2 text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || digits.length < PHONE_DIGITS}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('auth.login.verifying' as any)}</span>
                </>
              ) : (
                <span>{t('auth.login.sendOtp' as any)}</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-navy-800 space-y-3">
            <button
              type="button"
              onClick={() => {
                setDigits('123456789');
              }}
              disabled={loading}
              className="w-full py-3 bg-emerald-900/30 hover:bg-emerald-900/50 disabled:opacity-50 text-emerald-400 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 border border-emerald-800/30"
              aria-label="Login as SuperAdmin"
            >
              <Shield className="w-4 h-4" />
              <span>Login as SuperAdmin</span>
            </button>

            <button
              type="button"
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-navy-900"
              aria-label="Developer shortcut"
            >
              <User className="w-4 h-4" />
              <span>Login as User (Dev)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
