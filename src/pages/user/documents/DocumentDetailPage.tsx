import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import axios from 'axios';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  FileText,
  Shield,
  AlertTriangle,
  Star,
  ExternalLink,
  UserCircle,
  MessageSquare,
  Scale,
} from 'lucide-react';

interface AuditTrailEntry {
  event: string;
  timestamp: string;
  actor: string;
}

interface DocumentReview {
  lawyerId: string | null;
  notes: string | null;
  signature: string | null;
  reviewedAt: string | null;
}

interface Document {
  id: string;
  templateId: string;
  templateVersion: number;
  userId: string;
  status: string;
  fields: Record<string, string | number | boolean>;
  review: DocumentReview;
  auditTrail: AuditTrailEntry[];
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  riskLevel: string;
  fields: Array<{ key: string; label: string; type: string; pii: boolean }>;
}

interface Lawyer {
  id: string;
  name: string;
  rating: number;
  specializations: string[];
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactElement; messageKey: string }> = {
  PENDING: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: <Clock className="w-5 h-5" />,
    messageKey: 'documents.status.pending',
  },
  REVIEWED: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: <Eye className="w-5 h-5" />,
    messageKey: 'documents.status.reviewed',
  },
  COMPLETED: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: <CheckCircle2 className="w-5 h-5" />,
    messageKey: 'documents.status.completed',
  },
  CANCELLED: {
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    icon: <XCircle className="w-5 h-5" />,
    messageKey: 'documents.status.cancelled',
  },
};

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function DocumentDetailPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  const document = useMemo((): Document | null => {
    if (!data?.documents || !id) return null;
    const doc = data.documents.find(d => d.id === id);
    if (!doc) return null;
    return doc as Document;
  }, [data, id]);

  const template = useMemo((): Template | null => {
    if (!data?.templates || !document) return null;
    const tpl = data.templates.find(t => t.id === document.templateId);
    if (!tpl) return null;
    return tpl as Template;
  }, [data, document]);

  const lawyer = useMemo((): Lawyer | null => {
    if (!data?.lawyers || !document?.review?.lawyerId) return null;
    const law = data.lawyers.find(l => l.id === document.review.lawyerId);
    if (!law) return null;
    return {
      id: law.id,
      name: law.name,
      rating: law.rating,
      specializations: law.specializations,
    } as Lawyer;
  }, [data, document]);

  const statusConfig = STATUS_CONFIG[document?.status || 'PENDING'] || STATUS_CONFIG.PENDING;

  const handleCancel = useCallback(async () => {
    if (!document) return;

    setCancelling(true);
    setCancelError(null);

    try {
      const response = await apiClient.post(`/api/documents/${document.id}/cancel`, {
        userId: user?.userId,
      });

      if (response.data.success) {
        refresh();
        setShowCancelConfirm(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setCancelError(axiosErr.response?.data?.error || 'Failed to cancel document');
    } finally {
      setCancelling(false);
    }
  }, [document, user, refresh]);

  const handleRateLawyer = useCallback(() => {
    if (document?.review?.lawyerId) {
      navigate(`/user/lawyers/${document.review.lawyerId}`);
    }
  }, [document, navigate]);

  const handleCreateNew = useCallback(() => {
    if (document?.templateId) {
      navigate(`/user/documents/wizard?templateId=${document.templateId}`);
    }
  }, [document, navigate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">{t('errors.notFound' as any)}</p>
        <button
          type="button"
          onClick={() => navigate('/user/documents')}
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Documents</span>
        </button>
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/user/documents')}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{template?.name || 'Document'}</h1>
            <p className="text-xs text-slate-500">v{document.templateVersion} • {template?.category || ''}</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`flex items-start gap-3 px-5 py-4 rounded-xl border ${statusConfig.bg} ${statusConfig.border}`}>
        <div className={statusConfig.color}>{statusConfig.icon}</div>
        <div>
          <p className={`text-sm font-semibold ${statusConfig.color}`}>{document.status}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t(statusConfig.messageKey as any)}</p>
          <p className="text-xs text-slate-500 mt-1">Created: {formatDate(document.createdAt)}</p>
        </div>
      </div>

      {/* Actions */}
      {(document.status === 'PENDING' || document.status === 'COMPLETED' || document.status === 'CANCELLED') && (
        <div className="flex flex-wrap gap-3">
          {document.status === 'PENDING' && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelling}
              className="flex items-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              <span>{t('common.actions.cancel' as any)}</span>
            </button>
          )}
          {(document.status === 'COMPLETED' || document.status === 'CANCELLED') && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <FileText className="w-4 h-4" />
              <span>{t('common.actions.create' as any)} New</span>
            </button>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !cancelling && setShowCancelConfirm(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-white">Cancel Document?</h3>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-slate-300">
                This will cancel the document and it cannot be undone. Any review process will be stopped.
              </p>
              {cancelError && (
                <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {cancelError}
                </p>
              )}
            </div>

            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.back' as any)}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-busy={cancelling}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>{t('common.actions.cancel' as any)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEWED Status - Review Info & Rate Lawyer */}
      {document.status === 'REVIEWED' && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold">{t('documents.review.title' as any)}</h2>
          </div>

          <div className="p-5 space-y-4">
            {document.review && (
              <>
                {document.review.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">{t('documents.review.notes' as any)}</h3>
                    <p className="text-sm text-slate-400 bg-navy-800 rounded-lg p-3 border border-navy-700">{document.review.notes}</p>
                  </div>
                )}

                {document.review.reviewedAt && (
                  <p className="text-xs text-slate-500">
                    Reviewed: {formatDate(document.review.reviewedAt)}
                  </p>
                )}
              </>
            )}

            {/* Lawyer Info */}
            {lawyer && (
              <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{lawyer.name}</p>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white">{lawyer.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRateLawyer}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <Star className="w-4 h-4" />
                    <span>{t('lawyers.review.title' as any)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/user/lawyers/${lawyer.id}`)}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{t('user.lawyers.viewProfile' as any)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fields Preview */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-500" />
          <h2 className="text-white font-semibold">Document Fields</h2>
        </div>

        <div className="divide-y divide-navy-800">
          {template?.fields.map(field => {
            const value = document.fields[field.key];
            const displayValue = typeof value === 'boolean'
              ? (value ? 'Yes' : 'No')
              : value !== undefined && value !== null && value !== ''
                ? String(value)
                : '—';

            return (
              <div key={field.key} className="px-5 py-3.5 flex items-start justify-between gap-3 min-h-[48px]">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1.5">
                    {field.label}
                    {field.pii && (
                      <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] rounded font-medium">PII</span>
                    )}
                  </p>
                  <p className={`text-sm truncate ${value ? 'text-white' : 'text-slate-500'}`}>
                    {field.pii && value ? '••••••••' : displayValue}
                  </p>
                </div>
              </div>
            );
          })}
          {(!template?.fields || template.fields.length === 0) && (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-500 text-sm">{t('common.misc.noData' as any)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-500" />
          <h2 className="text-white font-semibold">{t('documents.detail.viewAuditTrail' as any)}</h2>
        </div>

        <div className="p-5">
          {document.auditTrail && document.auditTrail.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-navy-700" />
              <div className="space-y-4">
                {document.auditTrail.map((entry, index) => (
                  <div key={index} className="flex items-start gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center flex-shrink-0 z-10">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white">{entry.event}</p>
                        <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(entry.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        By: <span className="text-slate-400 font-mono">{entry.actor.slice(0, 12)}...</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Scale className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t('common.misc.noData' as any)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
