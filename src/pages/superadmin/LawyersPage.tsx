import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Search,
  Plus,
  Edit3,
  Star,
  MapPin,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  UserX,
  Filter,
  ChevronDown,
  X,
} from 'lucide-react';

interface Lawyer {
  id: string;
  name: string;
  phone: string;
  verified: boolean;
  specializations: string[];
  languages: string[];
  rating: number;
  reviewCount: number;
  casesCompleted: number;
  price: number;
  responseTime: string;
  online: boolean;
  bio: string;
  education: Array<{ institution: string; degree: string; year: number }>;
  experience: Array<{ company: string; position: string; from: string; to: string | null }>;
  license: { number: string; issuedAt: string; expiresAt: string };
  images: { profile: string | null; license: string | null; cv: string | null };
  reviews: Array<{ id: string; userId: string | null; name: string; rating: number; comment: string; date: string; caseType: string; isFake: boolean }>;
  addedBy: string;
  addedAt: string;
}

const ALL_SPECIALIZATIONS = [
  'Corporate Law',
  'Employment Law',
  'Real Estate',
  'Criminal Defense',
  'Family Law',
  'Tax Law',
  'Immigration',
  'Contract Law',
  'Intellectual Property',
  'Civil Litigation',
];

const ALL_LANGUAGES = [
  { code: 'uz', label: 'O\'zbekcha' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export default function LawyersPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data, loading, error } = useRealtimeSync();

  const [search, setSearch] = useState<string>('');
  const [filterVerified, setFilterVerified] = useState<boolean>(false);
  const [filterOnline, setFilterOnline] = useState<boolean>(false);
  const [filterRatingMin, setFilterRatingMin] = useState<number>(0);
  const [filterSpecialization, setFilterSpecialization] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const lawyers = useMemo((): Lawyer[] => {
    if (!data?.lawyers) return [];
    return data.lawyers;
  }, [data]);

  const filteredLawyers = useMemo(() => {
    let result = lawyers;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.specializations.some(s => s.toLowerCase().includes(q))
      );
    }

    if (filterVerified) {
      result = result.filter(l => l.verified);
    }

    if (filterOnline) {
      result = result.filter(l => l.online);
    }

    if (filterRatingMin > 0) {
      result = result.filter(l => l.rating >= filterRatingMin);
    }

    if (filterSpecialization) {
      result = result.filter(l => l.specializations.includes(filterSpecialization));
    }

    return result;
  }, [lawyers, search, filterVerified, filterOnline, filterRatingMin, filterSpecialization]);

  const hasActiveFilters = filterVerified || filterOnline || filterRatingMin > 0 || filterSpecialization !== '';

  const handleClearFilters = useCallback(() => {
    setFilterVerified(false);
    setFilterOnline(false);
    setFilterRatingMin(0);
    setFilterSpecialization('');
    setSearch('');
  }, []);

  if (loading && lawyers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-12 bg-navy-900 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-navy-800 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-navy-800 rounded w-32" />
                  <div className="h-3 bg-navy-800 rounded w-20" />
                </div>
              </div>
              <div className="h-3 bg-navy-800 rounded w-24 mb-2" />
              <div className="h-3 bg-navy-800 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && lawyers.length === 0) {
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
      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('user.lawyers.searchPlaceholder' as any)}
            className="w-full pl-12 pr-4 py-3 bg-navy-900 border border-navy-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px]"
            aria-label="Search lawyers"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 border rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              hasActiveFilters
                ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                : 'bg-navy-900 border-navy-800 text-slate-400 hover:border-navy-700'
            }`}
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">{t('lawyers.search.filters' as any)}</span>
            {hasActiveFilters && <span className="w-2 h-2 bg-emerald-400 rounded-full" />}
          </button>
          <button
            type="button"
            onClick={() => navigate('/superadmin/lawyers/new')}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('superadmin.lawyers.add' as any)}</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={filterVerified}
                onChange={(e) => setFilterVerified(e.target.checked)}
                className="w-4 h-4 rounded border-navy-700 bg-navy-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">{t('common.status.verified' as any)}</span>
            </label>
            <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={filterOnline}
                onChange={(e) => setFilterOnline(e.target.checked)}
                className="w-4 h-4 rounded border-navy-700 bg-navy-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">{t('common.status.online' as any)}</span>
            </label>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('lawyers.search.rating' as any)}</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={filterRatingMin || ''}
                onChange={(e) => setFilterRatingMin(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('lawyers.search.specialization' as any)}</label>
              <select
                value={filterSpecialization}
                onChange={(e) => setFilterSpecialization(e.target.value)}
                className="w-full px-3 py-2.5 bg-navy-800 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              >
                <option value="">All</option>
                {ALL_SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        {filteredLawyers.length} {filteredLawyers.length === 1 ? 'lawyer' : 'lawyers'}
        {search && ` matching "${search}"`}
        {hasActiveFilters && ' with active filters'}
      </p>

      {/* Lawyer Cards */}
      {filteredLawyers.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <UserX className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('common.misc.noResults' as any)}</p>
          <p className="text-slate-500 text-sm mt-1">{t('lawyers.search.noResultsSubtitle' as any)}</p>
          {lawyers.length === 0 && (
            <button
              type="button"
              onClick={() => navigate('/superadmin/lawyers/new')}
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>{t('superadmin.lawyers.add' as any)}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLawyers.map(lawyer => (
            <div
              key={lawyer.id}
              className="bg-navy-900 border border-navy-800 rounded-xl p-5 hover:border-navy-700 transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-lg">
                  {lawyer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold truncate">{lawyer.name}</h3>
                    {lawyer.verified && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-slate-500 text-xs font-mono mt-0.5">{lawyer.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-medium text-white">{lawyer.rating.toFixed(1)}</span>
                  <span className="text-xs text-slate-500">({lawyer.reviewCount})</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${lawyer.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {lawyer.specializations.slice(0, 3).map(spec => (
                  <span key={spec} className="px-2 py-1 bg-navy-800 text-slate-400 text-xs rounded-md truncate max-w-32">
                    {spec}
                  </span>
                ))}
                {lawyer.specializations.length > 3 && (
                  <span className="px-2 py-1 bg-navy-800 text-slate-500 text-xs rounded-md">
                    +{lawyer.specializations.length - 3}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-navy-800">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-emerald-400 font-semibold">
                    {lawyer.price.toLocaleString()} UZS
                  </span>
                  <span>{lawyer.responseTime}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/superadmin/lawyers/${lawyer.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 hover:bg-emerald-600/10 hover:text-emerald-400 text-slate-400 rounded-lg text-sm min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={`Edit ${lawyer.name}`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('common.actions.edit' as any)}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
