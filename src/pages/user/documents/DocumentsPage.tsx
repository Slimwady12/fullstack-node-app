import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import {
  FileText,
  Plus,
  Search,
  Filter,
  X,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  Shield,
  Globe,
  AlertTriangle,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  status: string;
  version: number;
}

interface UserDocument {
  id: string;
  templateId: string;
  templateName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type TabType = 'create' | 'my';

const TABS: { key: TabType; labelKey: string }[] = [
  { key: 'create', labelKey: 'common.actions.create' },
  { key: 'my', labelKey: 'user.documents.title' },
];

const RISK_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  YELLOW: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  RED: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const RISK_ICONS: Record<string, React.ReactElement> = {
  GREEN: <CheckCircle2 className="w-3 h-3" />,
  YELLOW: <AlertTriangle className="w-3 h-3" />,
  RED: <XCircle className="w-3 h-3" />,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-500/10',
  REVIEWED: 'text-blue-400 bg-blue-500/10',
  COMPLETED: 'text-emerald-400 bg-emerald-500/10',
  CANCELLED: 'text-slate-400 bg-slate-500/10',
};

const STATUS_ICONS: Record<string, React.ReactElement> = {
  PENDING: <Clock className="w-3.5 h-3.5" />,
  REVIEWED: <Eye className="w-3.5 h-3.5" />,
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5" />,
};

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function DocumentsPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useRealtimeSync();

  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [search, setSearch] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const templates = useMemo((): Template[] => {
    if (!data?.templates) return [];
    return data.templates.filter(t => t.status === 'ACTIVE');
  }, [data]);

  const userDocuments = useMemo((): UserDocument[] => {
    if (!data?.documents || !user) return [];
    return data.documents
      .filter(d => d.userId === user.userId)
      .map(doc => {
        const template = data.templates?.find(t => t.id === doc.templateId);
        return {
          id: doc.id,
          templateId: doc.templateId,
          templateName: template?.name || doc.templateId.slice(0, 16),
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, user]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    if (filterCategory) {
      result = result.filter(t => t.category === filterCategory);
    }

    if (filterRisk) {
      result = result.filter(t => t.riskLevel === filterRisk);
    }

    return result;
  }, [templates, search, filterCategory, filterRisk]);

  const filteredDocuments = useMemo(() => {
    let result = userDocuments;

    if (filterStatus) {
      result = result.filter(d => d.status === filterStatus);
    }

    return result;
  }, [userDocuments, filterStatus]);

  const hasActiveFilters = filterCategory !== '' || filterRisk !== '' || filterStatus !== '';

  const handleClearFilters = useCallback(() => {
    setFilterCategory('');
    setFilterRisk('');
    setFilterStatus('');
    setSearch('');
  }, []);

  const handleUseTemplate = useCallback((templateId: string) => {
    navigate(`/user/documents/wizard?templateId=${templateId}`);
  }, [navigate]);

  const handleViewDocument = useCallback((docId: string) => {
    navigate(`/user/documents/${docId}`);
  }, [navigate]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-12 bg-navy-900 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-5">
              <div className="h-4 bg-navy-800 rounded w-32 mb-3" />
              <div className="h-3 bg-navy-800 rounded w-full mb-2" />
              <div className="h-3 bg-navy-800 rounded w-20" />
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b border-navy-800">
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

      {/* Create Tab */}
      {activeTab === 'create' && (
        <div className="space-y-4">
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
                aria-label="Search templates"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                hasActiveFilters
                  ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
              }`}
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4" />
              <span>{t('common.actions.filter' as any)}</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-emerald-400 rounded-full" />}
            </button>
          </div>

          {showFilters && (
            <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('common.labels.category' as any)}</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                  >
                    <option value="">All</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('documents.status.riskLevel' as any) || 'Risk Level'}</label>
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                  >
                    <option value="">All</option>
                    <option value="GREEN">Green</option>
                    <option value="YELLOW">Yellow</option>
                    <option value="RED">Red</option>
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
                >
                  <X className="w-3 h-3" />
                  <span>{t('lawyers.search.clearFilters' as any)}</span>
                </button>
              )}
            </div>
          )}

          {/* Template Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">{t('common.misc.noResults' as any)}</p>
              <p className="text-slate-500 text-sm mt-1">No active templates available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <div key={template.id} className="bg-navy-900 border border-navy-800 rounded-xl p-5 hover:border-navy-700 transition-all flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 flex-1">{template.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border flex-shrink-0 ${RISK_COLORS[template.riskLevel] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                      {RISK_ICONS[template.riskLevel]}
                      {template.riskLevel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.description}</p>

                  <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {template.category}
                    </span>
                    <span>v{template.version}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUseTemplate(template.id)}
                    className="mt-auto flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('common.actions.create' as any)}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Documents Tab */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            {['PENDING', 'REVIEWED', 'COMPLETED', 'CANCELLED'].map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  filterStatus === status
                    ? `${STATUS_COLORS[status]} border border-current`
                    : 'bg-navy-900 text-slate-500 border border-navy-800 hover:border-navy-700'
                }`}
              >
                {STATUS_ICONS[status]}
                <span>{t(`common.status.${status.toLowerCase()}` as any)}</span>
              </button>
            ))}
            {filterStatus && (
              <button
                type="button"
                onClick={() => setFilterStatus('')}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-white min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Document List */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
              <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">{t('user.documents.noDocuments' as any)}</p>
              <p className="text-slate-500 text-sm mt-1">{t('user.documents.noDocumentsSubtitle' as any)}</p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Plus className="w-4 h-4" />
                <span>{t('user.documents.createFirst' as any)}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="bg-navy-900 border border-navy-800 rounded-xl p-4 hover:border-navy-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-white truncate">{doc.templateName}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>Created: {formatDate(doc.createdAt)}</span>
                        <span>Updated: {formatDate(doc.updatedAt)}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${STATUS_COLORS[doc.status] || 'text-slate-400 bg-slate-500/10'}`}>
                      {STATUS_ICONS[doc.status]}
                      {doc.status}
                    </span>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleViewDocument(doc.id)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{t('common.actions.view' as any)}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
