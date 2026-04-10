import { useState, useCallback, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { transaction } from '../../services/db';
import axios from 'axios';
import {
  FileText,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Wand2,
  TestTube2,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Upload,
  ExternalLink,
  Eye,
  Shield,
  Brain,
  PenTool,
  Play,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';
type TemplateStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';
type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  validation: string | null;
  pii: boolean;
}

interface FieldQuestion {
  fieldKey: string;
  aiQuestion: string;
  aiHint: string;
  extractionRule: string;
  retryPrompt: string;
  skipCondition: string | null;
}

interface TemplateForm {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  jurisdiction: string;
  status: TemplateStatus;
  version: number;
  pdfFile: string | null;
  fields: TemplateField[];
  aiConfig: {
    model: string;
    language: 'uz' | 'ru' | 'en';
    temperature: number;
    systemPrompt: string;
    conversationStyle: string;
    maxTurns: number;
    fieldQuestions: FieldQuestion[];
    triggerKeywords: string[];
    triggerSignal: string;
  };
  review: {
    requiresLawyerReview: boolean;
    signatureRequired: boolean;
    signatureFields: string[];
  };
}

interface ValidationErrors {
  [key: string]: string;
}

const STEPS = [
  { key: 'basic', label: 'Basic Info', icon: FileText },
  { key: 'fields', label: 'Template & Fields', icon: Shield },
  { key: 'ai', label: 'AI Orchestration', icon: Brain },
  { key: 'review', label: 'Signature & Review', icon: PenTool },
  { key: 'test', label: 'Test Flow', icon: TestTube2 },
];

const RISK_LEVELS: { value: RiskLevel; label: string; color: string }[] = [
  { value: 'GREEN', label: 'Green', color: 'bg-emerald-500' },
  { value: 'YELLOW', label: 'Yellow', color: 'bg-yellow-500' },
  { value: 'RED', label: 'Red', color: 'bg-red-500' },
];

const TEMPLATE_STATUSES: { value: TemplateStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'DISABLED', label: 'Disabled' },
];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Boolean' },
];

const AI_MODEL = 'gpt-5.4-mini';

function createDefaultTemplate(id?: string): TemplateForm {
  const templateId = id || crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id: templateId,
    name: '',
    description: '',
    category: '',
    riskLevel: 'GREEN',
    jurisdiction: 'Uzbekistan',
    status: 'DRAFT',
    version: 1,
    pdfFile: null,
    fields: [],
    aiConfig: {
      model: AI_MODEL,
      language: 'uz',
      temperature: 0.7,
      systemPrompt: '',
      conversationStyle: 'professional',
      maxTurns: 10,
      fieldQuestions: [],
      triggerKeywords: [],
      triggerSignal: `AUTOMATION:${templateId}`,
    },
    review: {
      requiresLawyerReview: false,
      signatureRequired: false,
      signatureFields: [],
    },
  };
}

