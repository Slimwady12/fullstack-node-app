import { useState, useCallback, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import * as auth from '../../services/auth';
import { Loader2, ArrowLeft, Delete, KeyRound } from 'lucide-react';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function OtpPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [otp, setOtp] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const cooldownRef = useRef<number | null>(null);

  const handleDigit = useCallback((digit: string) => {
    setOtp(prev => {
      if (prev.length >= OTP_LENGTH) return prev;
      return prev + digit;
    });
    setError('');
  }, []);

  const handleBackspace = useCallback(() => {
    setOtp(prev => prev.slice(0, -1));
    setError('');
  }, []);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (otp.length !== OTP_LENGTH) {
      setError(t('validation.required' as any));
      return;
    }

    setLoading(true);
    setError('');

    try {
      auth.verifyOtp(phone, otp);

      const existingSession = await auth.completeLogin(phone);

      if (existingSession) {
        if (existingSession.roles.includes('admin')) {
          navigate('/superadmin', { replace: true });
        } else {
          navigate('/user', { replace: true });
        }
        return;
      }

      navigate(`/auth/name?phone=${encodeURIComponent(phone)}`, { replace: true });
    } catch (err) {
      if (err === 'INVALID_OTP') {
        setError(t('auth.otp.invalidCode' as any));
      } else {
        setError(err instanceof Error ? err.message : t('errors.unexpected' as any));
      }
    } finally {
      setLoading(false);
    }
  }, [otp, phone, navigate, t]);

  const handleResend = useCallback(() => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);
    setError('');
  }, [cooldown]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }

    cooldownRef.current = window.setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [cooldown]);

  useEffect(() => {
    if (otp.length === OTP_LENGTH) {
      handleSubmit();
    }
  }, [otp, handleSubmit]);

  useEffect(() => {
    if (!phone) {
      navigate('/auth/login', { replace: true });
    }
  }, [phone, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter' && otp.length === OTP_LENGTH) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleSubmit, otp.length]);

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
                <KeyRound className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-white text-center">
                {t('auth.otp.title' as any)}
              </h1>
              <p className="text-slate-400 mt-2 text-center text-sm">
                {t('auth.otp.subtitle' as any)}
              </p>
              {phone && (
                <p className="text-emerald-500 mt-1 text-sm font-medium" dir="ltr">
                  {displayPhone}
                </p>
              )}
            </div>

            <div className="flex justify-center gap-2 mb-6" role="group" aria-label="OTP input">
              {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                <div
                  key={index}
                  className={`w-11 h-14 md:w-12 md:h-16 flex items-center justify-center rounded-xl border-2 transition-all duration-200 ${
                    index < otp.length
                      ? 'border-emerald-500 bg-emerald-500/10 text-white text-2xl font-bold'
                      : index === otp.length
                        ? 'border-emerald-500 bg-navy-800 text-white'
                        : 'border-navy-700 bg-navy-800 text-slate-500'
                  }`}
                  aria-hidden="true"
                >
                  {otp[index] || ''}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-center text-sm text-red-400 mb-4" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || otp.length < OTP_LENGTH}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 min-h-[52px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 mb-4"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('auth.otp.verify' as any)}</span>
                </>
              ) : (
                <span>{t('auth.otp.verify' as any)}</span>
              )}
            </button>

            <div className="text-center">
              {cooldown > 0 ? (
                <p className="text-slate-500 text-sm">
                  {t('auth.otp.resendTimer' as any, { seconds: cooldown })}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-emerald-500 hover:text-emerald-400 text-sm font-medium min-h-[44px] min-w-[44px] px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg transition-colors"
                >
                  {t('auth.otp.resend' as any)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-navy-900 border-t border-navy-800 px-4 py-4 safe-area-bottom">
        <div className="max-w-sm mx-auto">
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                disabled={otp.length >= OTP_LENGTH}
                className="h-14 md:h-16 bg-navy-800 hover:bg-navy-700 active:bg-navy-600 disabled:opacity-50 text-white text-2xl font-medium rounded-xl transition-all duration-150 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 select-none touch-manipulation"
                aria-label={`Digit ${digit}`}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={otp.length >= OTP_LENGTH}
              className="h-14 md:h-16 bg-navy-800 hover:bg-navy-700 active:bg-navy-600 disabled:opacity-50 text-white text-2xl font-medium rounded-xl transition-all duration-150 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 select-none touch-manipulation"
              aria-label="Digit 0"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={otp.length === 0}
              className="h-14 md:h-16 bg-navy-800 hover:bg-navy-700 active:bg-navy-600 disabled:opacity-50 text-slate-400 hover:text-white rounded-xl transition-all duration-150 flex items-center justify-center min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 select-none touch-manipulation"
              aria-label="Backspace"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
