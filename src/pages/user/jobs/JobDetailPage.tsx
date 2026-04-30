import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import { transaction } from '../../../services/db';
import axios from 'axios';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  UserCircle,
  Clock,
  FileText,
  FileImage,
  File,
  ExternalLink,
  Shield,
  Star,
  Briefcase,
} from 'lucide-react';

interface Job {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  urgency: string;
  status: string;
  attachments: string[];
  responses: Array<{ lawyerId: string; coverNote: string; price: number; submittedAt: string }>;
  assignedLawyerId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Lawyer {
  id: string;
  name: string;
  rating: number;
  specializations: string[];
  phone: string;
}

const URGENCY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400 bg-slate-500/10',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10',
  HIGH: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-emerald-400 bg-emerald-500/10',
  IN_PROGRESS: 'text-blue-400 bg-blue-500/10',
  DISPUTED: 'text-red-400 bg-red-500/10',
  COMPLETED: 'text-slate-400 bg-slate-500/10',
  CANCELLED: 'text-slate-400 bg-slate-500/10',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function JobDetailPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeDetails, setDisputeDetails] = useState<string>('');
  const [disputeSubmitting, setDisputeSubmitting] = useState<boolean>(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const job = useMemo((): Job | null => {
    if (!data?.jobs || !id) return null;
    const j = data.jobs.find(job => job.id === id);
    if (!j) return null;
    return j as Job;
  }, [data, id]);

  const assignedLawyer = useMemo((): Lawyer | null => {
    if (!data?.lawyers || !job?.assignedLawyerId) return null;
    const l = data.lawyers.find(law => law.id === job.assignedLawyerId);
    if (!l) return null;
    return { id: l.id, name: l.name, rating: l.rating, specializations: l.specializations, phone: l.phone } as Lawyer;
  }, [data, job]);

  const responseLawyers = useMemo((): Array<Lawyer & { coverNote: string; price: number; submittedAt: string }> => {
    if (!data?.lawyers || !job) return [];
    return job.responses.map(resp => {
      const lawyer = data.lawyers.find(l => l.id === resp.lawyerId);
      return {
        id: resp.lawyerId,
        name: lawyer?.name || resp.lawyerId.slice(0, 12),
        rating: lawyer?.rating || 0,
        specializations: lawyer?.specializations || [],
        phone: lawyer?.phone || '',
        coverNote: resp.coverNote,
        price: resp.price,
        submittedAt: resp.submittedAt,
      };
    });
  }, [data, job]);

  const handleCancel = useCallback(async () => {
    if (!job || !user) return;
    setActionLoading('cancel');
    setActionError(null);

    try {
      const now = new Date().toISOString();
      await transaction<void>((db) => {
        const jobIndex = db.jobs.findIndex(j => j.id === job.id);
        if (jobIndex === -1) throw new Error('Job not found');
        db.jobs[jobIndex].status = 'CANCELLED';
        db.jobs[jobIndex].updatedAt = now;

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.userId,
          action: 'JOB_CANCELLED',
          details: { jobId: job.id },
          timestamp: now,
          activeRole: user.activeRole || 'user',
        });

        return db;
      });
      setShowCancelConfirm(false);
      refresh();
    } catch {
      setActionError(t('errors.saveFailed' as any));
    } finally {
      setActionLoading(null);
    }
  }, [job, user, t, refresh]);

  const handleAccept = useCallback(async (lawyerId: string) => {
    if (!job || !user) return;
    setActionLoading(`accept-${lawyerId}`);
    setActionError(null);

    try {
      const response = await apiClient.post(`/api/jobs/${job.id}/accept`, {
        userId: user.userId,
        lawyerId,
      });

      if (response.data.success) {
        setShowAcceptConfirm(null);
        refresh();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setActionError(axiosErr.response?.data?.error || axiosErr.message || t('errors.unexpected' as any));
    } finally {
      setActionLoading(null);
    }
  }, [job, user, t, refresh]);

  const handleMarkComplete = useCallback(async () => {
    if (!job || !user) return;
    setActionLoading('complete');
    setActionError(null);

    try {
      const now = new Date().toISOString();
      await transaction<void>((db) => {
        const jobIndex = db.jobs.findIndex(j => j.id === job.id);
        if (jobIndex === -1) throw new Error('Job not found');
        db.jobs[jobIndex].status = 'COMPLETED';
        db.jobs[jobIndex].updatedAt = now;

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.userId,
          action: 'JOB_COMPLETED',
          details: { jobId: job.id },
          timestamp: now,
          activeRole: user.activeRole || 'user',
        });

        return db;
      });
      refresh();
    } catch {
      setActionError(t('errors.saveFailed' as any));
    } finally {
      setActionLoading(null);
    }
  }, [job, user, t, refresh]);

  const handleDispute = useCallback(async () => {
    if (!job || !user || !disputeReason || !disputeDetails) return;
    setDisputeSubmitting(true);
    setDisputeError(null);

    try {
      const response = await apiClient.post('/api/disputes', {
        jobId: job.id,
        userId: user.userId,
        lawyerId: job.assignedLawyerId,
        reason: disputeReason,
        details: disputeDetails,
        attachments: [],
      });

      if (response.data.success) {
        setShowDisputeModal(false);
        setDisputeReason('');
        setDisputeDetails('');
        refresh();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setDisputeError(axiosErr.response?.data?.error || t('errors.unexpected' as any));
    } finally {
      setDisputeSubmitting(false);
    }
  }, [job, user, disputeReason, disputeDetails, t, refresh]);

  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <FileImage className="w-3 h-3" />;
    if (filename.endsWith('.pdf')) return <File className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
        <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">{t('errors.notFound' as any)}</p>
        <button
          type="button"
          onClick={() => navigate('/user/jobs')}
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.actions.back' as any)}</span>
        </button>
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
    <div className="max-w-4xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/user/jobs')}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={t('common.actions.back' as any)}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{job.title}</h1>
            <p className="text-xs text-slate-500">{job.category} • {formatDate(job.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[job.status]}`}>{job.status}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${URGENCY_COLORS[job.urgency]}`}>{job.urgency}</span>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{actionError}</p>
            <button type="button" onClick={() => setActionError(null)} className="text-xs text-red-300 mt-1 underline">{t('common.actions.dismiss' as any)}</button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-400">{job.budget.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">UZS</p>
          </div>
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{job.responses.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('jobs.responses.count' as any, { count: job.responses.length })}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">{t('jobs.detail.description' as any)}</h3>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </div>

        {job.attachments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('common.misc.attachments' as any) || 'Attachments'}</h3>
            <div className="flex flex-wrap gap-2">
              {job.attachments.map((filename, i) => (
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
      </div>

      {/* Assigned Lawyer */}
      {assignedLawyer && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Assigned Lawyer</h3>
          <div className="flex items-center justify-between bg-navy-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{assignedLawyer.name}</p>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-white">{assignedLawyer.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/user/messages/new?lawyerId=${assignedLawyer.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('common.navigation.messages' as any)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Responses */}
      {job.status === 'OPEN' && responseLawyers.length > 0 && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800">
            <h2 className="text-white font-semibold">{t('jobs.detail.responses' as any)}</h2>
          </div>
          <div className="divide-y divide-navy-800">
            {responseLawyers.map(resp => (
              <div key={resp.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-navy-800 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{resp.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(resp.submittedAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">{resp.price.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">UZS</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-4">{resp.coverNote}</p>
                <button
                  type="button"
                  onClick={() => setShowAcceptConfirm(resp.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('jobs.responses.accept' as any)}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status-based Actions */}
      {job.status === 'OPEN' && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          disabled={actionLoading === 'cancel'}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          <span>{t('common.actions.cancel' as any)}</span>
        </button>
      )}

      {job.status === 'IN_PROGRESS' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={actionLoading === 'complete'}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {actionLoading === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{t('jobs.detail.complete' as any)}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDisputeModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Shield className="w-4 h-4" />
            <span>{t('jobs.detail.dispute' as any)}</span>
          </button>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-white">{t('common.actions.cancel' as any)} {t('common.labels.job' as any) || 'Job'}?</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-slate-300">{t('jobs.detail.confirmCancel' as any)}</p>
            </div>
            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.back' as any)}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>{t('common.actions.cancel' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirm Modal */}
      {showAcceptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAcceptConfirm(null)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-white">{t('jobs.responses.confirmAccept' as any, { name: responseLawyers.find(r => r.id === showAcceptConfirm)?.name || '' })}</h3>
            </div>
            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAcceptConfirm(null)}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.back' as any)}
              </button>
              <button
                type="button"
                onClick={() => handleAccept(showAcceptConfirm)}
                disabled={actionLoading?.startsWith('accept')}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {actionLoading?.startsWith('accept') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{t('common.actions.accept' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !disputeSubmitting && setShowDisputeModal(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800">
              <h3 className="text-lg font-semibold text-white">{t('jobs.dispute.title' as any)}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="dispute-reason" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('jobs.dispute.reason' as any)} *
                </label>
                <input
                  id="dispute-reason"
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder={t('jobs.dispute.reasonPlaceholder' as any)}
                />
              </div>
              <div>
                <label htmlFor="dispute-details" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('jobs.dispute.details' as any)} *
                </label>
                <textarea
                  id="dispute-details"
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[80px]"
                  placeholder={t('jobs.dispute.detailsPlaceholder' as any)}
                />
              </div>
              {disputeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{disputeError}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                disabled={disputeSubmitting}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.cancel' as any)}
              </button>
              <button
                type="button"
                onClick={handleDispute}
                disabled={disputeSubmitting || !disputeReason.trim() || !disputeDetails.trim()}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {disputeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{t('jobs.dispute.submit' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