export default function TemplateBuilderPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading: syncLoading } = useRealtimeSync();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [template, setTemplate] = useState<TemplateForm>(() => createDefaultTemplate(id));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (id && data?.templates) {
      const existing = data.templates.find(t => t.id === id);
      if (existing) {
        setTemplate({
          id: existing.id,
          name: existing.name,
          description: existing.description,
          category: existing.category,
          riskLevel: existing.riskLevel,
          jurisdiction: existing.jurisdiction,
          status: existing.status,
          version: existing.version,
          pdfFile: existing.pdfFile,
          fields: existing.fields,
          aiConfig: { ...existing.aiConfig },
          review: { ...existing.review },
        });
      }
    }
  }, [id, data]);

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const isEditMode = useMemo(() => !!id, [id]);
  const isNewTemplate = useMemo(() => !isEditMode, [isEditMode]);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: ValidationErrors = {};

    if (step === 0) {
      if (!template.name.trim()) newErrors.name = 'Name is required';
      if (!template.description.trim()) newErrors.description = 'Description is required';
      if (!template.category.trim()) newErrors.category = 'Category is required';
      if (!template.jurisdiction.trim()) newErrors.jurisdiction = 'Jurisdiction is required';

      if (data?.templates && template.name.trim()) {
        const duplicate = data.templates.find(
          t => t.name.toLowerCase() === template.name.toLowerCase().trim() && t.id !== template.id
        );
        if (duplicate) newErrors.name = 'Template name must be unique';
      }
    }

    if (step === 2) {
      if (!template.aiConfig.systemPrompt.trim()) newErrors.systemPrompt = 'System prompt is required';
      if (template.aiConfig.temperature < 0 || template.aiConfig.temperature > 2) newErrors.temperature = 'Temperature must be 0-2';
      if (template.aiConfig.maxTurns < 1 || template.aiConfig.maxTurns > 50) newErrors.maxTurns = 'Max turns must be 1-50';

      const signalRegex = /^AUTOMATION:[\w-]+$/;
      if (!signalRegex.test(template.aiConfig.triggerSignal)) {
        newErrors.triggerSignal = 'Must match format: AUTOMATION:{id}';
      }
    }

    for (const field of template.fields) {
      const keyRegex = /^[a-zA-Z0-9_]+$/;
      if (!keyRegex.test(field.key)) {
        newErrors[`field_${field.key}_key`] = 'Key must be alphanumeric or underscore';
      }
      const keyCount = template.fields.filter(f => f.key === field.key).length;
      if (keyCount > 1) {
        newErrors[`field_${field.key}_unique`] = 'Key must be unique';
      }
      if (field.validation) {
        try {
          new RegExp(field.validation);
        } catch {
          newErrors[`field_${field.key}_validation`] = 'Invalid regex';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [template, data]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
      setErrors({});
    }
  }, [currentStep, validateStep]);

  const handlePrev = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setErrors({});
  }, []);

  const handleStepClick = useCallback((index: number) => {
    setCurrentStep(index);
    setErrors({});
  }, []);

  const handleSave = useCallback(async (publish: boolean = false) => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!validateStep(i)) return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      await transaction<void>((db) => {
        const existingIndex = db.templates.findIndex(t => t.id === template.id);
        const now = new Date().toISOString();

        const templateData = {
          ...template,
          version: (existingIndex >= 0 ? db.templates[existingIndex]!.version : 0) + 1,
          status: publish ? 'ACTIVE' : template.status,
          createdAt: existingIndex >= 0 ? db.templates[existingIndex]!.createdAt : now,
          updatedAt: now,
          createdBy: existingIndex >= 0 ? db.templates[existingIndex]!.createdBy : 'admin',
        };

        if (existingIndex >= 0) {
          db.templates[existingIndex] = templateData;
        } else {
          db.templates.push(templateData);
        }

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: 'admin',
          action: isNewTemplate ? 'TEMPLATE_CREATED' : 'TEMPLATE_UPDATED',
          details: {
            templateId: template.id,
            templateName: template.name,
            version: templateData.version,
            status: templateData.status,
            published: publish,
          },
          timestamp: now,
          activeRole: 'ADMIN',
        });

        return db;
      });

      setSaveStatus('success');
      if (!isEditMode) {
        setTimeout(() => navigate('/superadmin/automations'), 1500);
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [template, isNewTemplate, isEditMode, navigate, validateStep]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrors(prev => ({ ...prev, pdfFile: 'Only PDF files are allowed' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, pdfFile: 'File must be less than 5MB' }));
      return;
    }

    setUploading(true);
    setErrors(prev => {
      const next = { ...prev };
      delete next.pdfFile;
      return next;
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setTemplate(prev => ({ ...prev, pdfFile: response.data.data.filename }));
      }
    } catch {
      setErrors(prev => ({ ...prev, pdfFile: 'Upload failed' }));
    } finally {
      setUploading(false);
    }
  }, []);

  const addField = useCallback(() => {
    const key = `field_${template.fields.length + 1}`;
    setTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, { key, label: '', type: 'text' as FieldType, required: false, validation: null, pii: false }],
      aiConfig: {
        ...prev.aiConfig,
        fieldQuestions: [...prev.aiConfig.fieldQuestions, {
          fieldKey: key,
          aiQuestion: '',
          aiHint: '',
          extractionRule: '',
          retryPrompt: 'Please provide the information again.',
          skipCondition: null,
        }],
      },
    }));
    setExpandedQuestion(key);
  }, [template.fields.length]);

  const removeField = useCallback((key: string) => {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.key !== key),
      aiConfig: {
        ...prev.aiConfig,
        fieldQuestions: prev.aiConfig.fieldQuestions.filter(fq => fq.fieldKey !== key),
      },
    }));
    if (expandedQuestion === key) setExpandedQuestion(null);
  }, [expandedQuestion]);

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    setTemplate(prev => {
      const newFields = [...prev.fields];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newFields.length) return prev;
      [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];

      const newFq = [...prev.aiConfig.fieldQuestions];
      const fqIndex = direction === 'up' ? index - 1 : index + 1;
      if (fqIndex >= 0 && fqIndex < newFq.length) {
        [newFq[index], newFq[fqIndex]] = [newFq[fqIndex], newFq[index]];
      }

      return { ...prev, fields: newFields, aiConfig: { ...prev.aiConfig, fieldQuestions: newFq } };
    });
  }, []);

  const updateField = useCallback((key: string, updates: Partial<TemplateField>) => {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.key === key ? { ...f, ...updates } : f),
    }));
    if (updates.key && expandedQuestion === key) {
      setTemplate(prev => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          fieldQuestions: prev.aiConfig.fieldQuestions.map(fq =>
            fq.fieldKey === key ? { ...fq, fieldKey: updates.key! } : fq
          ),
        },
      }));
      setExpandedQuestion(updates.key || null);
    }
  }, [expandedQuestion]);

  const updateFieldQuestion = useCallback((fieldKey: string, updates: Partial<FieldQuestion>) => {
    setTemplate(prev => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        fieldQuestions: prev.aiConfig.fieldQuestions.map(fq =>
          fq.fieldKey === fieldKey ? { ...fq, ...updates } : fq
        ),
      },
    }));
  }, []);

  const addKeyword = useCallback(() => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !template.aiConfig.triggerKeywords.includes(kw)) {
      setTemplate(prev => ({
        ...prev,
        aiConfig: { ...prev.aiConfig, triggerKeywords: [...prev.aiConfig.triggerKeywords, kw] },
      }));
    }
    setNewKeyword('');
  }, [newKeyword, template.aiConfig.triggerKeywords]);

  const removeKeyword = useCallback((kw: string) => {
    setTemplate(prev => ({
      ...prev,
      aiConfig: { ...prev.aiConfig, triggerKeywords: prev.aiConfig.triggerKeywords.filter(k => k !== kw) },
    }));
  }, []);

  const toggleSignatureField = useCallback((key: string) => {
    setTemplate(prev => {
      const fields = prev.review.signatureFields.includes(key)
        ? prev.review.signatureFields.filter(f => f !== key)
        : [...prev.review.signatureFields, key];
      return { ...prev, review: { ...prev.review, signatureFields: fields } };
    });
  }, []);

  const generateAiQuestion = useCallback(async (fieldKey: string) => {
    const field = template.fields.find(f => f.key === fieldKey);
    if (!field) return;

    setAiGenerating(fieldKey);

    try {
      const response = await axios.post('/api/middleman/chat', {
        userId: 'admin',
        templateId: template.id,
        message: `Generate an AI question, hint, and extraction rule for a field called "${field.label || fieldKey}" of type "${field.type}". Return JSON: {"aiQuestion": "...", "aiHint": "...", "extractionRule": "..."}`,
        sessionId: null,
      });

      if (response.data.success && response.data.data.message) {
        const match = response.data.data.message.match(/\{[\s\S]*"aiQuestion"[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            updateFieldQuestion(fieldKey, {
              aiQuestion: parsed.aiQuestion || `What is the ${field.label || fieldKey}?`,
              aiHint: parsed.aiHint || `Extract the ${field.label || fieldKey} from the response`,
              extractionRule: parsed.extractionRule || `"${fieldKey}":\\s*"([^"]*)"`,
            });
          } catch {
            updateFieldQuestion(fieldKey, {
              aiQuestion: `What is the ${field.label || fieldKey}?`,
              aiHint: `Extract the ${field.label || fieldKey}`,
              extractionRule: `"${fieldKey}":\\s*"([^"]*)"`,
            });
          }
        }
      }
    } catch {
      updateFieldQuestion(fieldKey, {
        aiQuestion: `What is the ${field.label || fieldKey}?`,
        aiHint: `Extract the ${field.label || fieldKey}`,
        extractionRule: `"${fieldKey}":\\s*"([^"]*)"`,
      });
    } finally {
      setAiGenerating(null);
    }
  }, [template.fields, template.id, updateFieldQuestion]);

  if (syncLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/superadmin/automations')}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {isEditMode ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isEditMode ? `Version ${template.version}` : 'New template'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Save failed</span>
            </div>
          )}
        </div>
      </div>

      {/* Stepper */}
      <nav className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="Template builder steps">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => handleStepClick(index)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl min-h-[48px] whitespace-nowrap transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isActive
                  ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30'
                  : isCompleted
                    ? 'bg-navy-800 text-slate-400 border border-navy-700'
                    : 'bg-navy-900 text-slate-600 border border-navy-800'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-600 ml-1 hidden md:inline" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Step Content */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        {/* Section 1: Basic Info */}
        {currentStep === 0 && (
          <div className="p-5 space-y-5">
            <h2 className="text-lg font-semibold text-white">Basic Information</h2>

            <div>
              <label htmlFor="tpl-name" className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
              <input
                id="tpl-name"
                type="text"
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.name ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="e.g., Employment Contract"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="mt-1 text-sm text-red-400" role="alert">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="tpl-desc" className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
              <textarea
                id="tpl-desc"
                value={template.description}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[100px] ${errors.description ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="Describe this template..."
                aria-invalid={!!errors.description}
              />
              {errors.description && <p className="mt-1 text-sm text-red-400" role="alert">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tpl-category" className="block text-sm font-medium text-slate-300 mb-2">Category *</label>
                <input
                  id="tpl-category"
                  type="text"
                  value={template.category}
                  onChange={(e) => setTemplate(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.category ? 'border-red-500' : 'border-navy-700'}`}
                  placeholder="e.g., Employment"
                  aria-invalid={!!errors.category}
                />
                {errors.category && <p className="mt-1 text-sm text-red-400" role="alert">{errors.category}</p>}
              </div>

              <div>
                <label htmlFor="tpl-jurisdiction" className="block text-sm font-medium text-slate-300 mb-2">Jurisdiction *</label>
                <input
                  id="tpl-jurisdiction"
                  type="text"
                  value={template.jurisdiction}
                  onChange={(e) => setTemplate(prev => ({ ...prev, jurisdiction: e.target.value }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.jurisdiction ? 'border-red-500' : 'border-navy-700'}`}
                  placeholder="e.g., Uzbekistan"
                  aria-invalid={!!errors.jurisdiction}
                />
                {errors.jurisdiction && <p className="mt-1 text-sm text-red-400" role="alert">{errors.jurisdiction}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Risk Level</label>
              <div className="flex gap-3">
                {RISK_LEVELS.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, riskLevel: level.value }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border min-h-[48px] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      template.riskLevel === level.value
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-navy-700 bg-navy-800 text-slate-400 hover:border-navy-600'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${level.color}`} />
                    <span className="text-sm font-medium">{level.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="tpl-status" className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                id="tpl-status"
                value={template.status}
                onChange={(e) => setTemplate(prev => ({ ...prev, status: e.target.value as TemplateStatus }))}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
              >
                {TEMPLATE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Section 2: Template & Fields */}
        {currentStep === 1 && (
          <div className="p-5 space-y-6">
            <h2 className="text-lg font-semibold text-white">Template & Fields</h2>

            {/* PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">PDF Template</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 border border-navy-700 border-dashed rounded-xl cursor-pointer min-h-[48px] transition-colors focus-within:ring-2 focus-within:ring-emerald-500">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm text-slate-300">{uploading ? 'Uploading...' : 'Upload PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                    aria-label="Upload PDF template"
                  />
                </label>
                {template.pdfFile && (
                  <a
                    href={`/uploads/${template.pdfFile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 rounded-xl text-emerald-400 text-sm min-h-[48px] min-w-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </a>
                )}
              </div>
              {errors.pdfFile && <p className="mt-1 text-sm text-red-400" role="alert">{errors.pdfFile}</p>}
              {uploading && <p className="mt-1 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</p>}
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">Fields</h3>
                <button
                  type="button"
                  onClick={addField}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Field</span>
                </button>
              </div>

              {template.fields.length === 0 ? (
                <div className="text-center py-8 bg-navy-800/50 rounded-xl">
                  <p className="text-slate-500 text-sm">No fields added yet</p>
                  <button
                    type="button"
                    onClick={addField}
                    className="mt-3 px-4 py-2 bg-emerald-600/10 text-emerald-400 rounded-lg text-sm min-h-[44px] hover:bg-emerald-600/20 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Add your first field
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {template.fields.map((field, index) => (
                    <div key={field.key} className="bg-navy-800 rounded-xl p-4 border border-navy-700">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            aria-label="Move field up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(index, 'down')}
                            disabled={index === template.fields.length - 1}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            aria-label="Move field down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(field.key)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Remove field ${field.key}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Key *</label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(field.key, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                            className={`w-full px-3 py-2.5 bg-navy-900 border rounded-lg text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] ${errors[`field_${field.key}_key`] || errors[`field_${field.key}_unique`] ? 'border-red-500' : 'border-navy-700'}`}
                            placeholder="field_name"
                          />
                          {(errors[`field_${field.key}_key`] || errors[`field_${field.key}_unique`]) && (
                            <p className="mt-1 text-xs text-red-400">{errors[`field_${field.key}_key`] || errors[`field_${field.key}_unique`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.key, { label: e.target.value })}
                            className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                            placeholder="Display label"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(field.key, { type: e.target.value as FieldType })}
                            className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                          >
                            {FIELD_TYPES.map(ft => (
                              <option key={ft.value} value={ft.value}>{ft.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 py-2.5 min-h-[44px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(field.key, { required: e.target.checked })}
                              className="w-4 h-4 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-300">Required</span>
                          </label>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 py-2.5 min-h-[44px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.pii}
                              onChange={(e) => updateField(field.key, { pii: e.target.checked })}
                              className="w-4 h-4 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-300">PII</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Validation Regex</label>
                          <input
                            type="text"
                            value={field.validation || ''}
                            onChange={(e) => updateField(field.key, { validation: e.target.value || null })}
                            className={`w-full px-3 py-2.5 bg-navy-900 border rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] ${errors[`field_${field.key}_validation`] ? 'border-red-500' : 'border-navy-700'}`}
                            placeholder="^[0-9]+$"
                          />
                          {errors[`field_${field.key}_validation`] && (
                            <p className="mt-1 text-xs text-red-400">{errors[`field_${field.key}_validation`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: AI Orchestration */}
        {currentStep === 2 && (
          <div className="p-5 space-y-6">
            <h2 className="text-lg font-semibold text-white">AI Orchestration</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="ai-model" className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                <select
                  id="ai-model"
                  value={template.aiConfig.model}
                  onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, model: e.target.value } }))}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  disabled
                >
                  <option value="gpt-5.4-mini">gpt-5.4-mini (forced)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Model is forced to gpt-5.4-mini</p>
              </div>
              <div>
                <label htmlFor="ai-language" className="block text-sm font-medium text-slate-300 mb-2">Language</label>
                <select
                  id="ai-language"
                  value={template.aiConfig.language}
                  onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, language: e.target.value as 'uz' | 'ru' | 'en' } }))}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                >
                  <option value="uz">O'zbekcha</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label htmlFor="ai-temp" className="block text-sm font-medium text-slate-300 mb-2">Temperature</label>
                <input
                  id="ai-temp"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={template.aiConfig.temperature}
                  onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, temperature: parseFloat(e.target.value) || 0.7 } }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.temperature ? 'border-red-500' : 'border-navy-700'}`}
                />
                {errors.temperature && <p className="mt-1 text-sm text-red-400">{errors.temperature}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="ai-system-prompt" className="block text-sm font-medium text-slate-300 mb-2">System Prompt *</label>
              <textarea
                id="ai-system-prompt"
                value={template.aiConfig.systemPrompt}
                onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, systemPrompt: e.target.value } }))}
                rows={4}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[120px] ${errors.systemPrompt ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="You are an AI assistant that helps fill out this template..."
                aria-invalid={!!errors.systemPrompt}
              />
              {errors.systemPrompt && <p className="mt-1 text-sm text-red-400">{errors.systemPrompt}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ai-style" className="block text-sm font-medium text-slate-300 mb-2">Conversation Style</label>
                <input
                  id="ai-style"
                  type="text"
                  value={template.aiConfig.conversationStyle}
                  onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, conversationStyle: e.target.value } }))}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder="professional, friendly, formal..."
                />
              </div>
              <div>
                <label htmlFor="ai-max-turns" className="block text-sm font-medium text-slate-300 mb-2">Max Turns</label>
                <input
                  id="ai-max-turns"
                  type="number"
                  min={1}
                  max={50}
                  value={template.aiConfig.maxTurns}
                  onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, maxTurns: parseInt(e.target.value, 10) || 10 } }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.maxTurns ? 'border-red-500' : 'border-navy-700'}`}
                />
                {errors.maxTurns && <p className="mt-1 text-sm text-red-400">{errors.maxTurns}</p>}
              </div>
            </div>

            {/* Field Questions */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Field Questions</h3>
              {template.fields.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6 bg-navy-800/50 rounded-xl">Add fields in the previous step first</p>
              ) : (
                <div className="space-y-2">
                  {template.fields.map(field => {
                    const fq = template.aiConfig.fieldQuestions.find(q => q.fieldKey === field.key);
                    const isExpanded = expandedQuestion === field.key;

                    return (
                      <div key={field.key} className="border border-navy-700 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedQuestion(isExpanded ? null : field.key)}
                          className="w-full flex items-center justify-between px-4 py-3.5 bg-navy-800 hover:bg-navy-750 min-h-[52px] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white truncate">{field.label || field.key}</span>
                            <span className="text-xs text-slate-500 font-mono">{field.key}</span>
                          </div>
                          {fq?.aiQuestion && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        </button>

                        {isExpanded && fq && (
                          <div className="p-4 space-y-4 bg-navy-900 border-t border-navy-700">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">AI Question</label>
                              <input
                                type="text"
                                value={fq.aiQuestion}
                                onChange={(e) => updateFieldQuestion(field.key, { aiQuestion: e.target.value })}
                                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                                placeholder="What question should the AI ask?"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">AI Hint</label>
                              <input
                                type="text"
                                value={fq.aiHint}
                                onChange={(e) => updateFieldQuestion(field.key, { aiHint: e.target.value })}
                                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                                placeholder="Extraction hint for the AI"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Extraction Rule (Regex)</label>
                              <input
                                type="text"
                                value={fq.extractionRule}
                                onChange={(e) => updateFieldQuestion(field.key, { extractionRule: e.target.value })}
                                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                                placeholder='"fieldKey":\s*"([^"]*)"'
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Retry Prompt</label>
                              <input
                                type="text"
                                value={fq.retryPrompt}
                                onChange={(e) => updateFieldQuestion(field.key, { retryPrompt: e.target.value })}
                                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                                placeholder="Message when validation fails"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Skip Condition</label>
                              <input
                                type="text"
                                value={fq.skipCondition || ''}
                                onChange={(e) => updateFieldQuestion(field.key, { skipCondition: e.target.value || null })}
                                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                                placeholder="Condition to skip this field"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => generateAiQuestion(field.key)}
                              disabled={aiGenerating === field.key}
                              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 disabled:opacity-50 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {aiGenerating === field.key ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Wand2 className="w-4 h-4" />
                              )}
                              <span>Auto-generate</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Triggers */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Trigger Keywords</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {template.aiConfig.triggerKeywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 text-slate-300 text-sm rounded-lg border border-navy-700">
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Remove keyword ${kw}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value.toLowerCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder="Add keyword..."
                  aria-label="New trigger keyword"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  disabled={!newKeyword.trim()}
                  className="px-4 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 disabled:opacity-50 text-emerald-400 rounded-xl text-sm min-h-[48px] min-w-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="trigger-signal" className="block text-sm font-medium text-slate-300 mb-2">Trigger Signal *</label>
              <input
                id="trigger-signal"
                type="text"
                value={template.aiConfig.triggerSignal}
                onChange={(e) => setTemplate(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, triggerSignal: e.target.value } }))}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.triggerSignal ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="AUTOMATION:template-id"
                aria-invalid={!!errors.triggerSignal}
              />
              {errors.triggerSignal && <p className="mt-1 text-sm text-red-400">{errors.triggerSignal}</p>}
            </div>
          </div>
        )}

        {/* Section 4: Signature & Review */}
        {currentStep === 3 && (
          <div className="p-5 space-y-6">
            <h2 className="text-lg font-semibold text-white">Signature & Review</h2>

            <div className="flex items-center justify-between py-4 px-4 bg-navy-800 rounded-xl">
              <div>
                <p className="text-sm font-medium text-white">Requires Lawyer Review</p>
                <p className="text-xs text-slate-500 mt-0.5">Documents will be sent for lawyer review before finalization</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={template.review.requiresLawyerReview}
                onClick={() => setTemplate(prev => ({ ...prev, review: { ...prev.review, requiresLawyerReview: !prev.review.requiresLawyerReview } }))}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 min-w-[48px] min-h-[44px] flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 ${
                  template.review.requiresLawyerReview ? 'bg-emerald-600' : 'bg-navy-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${template.review.requiresLawyerReview ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-4 px-4 bg-navy-800 rounded-xl">
              <div>
                <p className="text-sm font-medium text-white">Signature Required</p>
                <p className="text-xs text-slate-500 mt-0.5">User must sign the document to finalize it</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={template.review.signatureRequired}
                onClick={() => setTemplate(prev => ({ ...prev, review: { ...prev.review, signatureRequired: !prev.review.signatureRequired } }))}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 min-w-[48px] min-h-[44px] flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900 ${
                  template.review.signatureRequired ? 'bg-emerald-600' : 'bg-navy-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${template.review.signatureRequired ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {template.review.signatureRequired && template.fields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Signature Fields</label>
                <div className="space-y-2">
                  {template.fields.map(field => (
                    <label key={field.key} className="flex items-center gap-3 px-4 py-3 bg-navy-800 rounded-xl min-h-[48px] cursor-pointer hover:bg-navy-750 transition-colors">
                      <input
                        type="checkbox"
                        checked={template.review.signatureFields.includes(field.key)}
                        onChange={() => toggleSignatureField(field.key)}
                        className="w-4 h-4 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-300">{field.label || field.key}</span>
                      <span className="text-xs text-slate-500 font-mono ml-auto">({field.key})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 5: Test Flow */}
        {currentStep === 4 && (
          <div className="p-5 space-y-6">
            <h2 className="text-lg font-semibold text-white">Test AI Flow</h2>

            <div className="text-center py-8 bg-navy-800/50 rounded-xl">
              <TestTube2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-sm mb-2">Test the AI orchestration flow for this template</p>
              <p className="text-slate-500 text-xs mb-6">Send a test message to verify extraction, validation, and suggestion logic</p>
              <button
                type="button"
                onClick={() => setTestModalOpen(true)}
                disabled={template.fields.length === 0}
                className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all min-h-[48px] mx-auto focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Play className="w-5 h-5" />
                <span>Start Test Flow</span>
              </button>
              {template.fields.length === 0 && (
                <p className="mt-3 text-xs text-slate-500">Add fields first to enable testing</p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="px-5 py-4 border-t border-navy-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Publish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Test Modal */}
      {testModalOpen && (
        <TestFlowModal
          template={template}
          onClose={() => setTestModalOpen(false)}
        />
      )}
    </div>
  );
}

interface TestFlowModalProps {
  template: TemplateForm;
  onClose: () => void;
}

function TestFlowModal({ template, onClose }: TestFlowModalProps): JSX.Element {
  const { t } = useLanguage();
  const [message, setMessage] = useState<string>('');
  const [conversation, setConversation] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [state, setState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');

  const handleSend = useCallback(async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    const userMsg = message.trim();
    setConversation(prev => [...prev, { role: 'user', content: userMsg }]);
    setMessage('');

    try {
      const response = await axios.post('/api/middleman/chat', {
        userId: 'admin',
        templateId: template.id,
        message: userMsg,
        sessionId: null,
      });

      if (response.data.success) {
        const data = response.data.data;
        setConversation(prev => [...prev, { role: 'ai', content: data.message }]);
        if (data.state) {
          setExtracted(data.state.extracted || {});
        }
        if (data.action === 'complete') {
          setState('complete');
        }
      }
    } catch {
      setConversation(prev => [...prev, { role: 'ai', content: 'Error: Failed to get response from AI.' }]);
      setState('error');
    } finally {
      setLoading(false);
    }
  }, [message, loading, template.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full sm:h-auto sm:max-h-[80vh] bg-navy-900 border border-navy-800 rounded-2xl shadow-modal flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-800">
          <h3 className="text-lg font-semibold text-white">Test Flow: {template.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Close test modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col border-b sm:border-b-0 sm:border-r border-navy-800">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversation.length === 0 && (
                <div className="text-center py-12">
                  <Brain className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Send a test message to start the flow</p>
                </div>
              )}
              {conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2.5 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-navy-800 text-slate-300'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-navy-800 px-4 py-2.5 rounded-xl flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span className="text-sm text-slate-400">Processing...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-navy-800 flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                placeholder="Type a test message..."
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>

          {/* Extraction Panel */}
          <div className="w-full sm:w-72 bg-navy-800/50 p-4 overflow-y-auto">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Extracted Fields</h4>
            {Object.keys(extracted).length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No fields extracted yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(extracted).map(([key, value]) => (
                  <div key={key} className="bg-navy-900 rounded-lg p-3 border border-navy-700">
                    <p className="text-xs font-mono text-emerald-400 mb-1">{key}</p>
                    <p className="text-sm text-white truncate">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {state === 'complete' && (
              <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>All fields extracted</span>
              </div>
            )}
            {state === 'error' && (
              <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Error occurred</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
