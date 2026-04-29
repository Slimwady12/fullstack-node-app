import { useState, useCallback, useMemo, useEffect, FormEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { transaction } from '../../services/db';
import {
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Cpu,
  Brain,
  Sliders,
  Flag,
  RefreshCw,
} from 'lucide-react';

const MASTER_PROMPT_MAX = 20000;

interface AiFormState {
  openaiApiKey: string;
  defaultModel: string;
  masterPrompt: string;
}

interface SuggestionRulesFormState {
  ratingThreshold: number;
  specializationMatchWeight: number;
  onlinePriority: boolean;
  responseTimeWeight: number;
  maxSuggestions: number;
}

interface FeatureFlagsFormState {
  enableChat: boolean;
  enableJobs: boolean;
  enableLawyerSearch: boolean;
}

interface ValidationErrors {
  masterPrompt?: string;
  ratingThreshold?: string;
  specializationMatchWeight?: string;
  responseTimeWeight?: string;
  maxSuggestions?: string;
  weightsSum?: string;
}

export default function SystemConfigPage(): JSX.Element {
  const { t } = useLanguage();
  const { data, loading: syncLoading, error: syncError } = useRealtimeSync();

  const initialAi = useMemo<AiFormState>(() => {
    if (!data?.systemConfig?.ai) {
      return { openaiApiKey: '', defaultModel: 'gpt-5.4-mini', masterPrompt: '' };
    }
    return {
      openaiApiKey: data.systemConfig.ai.openaiApiKey || '',
      defaultModel: 'gpt-5.4-mini',
      masterPrompt: data.systemConfig.ai.masterPrompt || '',
    };
  }, [data]);

  const initialRules = useMemo<SuggestionRulesFormState>(() => {
    if (!data?.systemConfig?.suggestionRules) {
      return { ratingThreshold: 4.0, specializationMatchWeight: 0.5, onlinePriority: true, responseTimeWeight: 0.3, maxSuggestions: 5 };
    }
    return {
      ratingThreshold: data.systemConfig.suggestionRules.ratingThreshold ?? 4.0,
      specializationMatchWeight: data.systemConfig.suggestionRules.specializationMatchWeight ?? 0.5,
      onlinePriority: data.systemConfig.suggestionRules.onlinePriority ?? true,
      responseTimeWeight: data.systemConfig.suggestionRules.responseTimeWeight ?? 0.3,
      maxSuggestions: data.systemConfig.suggestionRules.maxSuggestions ?? 5,
    };
  }, [data]);

  const initialFlags = useMemo<FeatureFlagsFormState>(() => {
    if (!data?.systemConfig?.featureFlags) {
      return { enableChat: true, enableJobs: true, enableLawyerSearch: true };
    }
    return {
      enableChat: data.systemConfig.featureFlags.enableChat ?? true,
      enableJobs: data.systemConfig.featureFlags.enableJobs ?? true,
      enableLawyerSearch: data.systemConfig.featureFlags.enableLawyerSearch ?? true,
    };
  }, [data]);

  const [aiForm, setAiForm] = useState<AiFormState>(initialAi);
  const [rulesForm, setRulesForm] = useState<SuggestionRulesFormState>(initialRules);
  const [flagsForm, setFlagsForm] = useState<FeatureFlagsFormState>(initialFlags);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetStatus, setResetStatus] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    setAiForm(initialAi);
    setRulesForm(initialRules);
    setFlagsForm(initialFlags);
  }, [initialAi, initialRules, initialFlags]);

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  useEffect(() => {
    if (resetStatus) {
      const timer = setTimeout(() => setResetStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [resetStatus]);

  const hasChanges = useMemo(() => {
    if (!data?.systemConfig) return false;
    return (
      aiForm.openaiApiKey !== (data.systemConfig.ai?.openaiApiKey || '') ||
      aiForm.masterPrompt !== (data.systemConfig.ai?.masterPrompt || '') ||
      rulesForm.ratingThreshold !== (data.systemConfig.suggestionRules?.ratingThreshold ?? 4.0) ||
      rulesForm.specializationMatchWeight !== (data.systemConfig.suggestionRules?.specializationMatchWeight ?? 0.5) ||
      rulesForm.onlinePriority !== (data.systemConfig.suggestionRules?.onlinePriority ?? true) ||
      rulesForm.responseTimeWeight !== (data.systemConfig.suggestionRules?.responseTimeWeight ?? 0.3) ||
      rulesForm.maxSuggestions !== (data.systemConfig.suggestionRules?.maxSuggestions ?? 5) ||
      flagsForm.enableChat !== (data.systemConfig.featureFlags?.enableChat ?? true) ||
      flagsForm.enableJobs !== (data.systemConfig.featureFlags?.enableJobs ?? true) ||
      flagsForm.enableLawyerSearch !== (data.systemConfig.featureFlags?.enableLawyerSearch ?? true)
    );
  }, [aiForm, rulesForm, flagsForm, data]);

  const weightsSum = useMemo(() => {
    return Math.round((rulesForm.specializationMatchWeight + rulesForm.responseTimeWeight) * 100) / 100;
  }, [rulesForm]);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!aiForm.masterPrompt.trim()) {
      newErrors.masterPrompt = t('validation.required' as any);
    } else if (aiForm.masterPrompt.length > MASTER_PROMPT_MAX) {
      newErrors.masterPrompt = t('validation.max' as any, { max: MASTER_PROMPT_MAX });
    }

    if (rulesForm.ratingThreshold < 0 || rulesForm.ratingThreshold > 5) {
      newErrors.ratingThreshold = t('validation.format' as any);
    }

    if (rulesForm.specializationMatchWeight < 0 || rulesForm.specializationMatchWeight > 1) {
      newErrors.specializationMatchWeight = t('validation.format' as any);
    }

    if (rulesForm.responseTimeWeight < 0 || rulesForm.responseTimeWeight > 1) {
      newErrors.responseTimeWeight = t('validation.format' as any);
    }

    if (weightsSum > 1.0) {
      newErrors.weightsSum = 'Sum of weights must not exceed 1.0';
    }

    if (rulesForm.maxSuggestions < 1 || rulesForm.maxSuggestions > 10) {
      newErrors.maxSuggestions = t('validation.format' as any);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [aiForm.masterPrompt, rulesForm, weightsSum, t]);

  const handleSave = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setSaveStatus(null);

    try {
      await transaction<void>((db) => {
        db.systemConfig.ai.openaiApiKey = aiForm.openaiApiKey;
        db.systemConfig.ai.masterPrompt = aiForm.masterPrompt;

        db.systemConfig.suggestionRules.ratingThreshold = rulesForm.ratingThreshold;
        db.systemConfig.suggestionRules.specializationMatchWeight = rulesForm.specializationMatchWeight;
        db.systemConfig.suggestionRules.onlinePriority = rulesForm.onlinePriority;
        db.systemConfig.suggestionRules.responseTimeWeight = rulesForm.responseTimeWeight;
        db.systemConfig.suggestionRules.maxSuggestions = rulesForm.maxSuggestions;

        db.systemConfig.featureFlags.enableChat = flagsForm.enableChat;
        db.systemConfig.featureFlags.enableJobs = flagsForm.enableJobs;
        db.systemConfig.featureFlags.enableLawyerSearch = flagsForm.enableLawyerSearch;

        const now = new Date().toISOString();
        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: 'system',
          action: 'SYSTEM_CONFIG_UPDATED',
          details: {
            sections: ['ai', 'suggestionRules', 'featureFlags'],
          },
          timestamp: now,
          activeRole: 'ADMIN',
        });

        return db;
      });

      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [aiForm, rulesForm, flagsForm, validate]);

  const handleResetData = useCallback(async () => {
    setResetting(true);
    setResetStatus(null);

    try {
      await transaction<void>((db) => {
        const clearedCollections = [
          'users',
          'documents',
          'jobs',
          'conversations',
          'disputes',
          'notifications',
          'automations',
          'aiChats',
        ];

        for (const collection of clearedCollections) {
          (db as Record<string, unknown>)[collection] = [];
        }

        const now = new Date().toISOString();
        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: 'system',
          action: 'DATA_RESET',
          details: { clearedCollections },
          timestamp: now,
          activeRole: 'ADMIN',
        });

        return db;
      });

      setResetStatus('success');
      setShowResetModal(false);
    } catch {
      setResetStatus('error');
    } finally {
      setResetting(false);
    }
  }, []);

  const updateAiForm = useCallback((updates: Partial<AiFormState>) => {
    setAiForm(prev => ({ ...prev, ...updates }));
    setErrors(prev => {
      const next = { ...prev };
      if ('masterPrompt' in updates) delete next.masterPrompt;
      return next;
    });
  }, []);

  const updateRulesForm = useCallback((updates: Partial<SuggestionRulesFormState>) => {
    setRulesForm(prev => ({ ...prev, ...updates }));
    setErrors(prev => {
      const next = { ...prev };
      if ('specializationMatchWeight' in updates || 'responseTimeWeight' in updates) {
        delete next.weightsSum;
        delete next.specializationMatchWeight;
        delete next.responseTimeWeight;
      }
      if ('ratingThreshold' in updates) delete next.ratingThreshold;
      if ('maxSuggestions' in updates) delete next.maxSuggestions;
      return next;
    });
  }, []);

  const updateFlagsForm = useCallback((updates: Partial<FeatureFlagsFormState>) => {
    setFlagsForm(prev => ({ ...prev, ...updates }));
  }, []);

  const maskedApiKey = aiForm.openaiApiKey ? `${aiForm.openaiApiKey.slice(0, 4)}${'•'.repeat(Math.max(0, aiForm.openaiApiKey.length - 8))}${aiForm.openaiApiKey.slice(-4)}` : '';

  if (syncLoading && !data) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-6">
            <div className="h-5 bg-navy-800 rounded w-40 mb-4" />
            <div className="h-10 bg-navy-800 rounded mb-3" />
            <div className="h-10 bg-navy-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-medium">{t('errors.loadFailed' as any)}</p>
          <p className="text-red-300/70 text-sm mt-1">{syncError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* Save Status Toast */}
      {saveStatus && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-modal min-h-[52px] ${
            saveStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          role="alert"
        >
          {saveStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">
            {saveStatus === 'success' ? t('common.misc.success' as any) : t('errors.saveFailed' as any)}
          </span>
        </div>
      )}

      {/* Reset Status Toast */}
      {resetStatus && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-modal min-h-[52px] ${
            resetStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          role="alert"
        >
          {resetStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">
            {resetStatus === 'success' ? 'Data reset successfully' : 'Failed to reset data'}
          </span>
        </div>
      )}

      <form onSubmit={handleSave} noValidate>
        {/* OpenAI Configuration */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">{t('superadmin.systemConfig.ai.title' as any)}</h2>
          </div>

          <div className="p-5 space-y-5">
            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.ai.apiKey' as any)}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={aiForm.openaiApiKey}
                    onChange={(e) => updateAiForm({ openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 pr-12 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px]"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => updateAiForm({ openaiApiKey: '' })}
                  className="px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-xl transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Rotate API key"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
              {aiForm.openaiApiKey && !showApiKey && (
                <p className="mt-2 text-xs text-slate-500 font-mono" dir="ltr">{maskedApiKey}</p>
              )}
            </div>

            {/* Default Model - Forced to gpt-5.4-mini */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.ai.defaultModel' as any)}
              </label>
              <div className="px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-emerald-400 text-sm font-mono">
                gpt-5.4-mini (forced)
              </div>
              <p className="text-xs text-slate-500 mt-1">Model is forced to gpt-5.4-mini for all requests</p>
            </div>
          </div>
        </section>

        {/* Master Prompt */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Brain className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">{t('superadmin.systemConfig.ai.masterPrompt' as any)}</h2>
          </div>

          <div className="p-5 space-y-3">
            <textarea
              id="masterPrompt"
              value={aiForm.masterPrompt}
              onChange={(e) => updateAiForm({ masterPrompt: e.target.value })}
              rows={8}
              className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y min-h-[160px] ${
                errors.masterPrompt ? 'border-red-500' : 'border-navy-700'
              }`}
              placeholder="You are a professional legal assistant..."
              aria-invalid={!!errors.masterPrompt}
              aria-describedby={errors.masterPrompt ? 'master-prompt-error' : 'master-prompt-counter'}
              maxLength={MASTER_PROMPT_MAX + 50}
            />
            <div className="flex justify-between items-center">
              {errors.masterPrompt ? (
                <p id="master-prompt-error" className="text-sm text-red-400" role="alert">{errors.masterPrompt}</p>
              ) : (
                <span className="text-xs text-slate-500">
                  {aiForm.masterPrompt.length}/{MASTER_PROMPT_MAX}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Suggestion Rules */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Sliders className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">{t('superadmin.systemConfig.suggestionRules.title' as any)}</h2>
          </div>

          <div className="p-5 space-y-5">
            {/* Rating Threshold */}
            <div>
              <label htmlFor="ratingThreshold" className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.suggestionRules.ratingThreshold' as any)}
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="ratingThreshold"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={5}
                  step={0.1}
                  value={rulesForm.ratingThreshold}
                  onChange={(e) => updateRulesForm({ ratingThreshold: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] ${
                    errors.ratingThreshold ? 'border-red-500' : 'border-navy-700'
                  }`}
                  aria-invalid={!!errors.ratingThreshold}
                />
                <span className="text-sm text-slate-500 flex-shrink-0">/ 5</span>
              </div>
              {errors.ratingThreshold && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.ratingThreshold}</p>
              )}
            </div>

            {/* Specialization Match Weight */}
            <div>
              <label htmlFor="specWeight" className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.suggestionRules.specializationWeight' as any)}
              </label>
              <input
                id="specWeight"
                type="number"
                inputMode="decimal"
                min={0}
                max={1}
                step={0.1}
                value={rulesForm.specializationMatchWeight}
                onChange={(e) => updateRulesForm({ specializationMatchWeight: parseFloat(e.target.value) || 0 })}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] ${
                  errors.specializationMatchWeight || errors.weightsSum ? 'border-red-500' : 'border-navy-700'
                }`}
                aria-invalid={!!(errors.specializationMatchWeight || errors.weightsSum)}
              />
              {errors.specializationMatchWeight && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.specializationMatchWeight}</p>
              )}
            </div>

            {/* Response Time Weight */}
            <div>
              <label htmlFor="responseWeight" className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.suggestionRules.responseTimeWeight' as any)}
              </label>
              <input
                id="responseWeight"
                type="number"
                inputMode="decimal"
                min={0}
                max={1}
                step={0.1}
                value={rulesForm.responseTimeWeight}
                onChange={(e) => updateRulesForm({ responseTimeWeight: parseFloat(e.target.value) || 0 })}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] ${
                  errors.responseTimeWeight || errors.weightsSum ? 'border-red-500' : 'border-navy-700'
                }`}
                aria-invalid={!!(errors.responseTimeWeight || errors.weightsSum)}
              />
              {errors.responseTimeWeight && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.responseTimeWeight}</p>
              )}

              {/* Weights Sum Indicator */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      weightsSum > 1.0 ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(weightsSum * 100, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${weightsSum > 1.0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {weightsSum} / 1.0
                </span>
              </div>
              {errors.weightsSum && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.weightsSum}</p>
              )}
            </div>

            {/* Online Priority */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-300">{t('superadmin.systemConfig.suggestionRules.onlinePriority' as any)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Give priority to online lawyers</p>
              </div>
              <ToggleSwitch
                checked={rulesForm.onlinePriority}
                onChange={(checked) => updateRulesForm({ onlinePriority: checked })}
                ariaLabel={t('superadmin.systemConfig.suggestionRules.onlinePriority' as any)}
              />
            </div>

            {/* Max Suggestions */}
            <div>
              <label htmlFor="maxSuggestions" className="block text-sm font-medium text-slate-300 mb-2">
                {t('superadmin.systemConfig.suggestionRules.maxSuggestions' as any)}
              </label>
              <input
                id="maxSuggestions"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={rulesForm.maxSuggestions}
                onChange={(e) => updateRulesForm({ maxSuggestions: parseInt(e.target.value, 10) || 1 })}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px] ${
                  errors.maxSuggestions ? 'border-red-500' : 'border-navy-700'
                }`}
                aria-invalid={!!errors.maxSuggestions}
              />
              {errors.maxSuggestions && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.maxSuggestions}</p>
              )}
            </div>
          </div>
        </section>

        {/* Feature Flags */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Flag className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">{t('superadmin.systemConfig.featureFlags.title' as any)}</h2>
          </div>

          <div className="divide-y divide-navy-800">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-300">{t('superadmin.systemConfig.featureFlags.enableChat' as any)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable AI chat functionality</p>
              </div>
              <ToggleSwitch
                checked={flagsForm.enableChat}
                onChange={(checked) => updateFlagsForm({ enableChat: checked })}
                ariaLabel={t('superadmin.systemConfig.featureFlags.enableChat' as any)}
              />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-300">{t('superadmin.systemConfig.featureFlags.enableJobs' as any)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable job marketplace</p>
              </div>
              <ToggleSwitch
                checked={flagsForm.enableJobs}
                onChange={(checked) => updateFlagsForm({ enableJobs: checked })}
                ariaLabel={t('superadmin.systemConfig.featureFlags.enableJobs' as any)}
              />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-300">{t('superadmin.systemConfig.featureFlags.enableLawyerSearch' as any)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable lawyer search functionality</p>
              </div>
              <ToggleSwitch
                checked={flagsForm.enableLawyerSearch}
                onChange={(checked) => updateFlagsForm({ enableLawyerSearch: checked })}
                ariaLabel={t('superadmin.systemConfig.featureFlags.enableLawyerSearch' as any)}
              />
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-navy-900 border border-red-500/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-red-400 font-semibold">Danger Zone</h2>
          </div>

          <div className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-300">Reset All Data</p>
                <p className="text-xs text-slate-500 mt-1">Clear users, documents, jobs, conversations, disputes, notifications, and automations. Templates, lawyers, system config, and audit logs will be preserved.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-colors min-h-[48px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-red-500 flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Data</span>
              </button>
            </div>
          </div>
        </section>

        {/* Sticky Save Button */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-navy-900/95 backdrop-blur-sm border-t border-navy-800 p-4 z-10" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500 hidden sm:block">
              {hasChanges ? 'Unsaved changes' : 'No changes'}
            </div>
            <button
              type="submit"
              disabled={!hasChanges || saving || Object.keys(errors).length > 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900"
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('common.actions.save' as any)}</span>
                </>
              ) : (
                <span>{t('common.actions.save' as any)}</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <div className="absolute inset-0 bg-black/70" onClick={() => !resetting && setShowResetModal(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-6 py-5 border-b border-navy-800 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h3 id="reset-modal-title" className="text-lg font-semibold text-white">Confirm Data Reset</h3>
            </div>

            <div className="px-6 py-5">
              <p className="text-slate-300 text-sm">
                This action will permanently delete all data in the following collections:
              </p>
              <ul className="mt-3 space-y-1 text-xs text-red-400 font-mono">
                <li>• users</li>
                <li>• documents</li>
                <li>• jobs</li>
                <li>• conversations</li>
                <li>• disputes</li>
                <li>• notifications</li>
                <li>• automations</li>
                <li>• aiChats</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                The following will be preserved: templates, lawyers, systemConfig, auditLogs.
              </p>
              <p className="mt-2 text-sm text-red-400 font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 bg-navy-800/50 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => !resetting && setShowResetModal(false)}
                disabled={resetting}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('settings.delete.cancel' as any)}
              </button>
              <button
                type="button"
                onClick={handleResetData}
                disabled={resetting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-xl transition-colors min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-busy={resetting}
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Reset All Data</span>
                  </>
                )}
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
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
