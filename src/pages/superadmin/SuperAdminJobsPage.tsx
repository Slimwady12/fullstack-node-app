import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import {
  Briefcase,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  UserCircle,
  MessageSquare,
  Star,
  ExternalLink,
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

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-emerald-400 bg-emerald-500/10',
  IN_PROGRESS: 'text-blue-400 bg-blue-500/10',
  DISPUTED: 'text-red-400 bg-red-500/10',
  COMPLETED: 'text-slate-400 bg-slate-500/10',
  CANCELLED: 'text-slate-400 bg-slate-500/10',
};

const URGENCY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400 bg-slate-500/10',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10',
  HIGH: 'text-red-400 bg-red-500/10',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function SuperAdminJobsPage(): JSX.Element {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFakeResponseModal, setShowFakeResponseModal] = useState<string | null>(null);
  const [fakeLawyerId, setFakeLawyerId] = useState<string>('');
  const [fakeCoverNote, setFakeCoverNote] = useState<string>('');
  const [fakePrice, setFakePrice] = useState<string>('');
  const [fakeSubmitting, setFakeSubmitting] = useState<boolean>(false);
  const [fakeError, setFakeError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const jobs = useMemo((): Job[] => {
    if (!data?.jobs) return [];
    return [...data.jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const lawyers = useMemo(() => data?.lawyers || [], [data]);
  const users = useMemo(() => data?.users || [], [data]);

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.category.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }

    if (filterStatus) {
      result = result.filter(j => j.status === filterStatus);
    }

    return result;
  }, [jobs, search, filterStatus]);

  const getUserName = useCallback((userId: string): string => {
    const u = users.find(u => u.id === userId);
    return u?.name || userId.slice(0, 12);
  }, [users]);

  const getLawyerName = useCallback((lawyerId: string): string => {
    const l = lawyers.find(l => l.id === lawyerId);
    return l?.name || lawyerId.slice(0, 12);
  }, [lawyers]);

  const handleFakeResponse = useCallback(async () => {
    if (!showFakeResponseModal || !fakeLawyerId || !fakeCoverNote.trim() || !fakePrice) return;
    setFakeSubmitting(true);
    setFakeError(null);

    try {
      await apiClient.post(`/api/jobs/${showFakeResponseModal}/response`, {
        lawyerId: fakeLawyerId,
        coverNote: fakeCoverNote.trim(),
        price: parseFloat(fakePrice),
      });
      setShowFakeResponseModal(null);
      setFakeLawyerId('');
      setFakeCoverNote('');
      setFakePrice('');
      refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setFakeError(axiosErr.response?.data?.error || t('errors.unexpected' as any));
    } finally {
      setFakeSubmitting(false);
    }
  }, [showFakeResponseModal, fakeLawyerId, fakeCoverNote, fakePrice, t, refresh]);

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
      <h1 className="text-xl font-bold text-white">{t('superadmin.jobs.title' as any)}</h1>

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
        {['OPEN', 'IN_PROGRESS', 'DISPUTED', 'COMPLETED', 'CANCELLED'].map(status => (
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

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map(job => {
            const isExpanded = expandedId === job.id;

            return (
              <div key={job.id} className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  className="w-full text-left p-4 hover:bg-navy-800/50 transition-colors min-h-[64px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{job.title}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${STATUS_COLORS[job.status]}`}>{job.status}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${URGENCY_COLORS[job.urgency]}`}>{job.urgency}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {getUserName(job.userId)} • {job.category} • {formatDate(job.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-emerald-400 font-semibold">{job.budget.toLocaleString()} UZS</span>
                      <span className="text-xs text-slate-500">{job.responses.length} responses</span>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-navy-800">
                    <div className="pt-4 space-y-4">
                      <p className="text-sm text-slate-400 whitespace-pre-wrap">{job.description}</p>

                      {job.assignedLawyerId && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <UserCircle className="w-4 h-4" />
                          <span>Assigned: {getLawyerName(job.assignedLawyerId)}</span>
                        </div>
                      )}

                      {/* Responses */}
                      {job.responses.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-300">Responses</h4>
                          {job.responses.map((resp, i) => (
                            <div key={i} className="bg-navy-800 rounded-lg p-3 border border-navy-700">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-white">{getLawyerName(resp.lawyerId)}</span>
                                <span className="text-sm text-emerald-400 font-semibold">{resp.price.toLocaleString()} UZS</span>
                              </div>
                              <p className="text-xs text-slate-400">{resp.coverNote}</p>
                              <p className="text-xs text-slate-500 mt-1">{formatDate(resp.submittedAt)}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inject Fake Response */}
                      <button
                        type="button"
                        onClick={() => { setShowFakeResponseModal(job.id); setFakeLawyerId(''); setFakeCoverNote(''); setFakePrice(''); setFakeError(null); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-xl text-sm min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Inject Response (Admin)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fake Response Modal */}
      {showFakeResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !fakeSubmitting && setShowFakeResponseModal(null)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Inject Response</h3>
              <button
                type="button"
                onClick={() => setShowFakeResponseModal(null)}
                disabled={fakeSubmitting}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="fake-lawyer" className="block text-sm font-medium text-slate-300 mb-2">Lawyer</label>
                <select
                  id="fake-lawyer"
                  value={fakeLawyerId}
                  onChange={(e) => setFakeLawyerId(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                >
                  <option value="">Select a lawyer</option>
                  {lawyers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="fake-note" className="block text-sm font-medium text-slate-300 mb-2">Cover Note</label>
                <textarea
                  id="fake-note"
                  value={fakeCoverNote}
                  onChange={(e) => setFakeCoverNote(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[60px]"
                  placeholder="Cover note..."
                />
              </div>

              <div>
                <label htmlFor="fake-price" className="block text-sm font-medium text-slate-300 mb-2">Price (UZS)</label>
                <input
                  id="fake-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={fakePrice}
                  onChange={(e) => setFakePrice(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder="0"
                />
              </div>

              {fakeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{fakeError}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowFakeResponseModal(null)}
                disabled={fakeSubmitting}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {t('common.actions.cancel' as any)}
              </button>
              <button
                type="button"
                onClick={handleFakeResponse}
                disabled={fakeSubmitting || !fakeLawyerId || !fakeCoverNote.trim() || !fakePrice}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-busy={fakeSubmitting}
              >
                {fakeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                <span>Inject Response</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
