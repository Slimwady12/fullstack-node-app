import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import axios from 'axios';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Shield,
  FileText,
  Edit3,
  AlertCircle,
} from 'lucide-react';

interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  validation: string | null;
  pii: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  status: string;
  version: number;
  fields: TemplateField[];
}

const DRAFT_STORAGE_KEY = 'doc_wizard_draft';

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactElement; message: string }> = {
  GREEN: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    message: 'Low risk - Standard template with minimal legal implications.',
  },
  YELLOW: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    message: 'Medium risk - Review recommended before signing.',
  },
  RED: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: <XCircle className="w-5 h-5 text-red-400" />,
    message: 'High risk - Lawyer review strongly recommended.',
  },
};

export default function WizardPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data, loading } = useRealtimeSync();

  const templateId = searchParams.get('templateId');

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [formData, setFormData] = useState<Record<string, string | number | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState<boolean>(false);
  const [draftSaved, setDraftSaved] = useState<boolean>(false);

  const template = useMemo((): Template | null => {
    if (!data?.templates || !templateId) return null;
    const tpl = data.templates.find(t => t.id === templateId);
    if (!tpl || tpl.status !== 'ACTIVE') return null;
    return tpl as Template;
  }, [data, templateId]);

  useEffect(() => {
    if (!loading && !template && templateId) {
      navigate('/user/documents', { replace: true });
    }
  }, [loading, template, templateId, navigate]);

  useEffect(() => {
    if (template) {
      const savedDraft = localStorage.getItem(`${DRAFT_STORAGE_KEY}_${template.id}`);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed);
        } catch {
          // ignore
        }
      }
    }
  }, [template]);

  useEffect(() => {
    if (template && Object.keys(formData).length > 0) {
      const saveTimer = setTimeout(() => {
        localStorage.setItem(`${DRAFT_STORAGE_KEY}_${template.id}`, JSON.stringify(formData));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      }, 1000);
      return () => clearTimeout(saveTimer);
    }
  }, [formData, template]);

  const totalSteps = useMemo(() => {
    if (!template) return 0;
    const fieldsPerStep = 3;
    return 2 + Math.ceil(template.fields.length / fieldsPerStep);
  }, [template]);

  const progress = useMemo(() => {
    if (!template) return 0;
    return Math.round((currentStep / (totalSteps - 1)) * 100);
  }, [currentStep, totalSteps]);

  const currentFields = useMemo((): TemplateField[] => {
    if (!template) return [];
    const fieldsPerStep = 3;
    const stepIndex = currentStep - 1;
    const start = stepIndex * fieldsPerStep;
    return template.fields.slice(start, start + fieldsPerStep);
  }, [template, currentStep]);

  const validateField = useCallback((field: TemplateField, value: string | number | boolean): string | null => {
    if (field.required && (value === undefined || value === null || value === '')) {
      return 'This field is required';
    }

    if (value === '' && !field.required) return null;

    switch (field.type) {
      case 'number':
        if (typeof value === 'string' && isNaN(Number(value))) {
          return 'Must be a number';
        }
        break;
      case 'date':
        if (typeof value === 'string' && value && isNaN(new Date(value).getTime())) {
          return 'Must be a valid date (YYYY-MM-DD)';
        }
        break;
      case 'boolean':
        break;
      default:
        if (typeof value === 'string' && value.length > 0) {
          break;
        }
    }

    if (field.validation && typeof value === 'string' && value) {
      try {
        const regex = new RegExp(field.validation);
        if (!regex.test(value)) {
          return `Does not match required pattern: ${field.validation}`;
        }
      } catch {
        return 'Invalid validation pattern';
      }
    }

    return null;
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    if (currentStep === 0 || currentStep === totalSteps - 1) return true;

    const newErrors: Record<string, string> = {};
    let hasError = false;

    for (const field of currentFields) {
      const value = formData[field.key];
      const error = validateField(field, value ?? '');
      if (error) {
        newErrors[field.key] = error;
        hasError = true;
      }
    }

    setErrors(newErrors);
    return !hasError;
  }, [currentStep, totalSteps, currentFields, formData, validateField]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      if (validateCurrentStep()) {
        setCurrentStep(prev => prev + 1);
        setErrors({});
      }
    }
  }, [currentStep, totalSteps, validateCurrentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setErrors({});
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    if (!template || !user) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const allErrors: Record<string, string> = {};
    let hasError = false;

    for (const field of template.fields) {
      if (field.required) {
        const value = formData[field.key];
        if (value === undefined || value === null || value === '') {
          allErrors[field.key] = 'This field is required';
          hasError = true;
        }
      }
    }

    if (hasError) {
      setErrors(allErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiClient.post('/api/documents', {
        templateId: template.id,
        userId: user.userId,
        fields: formData,
        templateVersion: template.version,
      });

      if (response.data.success) {
        localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${template.id}`);
        navigate(`/user/documents/${response.data.data.documentId}`, { replace: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setSubmitError(axiosErr.response?.data?.error || axiosErr.response?.data?.message || 'Failed to create document');
    } finally {
      setIsSubmitting(false);
    }
  }, [template, user, formData, navigate]);

  const handleCancel = useCallback(() => {
    if (template) {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${template.id}`);
    }
    navigate('/user/documents', { replace: true });
  }, [template, navigate]);

  const handleFieldChange = useCallback((key: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleEditFromPreview = useCallback((fieldKey: string, stepIndex: number) => {
    setCurrentStep(stepIndex + 1);
    setErrors({});
    setTimeout(() => {
      const el = document.getElementById(`field-${fieldKey}`);
      el?.focus();
    }, 100);
  }, []);

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const riskConfig = RISK_CONFIG[template.riskLevel] || RISK_CONFIG.GREEN;
  const isIntroStep = currentStep === 0;
  const isPreviewStep = currentStep === totalSteps - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Cancel"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{template.name}</h1>
            <p className="text-xs text-slate-500">v{template.version} • {template.category}</p>
          </div>
        </div>
        {draftSaved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Draft saved
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 text-right">Step {currentStep + 1} of {totalSteps}</p>

      {/* Risk Banner */}
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${riskConfig.bg} ${riskConfig.border}`}>
        {riskConfig.icon}
        <div>
          <p className={`text-sm font-medium ${riskConfig.color}`}>
            {template.riskLevel} Risk Level
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{riskConfig.message}</p>
          <p className="text-xs text-slate-500 mt-1">AI-generated content. Professional review recommended.</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        {/* Intro Step */}
        {isIntroStep && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">About this template</h2>
                <p className="text-xs text-slate-500">{template.category} • {template.jurisdiction || 'Uzbekistan'}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{template.description}</p>

            <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
              <h3 className="text-sm font-medium text-white mb-2">What to expect</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>You will be asked {template.fields.length} questions to fill out the document</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Your progress is auto-saved as draft</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Your data is stored securely</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <span>Start Filling</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Field Steps */}
        {!isIntroStep && !isPreviewStep && (
          <div className="p-5 space-y-5">
            <h2 className="text-lg font-semibold text-white">
              {currentStep > 1 && currentStep < totalSteps - 1
                ? `Fields (${Math.min((currentStep - 1) * 3 + 1, template.fields.length)}-${Math.min(currentStep * 3, template.fields.length)} of ${template.fields.length})`
                : 'Fields'}
            </h2>

            {currentFields.map(field => (
              <div key={field.key} className="space-y-2">
                <label htmlFor={`field-${field.key}`} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>{field.label}</span>
                  {field.required && <span className="text-red-400">*</span>}
                  {field.pii && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] rounded font-medium">PII</span>
                  )}
                </label>

                {field.type === 'text' && (
                  <input
                    id={`field-${field.key}`}
                    type="text"
                    value={(formData[field.key] as string) || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors[field.key] ? 'border-red-500' : 'border-navy-700'}`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    aria-invalid={!!errors[field.key]}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    id={`field-${field.key}`}
                    type="number"
                    inputMode="numeric"
                    value={(formData[field.key] as string | number) || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors[field.key] ? 'border-red-500' : 'border-navy-700'}`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    aria-invalid={!!errors[field.key]}
                  />
                )}

                {field.type === 'date' && (
                  <input
                    id={`field-${field.key}`}
                    type="date"
                    value={(formData[field.key] as string) || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors[field.key] ? 'border-red-500' : 'border-navy-700'}`}
                    aria-invalid={!!errors[field.key]}
                  />
                )}

                {field.type === 'boolean' && (
                  <button
                    id={`field-${field.key}`}
                    type="button"
                    role="switch"
                    aria-checked={!!formData[field.key]}
                    onClick={() => handleFieldChange(field.key, !formData[field.key])}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 min-w-[48px] min-h-[44px] flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 ${
                      formData[field.key] ? 'bg-emerald-600' : 'bg-navy-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData[field.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                )}

                {errors[field.key] && (
                  <p className="text-sm text-red-400 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preview Step */}
        {isPreviewStep && (
          <div className="p-5 space-y-5">
            <h2 className="text-lg font-semibold text-white">Review & Submit</h2>

            <div className="space-y-3">
              {template.fields.map((field, index) => {
                const fieldStepIndex = Math.floor(index / 3) + 1;
                const value = formData[field.key];
                const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—');

                return (
                  <div key={field.key} className="flex items-start justify-between gap-3 px-4 py-3 bg-navy-800 rounded-lg border border-navy-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">{field.label}</p>
                      <p className={`text-sm ${value ? 'text-white' : 'text-slate-500'} truncate`}>
                        {field.pii && value ? '••••••••' : displayValue}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEditFromPreview(field.key, fieldStepIndex)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Edit ${field.label}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}

            <label className="flex items-start gap-3 py-2 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-navy-700 bg-navy-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">
                I confirm the information above is correct and I want to create this document.
              </span>
            </label>
          </div>
        )}

        {/* Navigation Buttons */}
        {!isIntroStep && (
          <div className="px-5 py-4 border-t border-navy-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrev}
              className="flex items-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {isPreviewStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !confirmChecked}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Submit Document</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
