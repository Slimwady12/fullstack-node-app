import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { en } from './en';
import { uz } from './uz';
import { ru } from './ru';

type LanguageCode = 'en' | 'uz' | 'ru';

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K & string}.`>
        : `${Prefix}${K & string}`;
    }[keyof T & (string | number)]
  : never;

type TranslationKey = NestedKeyOf<typeof en>;

type TranslationValue = string | ((params: Record<string, string | number>) => string);

type FlattenTranslations<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends TranslationValue
    ? `${Prefix}${K & string}`
    : T[K] extends object
      ? FlattenTranslations<T[K], `${Prefix}${K & string}.`>
    : never;
}[keyof T];

type AllTranslationKeys = FlattenTranslations<typeof en>;

interface Translations {
  [key: string]: unknown;
}

const translationsMap: Record<LanguageCode, Translations> = {
  en,
  uz,
  ru,
};

function getNestedValue(obj: Translations, path: string): TranslationValue | Translations | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current as TranslationValue | Translations | undefined;
}

function interpolateString(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

const LANGUAGE_STORAGE_KEY = 'legal_platform_language';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: AllTranslationKeys, params?: Record<string, string | number>) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectInitialLanguage(userLanguage?: LanguageCode): LanguageCode {
  if (userLanguage && ['en', 'uz', 'ru'].includes(userLanguage)) {
    return userLanguage;
  }

  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && ['en', 'uz', 'ru'].includes(stored)) {
      return stored as LanguageCode;
    }
  } catch {
    // localStorage not available
  }

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('uz')) return 'uz';
  if (browserLang.startsWith('ru')) return 'ru';
  if (browserLang.startsWith('en')) return 'en';

  return 'uz';
}

interface LanguageProviderProps {
  children: ReactNode;
  initialLanguage?: LanguageCode;
}

export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps): React.ReactElement {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage(initialLanguage));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // localStorage not available
    }
    setLoading(false);
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: AllTranslationKeys, params?: Record<string, string | number>): string => {
    const translationObj = translationsMap[language];
    const value = getNestedValue(translationObj, key as string);

    if (typeof value === 'string') {
      return interpolateString(value, params);
    }

    if (typeof value === 'function') {
      return (value as TranslationValue)(params || {}) as string;
    }

    console.warn(`Translation key not found: ${key} for language: ${language}`);
    return key as string;
  }, [language]);

  const contextValue = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t,
    loading,
  }), [language, setLanguage, t, loading]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
