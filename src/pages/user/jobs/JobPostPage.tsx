import { useState, useCallback, FormEvent, ChangeEvent } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useAuth } from '../../../hooks/useAuth';
import { transaction } from '../../../services/db';
import axios from 'axios';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  X,
  FileText,
  FileImage,
  File,
} from 'lucide-react';

interface AttachmentPreview {
  filename: string;
  url: string;
  type: string;
}

interface ValidationErrors {
  title?: string;
  category?: string;
  description?: string;
  budget?: string;
  urgency?: string;
}

const CATEGORIES = [
  'Contract Law',
  'Employment Law',
  'Real Estate',
  'Family Law',
  'Criminal Defense',
  'Tax Law',
  'Business Registration',
  'Dispute Resolution',
  'Immigration',
  'Other',
];

export default function JobPostPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [urgency, setUrgency] = useState<string>('MEDIUM');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!title.trim() || title.trim().length < 3) {
      newErrors.title = t('validation.min' as any, { min: 3 });
    }

    if (!category) {
      newErrors.category = t('validation.select' as any);
    }

    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = t('validation.min' as any, { min: 10 });
    }

    const budgetNum = parseFloat(budget);
    if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
      newErrors.budget = t('validation.positive' as any);
    }

    if (!urgency) {
      newErrors.urgency = t('validation.select' as any);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, category, description, budget, urgency, t]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({ ...prev, _attachments: 'File must be less than 5MB' }));
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data.success) {
          setAttachments(prev => [...prev, {
            filename: response.data.data.filename,
            url: `/uploads/${response.data.data.filename}`,
            type: response.data.data.mimetype,
          }]);
        }
      }
    } catch {
      setErrors(prev => ({ ...prev, _attachments: t('errors.uploadFailed' as any) }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <FileImage className="w-3 h-3" />;
    if (type === 'application/pdf') return <File className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !user) return;

    setSubmitting(true);
    setSubmitError(null);

    const now = new Date().toISOString();

    try {
      let createdJobId: string | null = null;

      await transaction<void>((db) => {
        const jobId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        createdJobId = jobId;

        const job = {
          id: jobId,
          userId: user.userId,
          title: title.trim(),
          category,
          description: description.trim(),
          budget: parseFloat(budget),
          urgency,
          status: 'OPEN',
          attachments: attachments.map(a => a.filename),
          responses: [],
          assignedLawyerId: null,
          createdAt: now,
          updatedAt: now,
        };

        db.jobs.push(job);

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.userId,
          action: 'JOB_CREATED',
          details: { jobId, title: job.title, budget: job.budget, urgency },
          timestamp: now,
          activeRole: user.activeRole || 'user',
        });

        return db;
      });

      if (createdJobId) {
        navigate(`/user/jobs/${createdJobId}`, { replace: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setSubmitError(axiosErr.response?.data?.error || axiosErr.message || t('errors.unexpected' as any));
    } finally {
      setSubmitting(false);
    }
  }, [validate, user, title, category, description, budget, urgency, attachments, navigate, t]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/user/jobs')}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={t('common.actions.back' as any)}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white">{t('user.jobs.postJob' as any)}</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="p-5 space-y-5">
            {/* Title */}
            <div>
              <label htmlFor="job-title" className="block text-sm font-medium text-slate-300 mb-2">
                {t('jobs.post.titleLabel' as any)} *
              </label>
              <input
                id="job-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.title ? 'border-red-500' : 'border-navy-700'}`}
                placeholder={t('jobs.post.titlePlaceholder' as any)}
                aria-invalid={!!errors.title}
                maxLength={100}
              />
              {errors.title && <p className="mt-1 text-sm text-red-400" role="alert">{errors.title}</p>}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="job-category" className="block text-sm font-medium text-slate-300 mb-2">
                {t('jobs.post.category' as any)} *
              </label>
              <select
                id="job-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.category ? 'border-red-500' : 'border-navy-700'}`}
                aria-invalid={!!errors.category}
              >
                <option value="">{t('jobs.post.categoryPlaceholder' as any)}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <p className="mt-1 text-sm text-red-400" role="alert">{errors.category}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="job-desc" className="block text-sm font-medium text-slate-300 mb-2">
                {t('jobs.post.description' as any)} *
              </label>
              <textarea
                id="job-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[120px] ${errors.description ? 'border-red-500' : 'border-navy-700'}`}
                placeholder={t('jobs.post.descriptionPlaceholder' as any)}
                aria-invalid={!!errors.description}
                maxLength={2000}
              />
              {errors.description && <p className="mt-1 text-sm text-red-400" role="alert">{errors.description}</p>}
            </div>

            {/* Budget & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="job-budget" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('jobs.post.budget' as any)} (UZS) *
                </label>
                <input
                  id="job-budget"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.budget ? 'border-red-500' : 'border-navy-700'}`}
                  placeholder={t('jobs.post.budgetPlaceholder' as any)}
                  aria-invalid={!!errors.budget}
                />
                {errors.budget && <p className="mt-1 text-sm text-red-400" role="alert">{errors.budget}</p>}
              </div>

              <div>
                <label htmlFor="job-urgency" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('jobs.post.urgency' as any)} *
                </label>
                <select
                  id="job-urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.urgency ? 'border-red-500' : 'border-navy-700'}`}
                  aria-invalid={!!errors.urgency}
                >
                  <option value="LOW">{t('jobs.post.low' as any)}</option>
                  <option value="MEDIUM">{t('jobs.post.medium' as any)}</option>
                  <option value="HIGH">{t('jobs.post.high' as any)}</option>
                </select>
                {errors.urgency && <p className="mt-1 text-sm text-red-400" role="alert">{errors.urgency}</p>}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('jobs.post.attachments' as any)}
              </label>
              <p className="text-xs text-slate-500 mb-3">{t('jobs.post.attachmentsSubtitle' as any)}</p>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 rounded-lg border border-navy-700">
                      {getFileIcon(att.type)}
                      <span className="text-xs text-slate-300 truncate max-w-32">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-400 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={`Remove ${att.filename}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 border border-dashed border-navy-700 hover:border-emerald-500/30 rounded-xl cursor-pointer min-h-[48px] transition-colors focus-within:ring-2 focus-within:ring-emerald-500">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-300">
                  {uploading ? t('common.misc.loading' as any) : t('common.actions.upload' as any)}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                  aria-label={t('common.actions.upload' as any)}
                />
              </label>
              {errors._attachments && <p className="mt-1 text-sm text-red-400" role="alert">{errors._attachments as string}</p>}
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="px-5 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="px-5 py-4 border-t border-navy-800">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('common.misc.loading' as any)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t('jobs.post.submit' as any)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
