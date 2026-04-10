import { useState, useCallback, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import * as auth from '../../services/auth';
import { Loader2, UserCircle, ArrowLeft } from 'lucide-react';

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 100;
const NAME_REGEX = /^[a-zA-Zа-яА-ЯёЁo'g\s\-]+$/;

export default function NamePage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= NAME_MAX_LENGTH) {
      setName(value);
      setError('');
    }
  }, []);

  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return t('auth.name.required' as any);
    }
    if (value.trim().length < NAME_MIN_LENGTH) {
      return t('auth.name.tooShort' as any);
    }
    if (/\d/.test(value)) {
      return t('validation.format' as any);
    }
    if (!NAME_REGEX.test(value)) {
      return t('validation.format' as any);
    }
    return null;
  }, [t]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const session = await auth.createUser(phone, name.trim());

      if (session.roles.includes('admin')) {
        navigate('/superadmin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unexpected' as any));
    } finally {
      setLoading(false);
    }
  }, [name, phone, navigate, t, validateName]);

  useEffect(() => {
    if (!phone) {
      navigate('/auth/login', { replace: true });
    }
  }, [phone, navigate]);

  const displayPhone = phone.replace(/(\+998)(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 ($2) $3-$4-$5');

  return (
    <div className="min-h-screen flex flex-col bg-navy-950">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate('/auth/login', { replace: true })}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg px-2"
            aria-label={t('common.actions.back' as any)}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{t('common.navigation.login' as any)}</span>
          </button>

          <div className="bg-navy-900 rounded-2xl shadow-card p-6 md:p-8 border border-navy-800">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mb-4">
                <UserCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-white text-center">
                {t('auth.name.title' as any)}
              </h1>
              <p className="text-slate-400 mt-2 text-center text-sm">
                {t('auth.name.subtitle' as any)}
              </p>
              {phone && (
                <p className="text-emerald-500 mt-1 text-sm font-medium" dir="ltr">
                  {displayPhone}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('common.labels.name' as any)}
                </label>
                <input
                  id="name"
                  type="text"
                  inputMode="text"
                  autoComplete="name"
                  value={name}
                  onChange={handleNameChange}
                  placeholder={t('auth.name.placeholder' as any)}
                  className="w-full px-4 py-3.5 bg-navy-800 border border-navy-700 rounded-xl text-white text-base placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[52px]"
                  aria-label={t('common.labels.name' as any)}
                  aria-invalid={error.length > 0}
                  aria-describedby={error ? 'name-error' : 'name-hint'}
                  autoFocus
                  maxLength={NAME_MAX_LENGTH}
                />
                <div className="flex justify-between mt-2">
                  {error ? (
                    <p id="name-error" className="text-sm text-red-400" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p id="name-hint" className="text-xs text-slate-500">
                      {t('validation.min' as any, { min: NAME_MIN_LENGTH })}
                    </p>
                  )}
                  <span className={`text-xs ${name.length >= NAME_MIN_LENGTH ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {name.length}/{NAME_MAX_LENGTH}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || name.trim().length < NAME_MIN_LENGTH}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('auth.name.save' as any)}</span>
                  </>
                ) : (
                  <span>{t('auth.name.save' as any)}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
