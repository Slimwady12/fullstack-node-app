import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import {
  Plus,
  Search,
  Filter,
  X,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Briefcase,
  UserCircle,
  MessageSquare,
  Eye,
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

type TabType = 'my' | 'open';

const TABS: { key: TabType; labelKey: string }[] = [
  { key: 'my', labelKey: 'user.jobs.myJobs' },
  { key: 'open', labelKey: 'user.jobs.availableJobs' },
];

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
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function JobsPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useRealtimeSync();

  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUrgency, setFilterUrgency] = useState<string>('');

  const allJobs = useMemo((): Job[] => {
    if (!data?.jobs) return [];
    return data.jobs;
  }, [data]);

  const lawyers = useMemo(() => {
    if (!data?.lawyers) return [];
    return data.lawyers;
  }, [data]);

  const myJobs = useMemo(() => {
    if (!user) return [];
    return allJobs.filter(j => j.userId === user.userId);
  }, [allJobs, user]);

  const openJobs = useMemo(() => {
    return allJobs.filter(j => j.status === 'OPEN' && j.userId !== user?.userId);
  }, [allJobs, user]);

  const filteredJobs = useMemo(() => {
    let result = activeTab === 'my' ? myJobs : openJobs;

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

    if (filterUrgency) {
      result = result.filter(j => j.urgency === filterUrgency);
    }

    return result.sort((a, b) => {
      if (a.urgency === 'HIGH' && b.urgency !== 'HIGH') return -1;
      if (b.urgency === 'HIGH' && a.urgency !== 'HIGH') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeTab, myJobs, openJobs, search, filterStatus, filterUrgency]);

  const getLawyerName = useCallback((lawyerId: string): string => {
    const lawyer = lawyers.find(l => l.id === lawyerId);
    return lawyer?.name || lawyerId.slice(0, 12);
  }, [lawyers]);

  if (loading && allJobs.length === 0) {
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

  if (error && allJobs.length === 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-medium">{t('errors.loadFailed' as any)}</p>
          <p className="text-red-300/70 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-navy-800">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 min-h-[48px] text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 relative ${
              activeTab === tab.key ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {t(tab.labelKey as any)}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
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

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
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
        {['LOW', 'MEDIUM', 'HIGH'].map(urgency => (
          <button
            key={urgency}
            type="button"
            onClick={() => setFilterUrgency(filterUrgency === urgency ? '' : urgency)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              filterUrgency === urgency
                ? URGENCY_COLORS[urgency]
                : 'bg-navy-900 text-slate-500 border border-navy-800 hover:border-navy-700'
            }`}
          >
            {urgency}
          </button>
        ))}
        {(filterStatus || filterUrgency || search) && (
          <button
            type="button"
            onClick={() => { setFilterStatus(''); setFilterUrgency(''); setSearch(''); }}
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
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'my' ? t('user.jobs.noJobsSubtitle' as any) : t('user.jobs.availableJobs' as any)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map(job => (
            <div
              key={job.id}
              className="bg-navy-900 border border-navy-800 rounded-xl p-4 hover:border-navy-700 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate">{job.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{job.category} • {formatDate(job.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[job.status] || 'text-slate-400 bg-slate-500/10'}`}>
                    {job.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${URGENCY_COLORS[job.urgency]}`}>
                    {job.urgency}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 mb-3">{job.description}</p>

              <div className="flex items-center justify-between pt-3 border-t border-navy-800">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="text-emerald-400 font-semibold">{job.budget.toLocaleString()} UZS</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {job.responses.length} {t('jobs.responses.count' as any, { count: job.responses.length })}
                  </span>
                  {job.assignedLawyerId && (
                    <span className="flex items-center gap-1">
                      <UserCircle className="w-3 h-3" />
                      {getLawyerName(job.assignedLawyerId)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/user/jobs/${job.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-lg text-xs min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('common.actions.view' as any)}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      {activeTab === 'my' && (
        <button
          type="button"
          onClick={() => navigate('/user/jobs/post')}
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-950 z-10"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          aria-label={t('user.jobs.postJob' as any)}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
