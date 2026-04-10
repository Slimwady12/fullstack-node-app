import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import {
  FileText,
  Plus,
  MessageSquare,
  Briefcase,
  Scale,
  Star,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Globe,
  Shield,
} from 'lucide-react';

interface Lawyer {
  id: string;
  name: string;
  verified: boolean;
  specializations: string[];
  languages: string[];
  rating: number;
  reviewCount: number;
  price: number;
  online: boolean;
  images: { profile: string | null };
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  status: string;
}

interface PendingDocument {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
}

interface PendingJob {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  budget: number;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const RISK_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400 bg-emerald-500/10',
  YELLOW: 'text-yellow-400 bg-yellow-500/10',
  RED: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-500/10',
  REVIEWED: 'text-blue-400 bg-blue-500/10',
  COMPLETED: 'text-emerald-400 bg-emerald-500/10',
  CANCELLED: 'text-slate-400 bg-slate-500/10',
  OPEN: 'text-emerald-400 bg-emerald-500/10',
  IN_PROGRESS: 'text-blue-400 bg-blue-500/10',
};

export default function DashboardPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, lastSync } = useRealtimeSync();

  const userDocuments = useMemo(() => {
    if (!data?.documents || !user) return [];
    return data.documents.filter(d => d.userId === user.userId);
  }, [data, user]);

  const userJobs = useMemo(() => {
    if (!data?.jobs || !user) return [];
    return data.jobs.filter(j => j.userId === user.userId);
  }, [data, user]);

  const pendingDocuments = useMemo((): PendingDocument[] => {
    return userDocuments
      .filter(d => d.status === 'PENDING' || d.status === 'REVIEWED')
      .map(doc => {
        const template = data?.templates?.find(t => t.id === doc.templateId);
        return {
          id: doc.id,
          templateId: doc.templateId,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          templateName: template?.name || doc.templateId.slice(0, 12),
        };
      })
      .slice(0, 5);
  }, [userDocuments, data]);

  const pendingJobs = useMemo((): PendingJob[] => {
    return userJobs
      .filter(j => j.status === 'OPEN' || j.status === 'IN_PROGRESS')
      .map(job => ({
        id: job.id,
        title: job.title,
        status: job.status,
        createdAt: job.createdAt,
        budget: job.budget,
      }))
      .slice(0, 5);
  }, [userJobs]);

  const recommendedLawyers = useMemo((): Lawyer[] => {
    if (!data?.lawyers) return [];
    return data.lawyers
      .filter(l => l.verified)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }, [data]);

  const popularTemplates = useMemo((): Template[] => {
    if (!data?.templates) return [];
    return data.templates
      .filter(t => t.status === 'ACTIVE')
      .slice(0, 6);
  }, [data]);

  const handleNewDocument = useCallback(() => {
    navigate('/user/documents/new');
  }, [navigate]);

  const handlePostJob = useCallback(() => {
    navigate('/user/jobs/new');
  }, [navigate]);

  const handleChat = useCallback(() => {
    navigate('/user/chat');
  }, [navigate]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-24 bg-navy-900 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl p-5 border border-navy-800">
              <div className="h-4 bg-navy-800 rounded w-24 mb-3" />
              <div className="h-10 bg-navy-800 rounded" />
            </div>
          ))}
        </div>
        <div className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-5">
          <div className="h-5 bg-navy-800 rounded w-32 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-navy-800 rounded mb-2" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl p-5 border border-navy-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-navy-800 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-navy-800 rounded w-24" />
                  <div className="h-3 bg-navy-800 rounded w-16" />
                </div>
              </div>
              <div className="h-8 bg-navy-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-medium">{t('errors.loadFailed' as any)}</p>
          <p className="text-red-300/70 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-600/20 via-navy-900 to-navy-800 border border-emerald-500/20 rounded-2xl p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              {t('user.dashboard.welcome' as any, { name: user?.name || '' })}
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              {t('user.dashboard.quickActions' as any)}
            </p>
            {lastSync && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Synced: {formatDate(lastSync)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-navy-800/50 rounded-xl">
              <p className="text-2xl font-bold text-white">{userDocuments.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('common.navigation.documents' as any)}</p>
            </div>
            <div className="text-center px-4 py-2 bg-navy-800/50 rounded-xl">
              <p className="text-2xl font-bold text-white">{userJobs.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('common.navigation.jobs' as any)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={handleNewDocument}
          className="flex items-center gap-4 px-5 py-4 bg-navy-900 hover:bg-navy-800 border border-navy-800 hover:border-emerald-500/30 rounded-xl transition-all duration-200 min-h-[56px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 group-hover:bg-emerald-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <FileText className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-white font-medium truncate">{t('user.dashboard.createDocument' as any)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{t('common.navigation.documents' as any)}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handlePostJob}
          className="flex items-center gap-4 px-5 py-4 bg-navy-900 hover:bg-navy-800 border border-navy-800 hover:border-emerald-500/30 rounded-xl transition-all duration-200 min-h-[56px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 group-hover:bg-emerald-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Briefcase className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-white font-medium truncate">{t('user.dashboard.postJob' as any)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{t('common.navigation.jobs' as any)}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleChat}
          className="flex items-center gap-4 px-5 py-4 bg-navy-900 hover:bg-navy-800 border border-navy-800 hover:border-emerald-500/30 rounded-xl transition-all duration-200 min-h-[56px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 group-hover:bg-emerald-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Sparkles className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-white font-medium truncate">{t('user.dashboard.startChat' as any)}</p>
            <p className="text-slate-500 text-xs mt-0.5">AI {t('common.navigation.chat' as any)}</p>
          </div>
        </button>
      </div>

      {/* Pending Items */}
      {(pendingDocuments.length > 0 || pendingJobs.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pending Documents */}
          <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">{t('user.documents.pendingReview' as any)}</h2>
              <button
                type="button"
                onClick={() => navigate('/user/documents')}
                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 min-h-[44px] px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
              >
                <span>{t('common.misc.view' as any)}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-navy-800">
              {pendingDocuments.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-slate-500 text-sm">{t('common.misc.noData' as any)}</p>
                </div>
              ) : (
                pendingDocuments.map(doc => (
                  <div key={doc.id} className="px-5 py-3.5 flex items-center justify-between gap-3 min-h-[52px] hover:bg-navy-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/user/documents/${doc.id}`)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{doc.templateName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(doc.updatedAt)}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${STATUS_COLORS[doc.status] || 'text-slate-400 bg-slate-500/10'}`}>
                      {doc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Jobs */}
          <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">{t('user.dashboard.activeJobs' as any)}</h2>
              <button
                type="button"
                onClick={() => navigate('/user/jobs')}
                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 min-h-[44px] px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
              >
                <span>{t('common.misc.view' as any)}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-navy-800">
              {pendingJobs.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-slate-500 text-sm">{t('common.misc.noData' as any)}</p>
                </div>
              ) : (
                pendingJobs.map(job => (
                  <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-3 min-h-[52px] hover:bg-navy-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/user/jobs/${job.id}`)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{job.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{job.budget.toLocaleString()} UZS • {formatDate(job.createdAt)}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${STATUS_COLORS[job.status] || 'text-slate-400 bg-slate-500/10'}`}>
                      {job.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recommended Lawyers */}
      {recommendedLawyers.length > 0 && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">{t('user.dashboard.findLawyer' as any)}</h2>
            <button
              type="button"
              onClick={() => navigate('/user/lawyers')}
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 min-h-[44px] px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
            >
              <span>{t('common.misc.view' as any)}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
              {recommendedLawyers.map(lawyer => (
                <div key={lawyer.id} className="flex-shrink-0 w-64 snap-start bg-navy-800 rounded-xl p-4 border border-navy-700 hover:border-navy-600 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold">
                      {lawyer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white truncate">{lawyer.name}</p>
                        {lawyer.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white font-medium">{lawyer.rating.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">({lawyer.reviewCount})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {lawyer.specializations.slice(0, 2).map(spec => (
                      <span key={spec} className="px-2 py-0.5 bg-navy-900 text-slate-400 text-xs rounded-md truncate max-w-28">
                        {spec}
                      </span>
                    ))}
                    {lawyer.specializations.length > 2 && (
                      <span className="px-2 py-0.5 bg-navy-900 text-slate-500 text-xs rounded-md">
                        +{lawyer.specializations.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-semibold text-sm">{lawyer.price.toLocaleString()} UZS</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/user/lawyers/${lawyer.id}`)}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-xs min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <span>{t('user.lawyers.viewProfile' as any)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Popular Templates */}
      {popularTemplates.length > 0 && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">{t('common.navigation.templates' as any)}</h2>
            <button
              type="button"
              onClick={() => navigate('/user/documents/new')}
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 min-h-[44px] px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
            >
              <span>{t('common.misc.view' as any)}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {popularTemplates.map(template => (
                <div key={template.id} className="bg-navy-800 rounded-xl p-4 border border-navy-700 hover:border-navy-600 transition-colors flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-white truncate flex-1">{template.name}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${RISK_COLORS[template.riskLevel] || 'text-slate-400 bg-slate-500/10'}`}>
                      {template.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {template.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/user/documents/new?template=${template.id}`)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-xs min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{t('common.actions.create' as any)}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty States */}
      {recommendedLawyers.length === 0 && popularTemplates.length === 0 && pendingDocuments.length === 0 && pendingJobs.length === 0 && !loading && (
        <div className="text-center py-12 bg-navy-900 border border-navy-800 rounded-xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
          <p className="text-slate-500 text-sm mt-1">{t('user.dashboard.quickActions' as any)}</p>
        </div>
      )}
    </div>
  );
}
