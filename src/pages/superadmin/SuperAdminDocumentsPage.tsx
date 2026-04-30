import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import {
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  UserCircle,
  Eye,
  Clock,
  Shield,
  ExternalLink,
  Star,
  MessageSquare,
} from 'lucide-react';

interface Document {
  id: string;
  templateId: string;
  templateVersion: number;
  userId: string;
  status: string;
  fields: Record<string, string | number | boolean>;
  review: { lawyerId: string | null; notes: string | null; signature: string | null; reviewedAt: string | null };
  auditTrail: Array<{ event: string; timestamp: string; actor: string }>;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-500/10',
  REVIEWED: 'text-blue-400 bg-blue-500/10',
  COMPLETED: 'text-emerald-400 bg-emerald-500/10',
  CANCELLED: 'text-slate-400 bg-slate-500/10',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function SuperAdminDocumentsPage(): JSX.Element {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);
  const [reviewLawyerId, setReviewLawyerId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewSignature, setReviewSignature] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const documents = useMemo((): Document[] => {
    if (!data?.documents) return [];
    return [...data.documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const templates = useMemo(() => data?.templates || [], [data]);
  const users = useMemo(() => data?.users || [], [data]);
  const lawyers = useMemo(() => data?.lawyers || [], [data]);

  const filteredDocs = useMemo(() => {
    let result = documents;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(d => {
        const tpl = templates.find(t => t.id === d.templateId);
        return (
          tpl?.name.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          Object.values(d.fields).some(v => String(v).toLowerCase().includes(q))
        );
      });
    }

    if (filterStatus) {
      result = result.filter(d => d.status === filterStatus);
    }

    return result;
  }, [documents, search, filterStatus, templates]);

  const getTemplateName = useCallback((templateId: string): string => {
    const tpl = templates.find(t => t.id === templateId);
    return tpl?.name || templateId.slice(0, 16);
  }, [templates]);

  const getUserName = useCallback((userId: string): string => {
    const u = users.find(u => u.id === userId);
    return u?.name || userId.slice(0, 12);
  }, [users]);

  const getLawyerName = useCallback((lawyerId: string): string => {
    if (!lawyerId) return 'None';
    const l = lawyers.find(l => l.id === lawyerId);
    return l?.name || lawyerId.slice(0, 12);
  }, [lawyers]);

  const getTemplateFields = useCallback((templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    return tpl?.fields || [];
  }, [templates]);

  const handleReview = useCallback(async () => {
    if (!showReviewModal || !reviewLawyerId || !reviewNotes.trim()) return;
    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const response = await apiClient.post(`/api/documents/${showReviewModal}/review`, {
        userId: user?.userId,
        lawyerId: reviewLawyerId,
        notes: reviewNotes.trim(),
        signature: reviewSignature.trim() || null,
        status: 'REVIEWED',
      });

      if (response.data.success) {
        setShowReviewModal(null);
        setReviewLawyerId('');
        setReviewNotes('');
        setReviewSignature('');
        refresh();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setReviewError(axiosErr.response?.data?.error || t('errors.unexpected' as any));
    } finally {
      setReviewSubmitting(false);
    }
  }, [showReviewModal, reviewLawyerId, reviewNotes, reviewSignature, user, t, refresh]);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-4">
            <div className="h-4 bg-navy-800 rounded w-32 mb-2" />
            <div className="h-3 bg-navy-800 rounded w-full mb-2" />
            <div className="h-3 bg-navy-800 rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-medium">{t('errors.loadFailed' as any)}</p>
          <p className="text-red-300/70 text-sm mt-1">{syncError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-white">{t('superadmin.documents.title' as any)}</h1>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.actions.search' as any)}
            className="w-full pl-12 pr-4 py-3 bg-navy-900 border border-navy-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
            aria-label={t('common.actions.search' as any)}
          />
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {['PENDING', 'REVIEWED', 'COMPLETED', 'CANCELLED'].map(status => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              filterStatus === status
                ? STATUS_COLORS[status]
                : 'bg-navy-900 text-slate-500 border border-navy-800 hover:border-navy-700'
            }`}
          >
            {t(`common.status.${status.toLowerCase()}` as any)}
          </button>
        ))}
        {filterStatus && (
          <button
            type="button"
            onClick={() => setFilterStatus('')}
            className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-white min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
          >
            <X className="w-3 h-3" />
            <span>{t('common.actions.clear' as any)}</span>
          </button>
        )}
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map(doc => {
            const isExpanded = expandedId === doc.id;
            const templateFields = getTemplateFields(doc.templateId);

            return (
              <div key={doc.id} className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                  className="w-full text-left p-4 hover:bg-navy-800/50 transition-colors min-h-[64px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{getTemplateName(doc.templateId)}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {getUserName(doc.userId)} • v{doc.templateVersion} • {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">{doc.auditTrail.length} events</span>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-navy-800">
                    <div className="pt-4 space-y-4">
                      {/* Fields Preview */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3">Document Fields</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {templateFields.map(field => {
                            const value = doc.fields[field.key];
                            const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value !== undefined && value !== null ? String(value) : '—';
                            return (
                              <div key={field.key} className="bg-navy-800 rounded-lg p-3 border border-navy-700">
                                <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                                  {field.label}
                                  {field.pii && <span className="px-1 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] rounded font-medium">PII</span>}
                                </p>
                                <p className="text-sm text-white truncate">{field.pii && value ? '••••••••' : displayValue}</p>
                              </div>
                            );
                          })}
                          {Object.entries(doc.fields).filter(([key]) => !templateFields.find(f => f.key === key)).map(([key, value]) => (
                            <div key={key} className="bg-navy-800 rounded-lg p-3 border border-navy-700">
                              <p className="text-xs text-slate-500 mb-0.5">{key}</p>
                              <p className="text-sm text-white truncate">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Review Info */}
                      {doc.review?.lawyerId && (
                        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">Reviewed</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                            <UserCircle className="w-4 h-4" />
                            <span>{getLawyerName(doc.review.lawyerId)}</span>
                          </div>
                          {doc.review.notes && (
                            <p className="text-sm text-slate-400 mt-2">{doc.review.notes}</p>
                          )}
                          {doc.review.reviewedAt && (
                            <p className="text-xs text-slate-500 mt-2">Reviewed: {formatDate(doc.review.reviewedAt)}</p>
                          )}
                        </div>
                      )}

                      {/* Audit Trail */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-3">{t('documents.detail.viewAuditTrail' as any)}</h4>
                        <div className="space-y-2">
                          {doc.auditTrail.map((entry, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-white">{entry.event}</p>
                                  <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(entry.timestamp)}</span>
                                </div>
                                <p className="text-xs text-slate-500">By: <span className="text-slate-400 font-mono">{entry.actor.slice(0, 12)}...</span></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Review Action */}
                      {doc.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowReviewModal(doc.id);
                            setReviewLawyerId('');
                            setReviewNotes('');
                            setReviewSignature('');
                            setReviewError(null);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <Shield className="w-4 h-4" />
                          <span>{t('superadmin.documents.review' as any)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !reviewSubmitting && setShowReviewModal(null)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t('superadmin.documents.review' as any)}</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(null)}
                disabled={reviewSubmitting}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="review-lawyer" className="block text-sm font-medium text-slate-300 mb-2">Reviewer (Lawyer)</label>
                <select
                  id="review-lawyer"
                  value={reviewLawyerId}
                  onChange={(e) => setReviewLawyerId(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                >
                  <option value="">Select a lawyer</option>
                  {lawyers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="review-notes" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('superadmin.documents.review' as any)} Notes *
                </label>
                <textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[80px]"
                  placeholder="Review notes..."
                />
              </div>

              <div>
                <label htmlFor="review-signature" className="block text-sm font-medium text-slate-300 mb-2">
                  Signature (optional)
                </label>
                <input
                  id="review-signature"
                  type="text"
                  value={reviewSignature}
                  onChange={(e) => setReviewSignature(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder="Electronic signature..."
                />
              </div>

              {reviewError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{reviewError}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(null)}
                disabled={reviewSubmitting}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.cancel' as any)}
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={reviewSubmitting || !reviewLawyerId || !reviewNotes.trim()}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-busy={reviewSubmitting}
              >
                {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{t('superadmin.documents.approve' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
