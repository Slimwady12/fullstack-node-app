import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import { transaction } from '../../../services/db';
import axios from 'axios';
import {
  ArrowLeft,
  Star,
  Heart,
  CheckCircle2,
  MessageSquare,
  Loader2,
  AlertCircle,
  Shield,
  GraduationCap,
  Briefcase,
  Globe,
  Clock,
  MapPin,
  UserCircle,
  X,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';

interface Review {
  id: string;
  userId: string | null;
  name: string;
  rating: number;
  comment: string;
  date: string;
  caseType: string;
  isFake: boolean;
}

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
  images: { profile: string | null };
  reviews: Review[];
}

type TabType = 'about' | 'experience' | 'education' | 'reviews';

const TABS: { key: TabType; labelKey: string }[] = [
  { key: 'about', labelKey: 'lawyers.profile.overview' },
  { key: 'experience', labelKey: 'lawyers.profile.experience' },
  { key: 'education', labelKey: 'lawyers.profile.education' },
  { key: 'reviews', labelKey: 'lawyers.profile.reviews' },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function LawyerProfilePage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error: syncError, refresh } = useRealtimeSync();

  const [activeTab, setActiveTab] = useState<TabType>('about');
  const [saving, setSaving] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewCaseType, setReviewCaseType] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  const lawyer = useMemo((): Lawyer | null => {
    if (!data?.lawyers || !id) return null;
    const l = data.lawyers.find(law => law.id === id);
    if (!l) return null;
    return l as Lawyer;
  }, [data, id]);

  const isSaved = useMemo(() => {
    if (!data?.users || !user || !id) return false;
    const currentUser = data.users.find(u => u.id === user.userId);
    return (currentUser?.savedLawyers || []).includes(id);
  }, [data, user, id]);

  const canReview = useMemo(() => {
    if (!data || !user || !id || !lawyer) return false;

    const alreadyReviewed = lawyer.reviews.some(r => r.userId === user.userId);
    if (alreadyReviewed) return false;

    const reviewedDoc = data.documents?.some(
      d => d.userId === user.userId && d.review?.lawyerId === id && d.status === 'REVIEWED'
    );

    const completedJob = data.jobs?.some(
      j => j.userId === user.userId && j.assignedLawyerId === id && j.status === 'COMPLETED'
    );

    return !!(reviewedDoc || completedJob);
  }, [data, user, id, lawyer]);

  const handleToggleSave = useCallback(async () => {
    if (!user || !id || saving) return;

    setSaving(true);

    try {
      await transaction<void>((db) => {
        const userIndex = db.users.findIndex(u => u.id === user.userId);
        if (userIndex === -1) throw new Error('User not found');

        const savedLawyers = db.users[userIndex].savedLawyers || [];
        const isSaved = savedLawyers.includes(id);

        if (isSaved) {
          db.users[userIndex].savedLawyers = savedLawyers.filter(lid => lid !== id);
        } else {
          db.users[userIndex].savedLawyers = [...savedLawyers, id];
        }

        return db;
      });
    } catch {
      // Error handled by UI refresh
    } finally {
      setSaving(false);
    }
  }, [user, id, saving]);

  const handleContact = useCallback(() => {
    if (!id || !user) return;
    navigate(`/user/messages/new?lawyerId=${id}`);
  }, [id, user, navigate]);

  const handleRateLawyer = useCallback(() => {
    setReviewRating(5);
    setReviewComment('');
    setReviewCaseType('');
    setReviewError(null);
    setReviewSuccess(false);
    setShowReviewModal(true);
  }, []);

  const submitReview = useCallback(async () => {
    if (!user || !id || !lawyer) return;

    setReviewSubmitting(true);
    setReviewError(null);
    setReviewSuccess(false);

    try {
      const response = await apiClient.post('/api/reviews', {
        lawyerId: id,
        userId: user.userId,
        name: user.name,
        rating: reviewRating,
        comment: reviewComment.trim() || 'No comment',
        caseType: reviewCaseType.trim() || 'General',
        isFake: false,
      });

      if (response.data.success) {
        setReviewSuccess(true);
        setTimeout(() => {
          setShowReviewModal(false);
          refresh();
        }, 1500);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string };
      if (axiosErr.response?.status === 409) {
        setReviewError(t('errors.duplicate' as any));
      } else {
        setReviewError(axiosErr.response?.data?.error || axiosErr.response?.data?.message || t('errors.unexpected' as any));
      }
    } finally {
      setReviewSubmitting(false);
    }
  }, [user, id, lawyer, reviewRating, reviewComment, reviewCaseType, t, refresh]);

  useEffect(() => {
    if (!loading && !lawyer && id) {
      navigate('/user/lawyers', { replace: true });
    }
  }, [loading, lawyer, id, navigate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
        <UserCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 font-medium">{t('errors.notFound' as any)}</p>
        <button
          type="button"
          onClick={() => navigate('/user/lawyers')}
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
        <button
          type="button"
          onClick={() => navigate('/user/lawyers')}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={t('common.actions.back' as any)}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSave}
            disabled={saving}
            className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              isSaved ? 'text-red-400 hover:text-red-300' : 'text-slate-400 hover:text-red-400'
            }`}
            aria-label={isSaved ? 'Unsave lawyer' : 'Save lawyer'}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />}
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-navy-900 border border-navy-800 rounded-xl p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-2xl">
            {lawyer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white truncate">{lawyer.name}</h1>
              {lawyer.verified && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-semibold text-white">{lawyer.rating.toFixed(1)}</span>
                <span className="text-xs text-slate-500">({lawyer.reviewCount} {lawyer.reviewCount === 1 ? 'review' : 'reviews'})</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${lawyer.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-500">{lawyer.online ? t('common.status.online' as any) : t('common.status.offline' as any)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{lawyer.price.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">UZS</p>
          </div>
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{lawyer.responseTime}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('lawyers.profile.responseTime' as any)}</p>
          </div>
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{lawyer.casesCompleted}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('lawyers.profile.casesCompleted' as any)}</p>
          </div>
          <div className="bg-navy-800 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{lawyer.specializations.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('lawyers.profile.specializations' as any)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleContact}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <MessageSquare className="w-5 h-5" />
            <span>{t('lawyers.profile.contact' as any)}</span>
          </button>
          {canReview && (
            <button
              type="button"
              onClick={handleRateLawyer}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-navy-800 hover:bg-navy-700 text-emerald-400 font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Star className="w-5 h-5" />
              <span>{t('lawyers.review.title' as any)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-navy-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 min-h-[48px] text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 relative ${
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

      {/* Tab Content */}
      {activeTab === 'about' && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-5">
          {lawyer.bio && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">{t('lawyers.profile.bio' as any)}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{lawyer.bio}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('lawyers.profile.specializations' as any)}</h3>
            <div className="flex flex-wrap gap-2">
              {lawyer.specializations.map(spec => (
                <span key={spec} className="px-3 py-1.5 bg-navy-800 text-slate-300 text-sm rounded-lg border border-navy-700">
                  {spec}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('lawyers.profile.languages' as any)}</h3>
            <div className="flex flex-wrap gap-2">
              {lawyer.languages.map(lang => (
                <span key={lang} className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 text-slate-300 text-sm rounded-lg border border-navy-700">
                  <Globe className="w-3 h-3" />
                  {lang === 'uz' ? "O'zbekcha" : lang === 'ru' ? 'Русский' : 'English'}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('lawyers.profile.license' as any)}</h3>
            <div className="bg-navy-800 rounded-lg p-4 border border-navy-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('common.labels.id' as any)}</span>
                <span className="text-sm text-white font-mono">{lawyer.license.number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('common.labels.date' as any)}</span>
                <span className="text-sm text-slate-300">{formatDate(lawyer.license.issuedAt)} → {formatDate(lawyer.license.expiresAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'experience' && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-4">
          {lawyer.experience.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">{t('common.misc.noData' as any)}</p>
          ) : (
            lawyer.experience.map((exp, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy-800 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{exp.position}</p>
                  <p className="text-sm text-slate-400">{exp.company}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(exp.from)} — {exp.to ? formatDate(exp.to) : t('lawyers.profile.current' as any)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'education' && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-4">
          {lawyer.education.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">{t('common.misc.noData' as any)}</p>
          ) : (
            lawyer.education.map((edu, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy-800 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{edu.degree}</p>
                  <p className="text-sm text-slate-400">{edu.institution}</p>
                  <p className="text-xs text-slate-500 mt-1">{edu.year}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              {t('lawyers.profile.reviews' as any)} ({lawyer.reviews.length})
            </h2>
            {canReview && (
              <button
                type="button"
                onClick={handleRateLawyer}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Star className="w-4 h-4" />
                <span>{t('lawyers.review.title' as any)}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-navy-800">
            {lawyer.reviews.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{t('common.misc.noData' as any)}</p>
              </div>
            ) : (
              lawyer.reviews.map(review => (
                <div key={review.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{review.name}</span>
                      {review.isFake && (
                        <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] rounded font-medium">Demo</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(review.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.floor(review.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">{review.rating.toFixed(1)}</span>
                    {review.caseType && (
                      <>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500">{review.caseType}</span>
                      </>
                    )}
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed">{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
          <div className="absolute inset-0 bg-black/70" onClick={() => !reviewSubmitting && setShowReviewModal(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
              <h3 id="review-modal-title" className="text-lg font-semibold text-white">{t('lawyers.review.title' as any)}</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={reviewSubmitting}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={t('common.actions.close' as any)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewSuccess ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-semibold">{t('lawyers.review.success' as any)}</p>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Rating Stars */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t('lawyers.review.rating' as any)}</label>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReviewRating(i + 1)}
                        className="w-11 h-11 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg"
                        aria-label={`${i + 1} stars`}
                      >
                        <Star className={`w-8 h-8 ${i < reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label htmlFor="review-comment" className="block text-sm font-medium text-slate-300 mb-2">
                    {t('lawyers.review.comment' as any)} ({t('common.misc.optional' as any)})
                  </label>
                  <textarea
                    id="review-comment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[80px]"
                    placeholder={t('lawyers.review.commentPlaceholder' as any)}
                  />
                </div>

                {/* Case Type */}
                <div>
                  <label htmlFor="review-case" className="block text-sm font-medium text-slate-300 mb-2">
                    {t('lawyers.review.caseType' as any)}
                  </label>
                  <input
                    id="review-case"
                    type="text"
                    value={reviewCaseType}
                    onChange={(e) => setReviewCaseType(e.target.value)}
                    className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                    placeholder={t('lawyers.review.caseTypePlaceholder' as any)}
                  />
                </div>

                {/* Error */}
                {reviewError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2" role="alert">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{reviewError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={reviewSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-busy={reviewSubmitting}
                >
                  {reviewSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('common.misc.loading' as any)}</span>
                    </>
                  ) : (
                    <>
                      <Star className="w-5 h-5" />
                      <span>{t('lawyers.review.submit' as any)}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Actions (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-navy-900/95 backdrop-blur-sm border-t border-navy-800 p-3 z-10 md:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleContact}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <MessageSquare className="w-5 h-5" />
            <span>{t('lawyers.profile.contact' as any)}</span>
          </button>
          {canReview && (
            <button
              type="button"
              onClick={handleRateLawyer}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-emerald-400 font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Star className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
