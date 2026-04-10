import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import { transaction } from '../../../services/db';
import {
  Search,
  Filter,
  X,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  Heart,
  ExternalLink,
  Loader2,
  UserX,
  ChevronDown,
  ArrowUpDown,
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
  images: { profile: string | null };
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

type SortOption = 'rating' | 'price_asc' | 'price_desc' | 'name';

export default function LawyersPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useRealtimeSync();

  const [search, setSearch] = useState<string>('');
  const [filterVerified, setFilterVerified] = useState<boolean>(false);
  const [filterOnline, setFilterOnline] = useState<boolean>(false);
  const [filterRatingMin, setFilterRatingMin] = useState<number>(0);
  const [filterSpecialization, setFilterSpecialization] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const lawyers = useMemo((): Lawyer[] => {
    if (!data?.lawyers) return [];
    return data.lawyers;
  }, [data]);

  const savedLawyerIds = useMemo((): Set<string> => {
    if (!data?.users || !user) return new Set();
    const currentUser = data.users.find(u => u.id === user.userId);
    return new Set(currentUser?.savedLawyers || []);
  }, [data, user]);

  const filteredLawyers = useMemo(() => {
    let result = lawyers;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
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

    switch (sortBy) {
      case 'rating':
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case 'price_asc':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [lawyers, search, filterVerified, filterOnline, filterRatingMin, filterSpecialization, sortBy]);

  const hasActiveFilters = filterVerified || filterOnline || filterRatingMin > 0 || filterSpecialization !== '';

  const handleClearFilters = useCallback(() => {
    setFilterVerified(false);
    setFilterOnline(false);
    setFilterRatingMin(0);
    setFilterSpecialization('');
    setSearch('');
  }, []);

  const handleToggleSave = useCallback(async (lawyerId: string) => {
    if (!user || savingIds.has(lawyerId)) return;

    setSavingIds(prev => new Set(prev).add(lawyerId));

    try {
      await transaction<void>((db) => {
        const userIndex = db.users.findIndex(u => u.id === user.userId);
        if (userIndex === -1) throw new Error('User not found');

        const savedLawyers = db.users[userIndex].savedLawyers || [];
        const isSaved = savedLawyers.includes(lawyerId);

        if (isSaved) {
          db.users[userIndex].savedLawyers = savedLawyers.filter(id => id !== lawyerId);
        } else {
          db.users[userIndex].savedLawyers = [...savedLawyers, lawyerId];
        }

        return db;
      });
    } catch {
      // Revert on error handled by UI refresh
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(lawyerId);
        return next;
      });
    }
  }, [user, savingIds]);

  if (loading && lawyers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-12 bg-navy-900 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-900 rounded-xl border border-navy-800 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-navy-800 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-navy-800 rounded w-32" />
                  <div className="h-3 bg-navy-800 rounded w-20" />
                </div>
              </div>
              <div className="h-3 bg-navy-800 rounded w-24 mb-2" />
              <div className="h-10 bg-navy-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && lawyers.length === 0) {
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
            aria-label={t('user.lawyers.search' as any)}
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
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">{t('lawyers.search.filters' as any)}</span>
            {hasActiveFilters && <span className="w-2 h-2 bg-emerald-400 rounded-full" />}
          </button>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none pl-4 pr-10 py-3 bg-navy-900 border border-navy-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] cursor-pointer"
              aria-label="Sort by"
            >
              <option value="rating">{t('lawyers.search.sortByRating' as any)}</option>
              <option value="price_asc">{t('lawyers.search.sortByPrice' as any)} ↑</option>
              <option value="price_desc">{t('lawyers.search.sortByPrice' as any)} ↓</option>
              <option value="name">{t('common.labels.name' as any)}</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
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
                <option value="">{t('common.misc.all' as any)}</option>
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
      </p>

      {/* Lawyer Cards */}
      {filteredLawyers.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <UserX className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('user.lawyers.noLawyers' as any)}</p>
          <p className="text-slate-500 text-sm mt-1">{t('lawyers.search.noResultsSubtitle' as any)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLawyers.map(lawyer => {
            const isSaved = savedLawyerIds.has(lawyer.id);
            const isSaving = savingIds.has(lawyer.id);

            return (
              <div
                key={lawyer.id}
                className="bg-navy-900 border border-navy-800 rounded-xl p-4 hover:border-navy-700 transition-all"
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
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-medium text-white">{lawyer.rating.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">({lawyer.reviewCount})</span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${lawyer.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSave(lawyer.id)}
                    disabled={isSaving}
                    className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isSaved
                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                        : 'text-slate-500 hover:text-red-400 hover:bg-navy-800'
                    }`}
                    aria-label={isSaved ? 'Unsave lawyer' : 'Save lawyer'}
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {lawyer.specializations.slice(0, 4).map(spec => (
                    <span key={spec} className="px-2 py-1 bg-navy-800 text-slate-400 text-xs rounded-md">
                      {spec}
                    </span>
                  ))}
                  {lawyer.specializations.length > 4 && (
                    <span className="px-2 py-1 bg-navy-800 text-slate-500 text-xs rounded-md">
                      +{lawyer.specializations.length - 4}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-navy-800">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="text-emerald-400 font-semibold">
                      {lawyer.price.toLocaleString()} UZS
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lawyer.responseTime}
                    </span>
                    <span className="hidden sm:inline">
                      {lawyer.languages.join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/user/lawyers/${lawyer.id}`)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm font-medium min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <span>{t('user.lawyers.viewProfile' as any)}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
