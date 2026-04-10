import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Database,
  Cpu,
  Zap,
  FileText,
  Users,
  Scale,
  ClipboardCheck,
  Plus,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
  activeRole: string;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export default function DashboardPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, lastSync } = useRealtimeSync();

  const stats = useMemo(() => {
    if (!data) return { templates: 0, lawyers: 0, users: 0, pendingDocs: 0, activeChats: 0 };

    return {
      templates: data.templates?.length || 0,
      lawyers: data.lawyers?.length || 0,
      users: data.users?.length || 0,
      pendingDocs: data.documents?.filter(d => d.status === 'PENDING').length || 0,
      activeChats: data.aiChats?.length || 0,
    };
  }, [data]);

  const recentAuditLogs = useMemo((): AuditLogEntry[] => {
    if (!data || !data.auditLogs) return [];
    return [...data.auditLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [data]);

  const isDbConnected = useMemo(() => data !== null, [data]);
  const isOpenAiConfigured = useMemo(() => {
    return !!data?.systemConfig?.ai?.openaiApiKey;
  }, [data]);

  const handleNavigateTemplate = useCallback(() => {
    navigate('/superadmin/automations');
  }, [navigate]);

  const handleNavigateSystem = useCallback(() => {
    navigate('/superadmin/system');
  }, [navigate]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-navy-800 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-navy-800 rounded-lg w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl p-5 border border-navy-800">
              <div className="h-4 bg-navy-800 rounded w-20 mb-3" />
              <div className="h-8 bg-navy-800 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-6">
          <div className="h-5 bg-navy-800 rounded w-32 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-navy-800 rounded mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
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
      <div className="bg-gradient-to-r from-emerald-600/20 to-navy-800 border border-emerald-500/20 rounded-2xl p-5 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">
          {t('superadmin.dashboard.welcome' as any)}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {t('superadmin.dashboard.stats' as any)}
        </p>
        {lastSync && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('common.misc.loading' as any).includes('Loading') ? 'Last sync' : 'Oxirgi sinxronlash'}: {formatTimestamp(lastSync)}</span>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border min-h-[52px] ${
          isDbConnected ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isDbConnected ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <Database className={`w-5 h-5 ${isDbConnected ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium ${isDbConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isDbConnected ? t('common.status.active' as any) : t('common.status.offline' as any)}
            </p>
            <p className="text-xs text-slate-500 truncate">Database</p>
          </div>
        </div>

        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border min-h-[52px] ${
          isOpenAiConfigured ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
        }`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isOpenAiConfigured ? 'bg-emerald-500/20' : 'bg-yellow-500/20'
          }`}>
            <Cpu className={`w-5 h-5 ${isOpenAiConfigured ? 'text-emerald-400' : 'text-yellow-400'}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium ${isOpenAiConfigured ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {isOpenAiConfigured ? t('common.status.active' as any) : t('common.status.pending' as any)}
            </p>
            <p className="text-xs text-slate-500 truncate">OpenAI API</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-navy-900 border-navy-700 min-h-[52px]">
          <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-300">
              {lastSync ? '< 1s' : '—'}
            </p>
            <p className="text-xs text-slate-500 truncate">Latency</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label={t('common.navigation.templates' as any)}
          value={stats.templates}
          color="emerald"
        />
        <StatCard
          icon={<Scale className="w-5 h-5" />}
          label={t('common.navigation.lawyers' as any)}
          value={stats.lawyers}
          color="blue"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label={t('common.labels.user' as any)}
          value={stats.users}
          color="purple"
        />
        <StatCard
          icon={<ClipboardCheck className="w-5 h-5" />}
          label={t('user.documents.pendingReview' as any)}
          value={stats.pendingDocs}
          color="yellow"
        />
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-800">
          <h2 className="text-white font-semibold">{t('superadmin.dashboard.recentActivity' as any)}</h2>
        </div>

        {recentAuditLogs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-500">{t('common.misc.noData' as any)}</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-800">
            {/* Desktop Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">{t('common.labels.name' as any)}</div>
              <div className="col-span-2">{t('common.labels.user' as any)}</div>
              <div className="col-span-4">{t('common.labels.description' as any)}</div>
              <div className="col-span-3">{t('common.labels.time' as any)}</div>
            </div>

            {recentAuditLogs.map(log => (
              <div key={log.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-3.5 min-h-[52px] items-center hover:bg-navy-800/50 transition-colors">
                <div className="md:col-span-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-navy-800 text-xs font-mono text-emerald-400 max-w-full truncate">
                    {log.action}
                  </span>
                </div>
                <div className="md:col-span-2 text-sm text-slate-400 truncate">
                  {log.userId.slice(0, 12)}...
                </div>
                <div className="md:col-span-4 text-sm text-slate-500 truncate" title={JSON.stringify(log.details)}>
                  {truncate(JSON.stringify(log.details), 60)}
                </div>
                <div className="md:col-span-3 text-sm text-slate-500">
                  {formatTimestamp(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={handleNavigateTemplate}
          className="flex items-center gap-4 px-5 py-5 bg-navy-900 hover:bg-navy-800 border border-navy-800 hover:border-emerald-500/30 rounded-xl transition-all duration-200 min-h-[56px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 group-hover:bg-emerald-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Plus className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-left">
            <p className="text-white font-medium">{t('superadmin.templates.create' as any)}</p>
            <p className="text-slate-500 text-sm mt-0.5">{t('superadmin.templates.title' as any)}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleNavigateSystem}
          className="flex items-center gap-4 px-5 py-5 bg-navy-900 hover:bg-navy-800 border border-navy-800 hover:border-emerald-500/30 rounded-xl transition-all duration-200 min-h-[56px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600/10 group-hover:bg-emerald-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Settings className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-left">
            <p className="text-white font-medium">{t('superadmin.dashboard.systemSettings' as any)}</p>
            <p className="text-slate-500 text-sm mt-0.5">{t('superadmin.systemConfig.title' as any)}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'emerald' | 'blue' | 'purple' | 'yellow';
}

const colorMap = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
};

function StatCard({ icon, label, value, color }: StatCardProps): JSX.Element {
  const colors = colorMap[color];

  return (
    <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 md:p-5 hover:border-navy-700 transition-colors">
      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-3 ${colors.text}`}>
        {icon}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-white">{value}</p>
      <p className="text-slate-500 text-xs md:text-sm mt-1 truncate">{label}</p>
    </div>
  );
}
