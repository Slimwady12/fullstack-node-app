import { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import {
  Shield,
  AlertTriangle,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  FileImage,
  File,
  X,
  UserCircle,
  Briefcase,
} from 'lucide-react';

interface Dispute {
  id: string;
  jobId: string;
  userId: string;
  lawyerId: string;
  reason: string;
  details: string;
  attachments: string[];
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  UNDER_REVIEW: 'text-yellow-400 bg-yellow-500/10',
  RESOLVED: 'text-emerald-400 bg-emerald-500/10',
  DISMISSED: 'text-slate-400 bg-slate-500/10',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DisputesPage(): JSX.Element {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const disputes = useMemo((): Dispute[] => {
    if (!data?.disputes) return [];
    return [...data.disputes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const jobs = useMemo(() => data?.jobs || [], [data]);
  const users = useMemo(() => data?.users || [], [data]);
  const lawyers = useMemo(() => data?.lawyers || [], [data]);

  const getJobTitle = useCallback((jobId: string): string => {
    const job = jobs.find(j => j.id === jobId);
    return job?.title || jobId.slice(0, 16);
  }, [jobs]);

  const getUserName = useCallback((userId: string): string => {
    const u = users.find(u => u.id === userId);
    return u?.name || userId.slice(0, 12);
  }, [users]);

  const getLawyerName = useCallback((lawyerId: string): string => {
    const l = lawyers.find(l => l.id === lawyerId);
    return l?.name || lawyerId.slice(0, 12);
  }, [lawyers]);

  const handleResolve = useCallback(async (disputeId: string, action: string) => {
    if (!user || !resolutionText.trim()) return;
    setActionLoading(`${disputeId}-${action}`);
    setActionError(null);

    try {
      const response = await axios.post(`/api/disputes/${disputeId}/resolve`, {
        userId: user.userId,
        action: action === 'CANCEL' ? 'resolve' : action.toLowerCase(),
        resolution: resolutionText.trim(),
      });

      if (response.data.success) {
        setExpandedId(null);
        setResolutionText('');
        setSelectedAction(null);
        refresh();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setActionError(axiosErr.response?.data?.error || t('errors.unexpected' as any));
    } finally {
      setActionLoading(null);
    }
  }, [user, resolutionText, t, refresh]);

  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <FileImage className="w-3 h-3" />;
    if (filename.endsWith('.pdf')) return <File className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">{t('superadmin.disputes.title' as any)}</h1>
        <span className="text-sm text-slate-500">{disputes.length} disputes</span>
      </div>

      {disputes.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(dispute => {
            const isExpanded = expandedId === dispute.id;

            return (
              <div key={dispute.id} className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
                  className="w-full text-left p-4 hover:bg-navy-800/50 transition-colors min-h-[64px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{getJobTitle(dispute.jobId)}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${STATUS_COLORS[dispute.status]}`}>
                          {dispute.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {getUserName(dispute.userId)} → {getLawyerName(dispute.lawyerId)} • {formatDate(dispute.createdAt)}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-navy-800">
                    <div className="pt-4 space-y-4">
                      {/* Reason */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-1">Reason</h4>
                        <p className="text-sm text-white">{dispute.reason}</p>
                      </div>

                      {/* Details */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-1">Details</h4>
                        <p className="text-sm text-slate-400 whitespace-pre-wrap">{dispute.details}</p>
                      </div>

                      {/* Attachments */}
                      {dispute.attachments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-2">Attachments</h4>
                          <div className="flex flex-wrap gap-2">
                            {dispute.attachments.map((filename, i) => (
                              <a
                                key={i}
                                href={`/uploads/${filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg border border-navy-700 text-sm text-slate-300 transition-colors min-h-[40px]"
                              >
                                {getFileIcon(filename)}
                                <span className="truncate max-w-40">{filename}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resolved Info */}
                      {dispute.resolvedAt && (
                        <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                          <div className="flex items-center gap-2 mb-2">
                            {dispute.status === 'RESOLVED' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-sm font-medium text-white">Status: {dispute.status}</span>
                          </div>
                          <p className="text-sm text-slate-400">{dispute.resolution}</p>
                          <p className="text-xs text-slate-500 mt-2">Resolved: {formatDate(dispute.resolvedAt)}</p>
                        </div>
                      )}

                      {/* Action Error */}
                      {actionError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-400">{actionError}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {dispute.status === 'UNDER_REVIEW' && (
                        <div className="space-y-3">
                          <div>
                            <label htmlFor={`resolution-${dispute.id}`} className="block text-sm font-medium text-slate-300 mb-2">
                              {t('superadmin.disputes.resolution' as any)}
                            </label>
                            <textarea
                              id={`resolution-${dispute.id}`}
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              rows={2}
                              className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                              placeholder={t('superadmin.disputes.resolutionPlaceholder' as any)}
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => handleResolve(dispute.id, 'RESOLVE')}
                              disabled={actionLoading?.startsWith(dispute.id) || !resolutionText.trim()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {actionLoading?.startsWith(dispute.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              <span>{t('superadmin.disputes.resolve' as any)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolve(dispute.id, 'DISMISS')}
                              disabled={actionLoading?.startsWith(dispute.id) || !resolutionText.trim()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                            >
                              {actionLoading?.startsWith(dispute.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                              <span>{t('superadmin.disputes.dismiss' as any)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolve(dispute.id, 'CANCEL')}
                              disabled={actionLoading?.startsWith(dispute.id) || !resolutionText.trim()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              {actionLoading?.startsWith(dispute.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                              <span>Cancel Job</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
