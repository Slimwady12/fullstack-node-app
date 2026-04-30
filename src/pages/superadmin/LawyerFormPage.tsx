import { apiClient } from '../../lib/api';
import { useState, useCallback, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { transaction } from '../../services/db';
import axios from 'axios';
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Upload,
  X,
  Eye,
  Star,
  MessageSquare,
  Shield,
  User,
  GraduationCap,
  Briefcase,
  FileText,
} from 'lucide-react';

interface ReviewForm {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  caseType: string;
}

interface LawyerForm {
  name: string;
  phone: string;
  verified: boolean;
  specializations: string[];
  languages: string[];
  price: number;
  responseTime: string;
  online: boolean;
  bio: string;
  education: Array<{ institution: string; degree: string; year: number }>;
  experience: Array<{ company: string; position: string; from: string; to: string | null }>;
  license: { number: string; issuedAt: string; expiresAt: string };
  images: { profile: string | null; license: string | null; cv: string | null };
  reviews: Array<{ id: string; userId: string | null; name: string; rating: number; comment: string; date: string; caseType: string; isFake: boolean }>;
}

interface ValidationErrors {
  [key: string]: string;
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

const PHONE_DIGITS = 9;

function formatPhoneDigits(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 5) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

function calculateRating(reviews: Array<{ rating: number }>): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 100) / 100;
}

function createDefaultForm(): LawyerForm {
  return {
    name: '',
    phone: '', // Store only digits
    verified: false,
    specializations: [],
    languages: ['uz'],
    price: 0,
    responseTime: '1 hour',
    online: false,
    bio: '',
    education: [],
    experience: [],
    license: { number: '', issuedAt: '', expiresAt: '' },
    images: { profile: null, license: null, cv: null },
    reviews: [],
  };
}

export default function LawyerFormPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading: syncLoading } = useRealtimeSync();

  const [form, setForm] = useState<LawyerForm>(createDefaultForm());
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewForm, setReviewForm] = useState<ReviewForm>({
    id: '',
    name: '',
    rating: 5,
    comment: '',
    date: new Date().toISOString().split('T')[0],
    caseType: '',
  });
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const isEditMode = useMemo(() => !!id, [id]);

  useEffect(() => {
    if (id && data?.lawyers) {
      const existing = data.lawyers.find(l => l.id === id);
      if (existing) {
        setForm({
          name: existing.name,
          phone: existing.phone.replace(/^\+998/, ''), // Strip +998 prefix
          verified: existing.verified,
          specializations: [...existing.specializations],
          languages: [...existing.languages],
          price: existing.price,
          responseTime: existing.responseTime,
          online: existing.online,
          bio: existing.bio,
          education: existing.education.map(e => ({ ...e })),
          experience: existing.experience.map(e => ({ ...e })),
          license: { ...existing.license },
          images: { ...existing.images },
          reviews: existing.reviews.map(r => ({ ...r })),
        });
      }
    }
  }, [id, data]);

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const currentRating = useMemo(() => calculateRating(form.reviews), [form.reviews]);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== PHONE_DIGITS) {
      newErrors.phone = 'Enter a valid Uzbek phone number (+998XXXXXXXXX)';
    }

    if (form.price < 0) {
      newErrors.price = 'Price must be non-negative';
    }

    if (!form.responseTime.trim()) {
      newErrors.responseTime = 'Response time is required';
    }

    if (!form.bio.trim()) {
      newErrors.bio = 'Bio is required';
    }

    if (!form.license.number.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }

    if (!form.license.issuedAt) {
      newErrors.licenseIssuedAt = 'Issue date is required';
    }

    if (!form.license.expiresAt) {
      newErrors.licenseExpiresAt = 'Expiration date is required';
    }

    if (form.license.issuedAt && form.license.expiresAt && form.license.issuedAt >= form.license.expiresAt) {
      newErrors.licenseExpiresAt = 'Expiration must be after issue date';
    }

    for (const edu of form.education) {
      if (!edu.institution.trim()) newErrors.education = 'Institution is required for all education entries';
      if (!edu.degree.trim()) newErrors.education = 'Degree is required for all education entries';
      if (edu.year < 1900 || edu.year > new Date().getFullYear() + 5) newErrors.education = 'Valid year is required';
    }

    for (const exp of form.experience) {
      if (!exp.company.trim()) newErrors.experience = 'Company is required for all experience entries';
      if (!exp.position.trim()) newErrors.experience = 'Position is required for all experience entries';
      if (!exp.from) newErrors.experience = 'Start date is required for all experience entries';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSave = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaveStatus(null);

    const rating = calculateRating(form.reviews);

    try {
      await transaction<void>((db) => {
        const now = new Date().toISOString();
        const adminUser = db.users.find(u => u.roles.includes('admin'));
        const addedBy = adminUser?.id || 'system';

        const lawyerData = {
          id: id || crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: form.name.trim(),
          phone: `+998${phoneDigits}`, // Store with +998 prefix
          verified: form.verified,
          specializations: form.specializations,
          languages: form.languages,
          rating,
          reviewCount: form.reviews.length,
          casesCompleted: 0,
          price: form.price,
          responseTime: form.responseTime.trim(),
          online: form.online,
          bio: form.bio.trim(),
          education: form.education,
          experience: form.experience,
          license: form.license,
          images: form.images,
          reviews: form.reviews,
          addedBy: id ? (db.lawyers.find(l => l.id === id)?.addedBy || addedBy) : addedBy,
          addedAt: id ? (db.lawyers.find(l => l.id === id)?.addedAt || now) : now,
        };

        const existingIndex = db.lawyers.findIndex(l => l.id === (id || lawyerData.id));
        if (existingIndex >= 0) {
          db.lawyers[existingIndex] = lawyerData;
        } else {
          db.lawyers.push(lawyerData);
        }

        db.auditLogs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: 'admin',
          action: isEditMode ? 'LAWYER_UPDATED' : 'LAWYER_CREATED',
          details: {
            lawyerId: lawyerData.id,
            lawyerName: lawyerData.name,
            rating,
            reviewCount: lawyerData.reviewCount,
            verified: lawyerData.verified,
          },
          timestamp: now,
          activeRole: 'ADMIN',
        });

        return db;
      });

      setSaveStatus('success');
      setTimeout(() => navigate('/superadmin/lawyers'), 1000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [form, id, isEditMode, navigate, validate]);

  const handleFileUpload = useCallback(async (field: 'profile' | 'license' | 'cv', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrors(prev => ({ ...prev, [field]: 'Only images and PDF are allowed' }));
      return;
    }

    setUploading(field);
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setForm(prev => ({
          ...prev,
          images: { ...prev.images, [field]: response.data.data.filename },
        }));
      }
    } catch {
      setErrors(prev => ({ ...prev, [field]: 'Upload failed' }));
    } finally {
      setUploading(null);
    }
  }, []);

  const removeImage = useCallback((field: 'profile' | 'license' | 'cv') => {
    setForm(prev => ({
      ...prev,
      images: { ...prev.images, [field]: null },
    }));
  }, []);

  const addEducation = useCallback(() => {
    setForm(prev => ({
      ...prev,
      education: [...prev.education, { institution: '', degree: '', year: new Date().getFullYear() }],
    }));
  }, []);

  const removeEducation = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  }, []);

  const updateEducation = useCallback((index: number, updates: Partial<{ institution: string; degree: string; year: number }>) => {
    setForm(prev => ({
      ...prev,
      education: prev.education.map((e, i) => i === index ? { ...e, ...updates } : e),
    }));
  }, []);

  const addExperience = useCallback(() => {
    setForm(prev => ({
      ...prev,
      experience: [...prev.experience, { company: '', position: '', from: '', to: null }],
    }));
  }, []);

  const removeExperience = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  }, []);

  const updateExperience = useCallback((index: number, updates: Partial<{ company: string; position: string; from: string; to: string | null }>) => {
    setForm(prev => ({
      ...prev,
      experience: prev.experience.map((e, i) => i === index ? { ...e, ...updates } : e),
    }));
  }, []);

  const toggleSpecialization = useCallback((spec: string) => {
    setForm(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec],
    }));
  }, []);

  const toggleLanguage = useCallback((code: string) => {
    setForm(prev => ({
      ...prev,
      languages: prev.languages.includes(code)
        ? prev.languages.filter(l => l !== code)
        : [...prev.languages, code],
    }));
  }, []);

  const openReviewModal = useCallback((review?: { id: string; name: string; rating: number; comment: string; date: string; caseType: string }) => {
    if (review) {
      setReviewForm({
        id: review.id,
        name: review.name,
        rating: review.rating,
        comment: review.comment,
        date: review.date.split('T')[0],
        caseType: review.caseType,
      });
      setEditingReviewId(review.id);
    } else {
      setReviewForm({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: '',
        rating: 5,
        comment: '',
        date: new Date().toISOString().split('T')[0],
        caseType: '',
      });
      setEditingReviewId(null);
    }
    setShowReviewModal(true);
  }, []);

  const saveReview = useCallback(() => {
    if (!reviewForm.name.trim() || !reviewForm.comment.trim() || !reviewForm.caseType.trim()) {
      return;
    }

    setForm(prev => {
      const reviews = [...prev.reviews];
      const existingIndex = reviews.findIndex(r => r.id === reviewForm.id);

      const reviewData = {
        id: reviewForm.id,
        userId: null as string | null,
        name: reviewForm.name.trim(),
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        date: new Date(reviewForm.date).toISOString(),
        caseType: reviewForm.caseType.trim(),
        isFake: true,
      };

      if (existingIndex >= 0) {
        reviews[existingIndex] = reviewData;
      } else {
        reviews.push(reviewData);
      }

      const rating = calculateRating(reviews);
      return { ...prev, reviews, rating };
    });

    setShowReviewModal(false);
    setEditingReviewId(null);
  }, [reviewForm]);

  const deleteReview = useCallback((reviewId: string) => {
    setForm(prev => {
      const reviews = prev.reviews.filter(r => r.id !== reviewId);
      const rating = calculateRating(reviews);
      return { ...prev, reviews, rating };
    });
  }, []);

  if (syncLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/superadmin/lawyers')}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {isEditMode ? 'Edit Lawyer' : 'Add Lawyer'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm text-slate-400">Current rating: {currentRating.toFixed(2)} ({form.reviews.length} reviews)</span>
            </div>
          </div>
        </div>

        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Save failed</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} noValidate>
        {/* Basic Info */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <User className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">Basic Information</h2>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lawyer-name" className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                <input
                  id="lawyer-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.name ? 'border-red-500' : 'border-navy-700'}`}
                  placeholder="Full name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="lawyer-phone" className="block text-sm font-medium text-slate-300 mb-2">Phone *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none pointer-events-none font-mono" dir="ltr">
                    +998
                  </span>
                  <input
                    id="lawyer-phone"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
                      setForm(prev => ({ ...prev, phone: cleaned }));
                    }}
                    placeholder="XX XXX XX XX"
                    className={`w-full pl-20 pr-4 py-3 bg-navy-800 border rounded-xl text-white text-lg tracking-wider font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.phone ? 'border-red-500' : 'border-navy-700'}`}
                    aria-invalid={!!errors.phone}
                  />
                </div>
                {form.phone.length > 0 && (
                  <p className="mt-1 text-sm text-emerald-400 font-mono">
                    +998 {formatPhoneDigits(form.phone)}
                  </p>
                )}
                {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lawyer-price" className="block text-sm font-medium text-slate-300 mb-2">Price (UZS)</label>
                <input
                  id="lawyer-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm(prev => ({ ...prev, price: parseInt(e.target.value, 10) || 0 }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.price ? 'border-red-500' : 'border-navy-700'}`}
                  aria-invalid={!!errors.price}
                />
                {errors.price && <p className="mt-1 text-sm text-red-400">{errors.price}</p>}
              </div>
              <div>
                <label htmlFor="lawyer-response" className="block text-sm font-medium text-slate-300 mb-2">Response Time *</label>
                <input
                  id="lawyer-response"
                  type="text"
                  value={form.responseTime}
                  onChange={(e) => setForm(prev => ({ ...prev, responseTime: e.target.value }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.responseTime ? 'border-red-500' : 'border-navy-700'}`}
                  placeholder="e.g., 1 hour"
                  aria-invalid={!!errors.responseTime}
                />
                {errors.responseTime && <p className="mt-1 text-sm text-red-400">{errors.responseTime}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Specializations</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SPECIALIZATIONS.map(spec => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialization(spec)}
                    className={`px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      form.specializations.includes(spec)
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-navy-800 text-slate-400 border border-navy-700 hover:border-navy-600'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Languages</label>
              <div className="flex flex-wrap gap-2">
                {ALL_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`px-3 py-2 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      form.languages.includes(lang.code)
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-navy-800 text-slate-400 border border-navy-700 hover:border-navy-600'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="lawyer-bio" className="block text-sm font-medium text-slate-300 mb-2">Bio *</label>
              <textarea
                id="lawyer-bio"
                value={form.bio}
                onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                rows={3}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[100px] ${errors.bio ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="Professional biography..."
                aria-invalid={!!errors.bio}
              />
              {errors.bio && <p className="mt-1 text-sm text-red-400">{errors.bio}</p>}
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => setForm(prev => ({ ...prev, verified: e.target.checked }))}
                  className="w-4 h-4 rounded border-navy-700 bg-navy-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">Verified</span>
              </label>
              <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.online}
                  onChange={(e) => setForm(prev => ({ ...prev, online: e.target.checked }))}
                  className="w-4 h-4 rounded border-navy-700 bg-navy-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">Online</span>
              </label>
            </div>
          </div>
        </section>

        {/* Images */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Upload className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">Images & Documents</h2>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['profile', 'license', 'cv'] as const).map(field => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-300 mb-2 capitalize">{field}</label>
                {form.images[field] ? (
                  <div className="space-y-2">
                    {form.images[field]!.endsWith('.pdf') ? (
                      <div className="flex items-center gap-2 bg-navy-800 rounded-lg p-3 border border-navy-700">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300 truncate flex-1">{form.images[field]}</span>
                        <a
                          href={`/uploads/${form.images[field]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          aria-label={`Preview ${field}`}
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => removeImage(field)}
                          className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-red-400 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Remove ${field}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={`/uploads/${form.images[field]}`}
                          alt={field}
                          className="w-full h-32 object-cover rounded-lg border border-navy-700"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(field)}
                          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Remove ${field}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 bg-navy-800 border-2 border-dashed border-navy-700 rounded-lg cursor-pointer hover:border-emerald-500/30 transition-colors focus-within:ring-2 focus-within:ring-emerald-500">
                    {uploading === field ? (
                      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-500 mb-1" />
                        <span className="text-xs text-slate-500">Upload</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(field, e)}
                      className="hidden"
                      disabled={uploading === field}
                      aria-label={`Upload ${field}`}
                    />
                  </label>
                )}
                {errors[field] && <p className="mt-1 text-xs text-red-400">{errors[field]}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-emerald-500" />
              <h2 className="text-white font-semibold">Education</h2>
            </div>
            <button
              type="button"
              onClick={addEducation}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {form.education.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No education entries yet</p>
            ) : (
              form.education.map((edu, index) => (
                <div key={index} className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">Entry #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeEducation(index)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Remove education entry ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Institution</label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateEducation(index, { institution: e.target.value })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                        placeholder="University name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Degree</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEducation(index, { degree: e.target.value })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                        placeholder="Bachelor, Master, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Year</label>
                      <input
                        type="number"
                        value={edu.year}
                        onChange={(e) => updateEducation(index, { year: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                        placeholder="2020"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            {errors.education && <p className="text-sm text-red-400">{errors.education}</p>}
          </div>
        </section>

        {/* Experience */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              <h2 className="text-white font-semibold">Experience</h2>
            </div>
            <button
              type="button"
              onClick={addExperience}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {form.experience.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No experience entries yet</p>
            ) : (
              form.experience.map((exp, index) => (
                <div key={index} className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">Entry #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExperience(index)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Remove experience entry ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(index, { company: e.target.value })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Position</label>
                      <input
                        type="text"
                        value={exp.position}
                        onChange={(e) => updateExperience(index, { position: e.target.value })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                        placeholder="Job title"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">From</label>
                      <input
                        type="date"
                        value={exp.from}
                        onChange={(e) => updateExperience(index, { from: e.target.value })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To (or leave empty for current)</label>
                      <input
                        type="date"
                        value={exp.to || ''}
                        onChange={(e) => updateExperience(index, { to: e.target.value || null })}
                        className="w-full px-3 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            {errors.experience && <p className="text-sm text-red-400">{errors.experience}</p>}
          </div>
        </section>

        {/* License */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h2 className="text-white font-semibold">License</h2>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="license-number" className="block text-sm font-medium text-slate-300 mb-2">License Number *</label>
              <input
                id="license-number"
                type="text"
                value={form.license.number}
                onChange={(e) => setForm(prev => ({ ...prev, license: { ...prev.license, number: e.target.value } }))}
                className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.licenseNumber ? 'border-red-500' : 'border-navy-700'}`}
                placeholder="License number"
                aria-invalid={!!errors.licenseNumber}
              />
              {errors.licenseNumber && <p className="mt-1 text-sm text-red-400">{errors.licenseNumber}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="license-issued" className="block text-sm font-medium text-slate-300 mb-2">Issued Date *</label>
                <input
                  id="license-issued"
                  type="date"
                  value={form.license.issuedAt}
                  onChange={(e) => setForm(prev => ({ ...prev, license: { ...prev.license, issuedAt: e.target.value } }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.licenseIssuedAt ? 'border-red-500' : 'border-navy-700'}`}
                  aria-invalid={!!errors.licenseIssuedAt}
                />
                {errors.licenseIssuedAt && <p className="mt-1 text-sm text-red-400">{errors.licenseIssuedAt}</p>}
              </div>
              <div>
                <label htmlFor="license-expires" className="block text-sm font-medium text-slate-300 mb-2">Expires Date *</label>
                <input
                  id="license-expires"
                  type="date"
                  value={form.license.expiresAt}
                  onChange={(e) => setForm(prev => ({ ...prev, license: { ...prev.license, expiresAt: e.target.value } }))}
                  className={`w-full px-4 py-3 bg-navy-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px] ${errors.licenseExpiresAt ? 'border-red-500' : 'border-navy-700'}`}
                  aria-invalid={!!errors.licenseExpiresAt}
                />
                {errors.licenseExpiresAt && <p className="mt-1 text-sm text-red-400">{errors.licenseExpiresAt}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Fake Reviews Management */}
        <section className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h2 className="text-white font-semibold">Reviews Management</h2>
            </div>
            <button
              type="button"
              onClick={() => openReviewModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fake Review</span>
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-4 mb-4 p-3 bg-navy-800 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="text-lg font-bold text-white">{currentRating.toFixed(2)}</span>
              </div>
              <span className="text-sm text-slate-500">{form.reviews.length} reviews</span>
            </div>

            {form.reviews.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {form.reviews.map(review => (
                  <div key={review.id} className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">{review.name}</span>
                          {review.isFake && (
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-md font-medium">Fake</span>
                          )}
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
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-500">{review.caseType}</span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2">{review.comment}</p>
                        <p className="text-xs text-slate-600 mt-1">{new Date(review.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openReviewModal(review)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          aria-label={`Edit review by ${review.name}`}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReview(review.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Delete review by ${review.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sticky Save Button */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-navy-900/95 backdrop-blur-sm border-t border-navy-800 p-4 z-10" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-4xl mx-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all duration-200 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-navy-900"
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{isEditMode ? 'Update Lawyer' : 'Create Lawyer'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowReviewModal(false)} />
          <div className="relative w-full max-w-md bg-navy-900 border border-navy-800 rounded-2xl shadow-modal overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800">
              <h3 id="review-modal-title" className="text-lg font-semibold text-white">
                {editingReviewId ? 'Edit Review' : 'Add Fake Review'}
              </h3>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="review-name" className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  id="review-name"
                  type="text"
                  value={reviewForm.name}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  placeholder="Reviewer name"
                />
              </div>

              <div>
                <label htmlFor="review-rating" className="block text-sm font-medium text-slate-300 mb-2">Rating: {reviewForm.rating.toFixed(1)}</label>
                <input
                  id="review-rating"
                  type="range"
                  min={1}
                  max={5}
                  step={0.1}
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1</span>
                  <span>5</span>
                </div>
              </div>

              <div>
                <label htmlFor="review-comment" className="block text-sm font-medium text-slate-300 mb-2">Comment</label>
                <textarea
                  id="review-comment"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y min-h-[80px]"
                  placeholder="Review comment..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="review-date" className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                  <input
                    id="review-date"
                    type="date"
                    value={reviewForm.date}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                  />
                </div>
                <div>
                  <label htmlFor="review-case" className="block text-sm font-medium text-slate-300 mb-2">Case Type</label>
                  <input
                    id="review-case"
                    type="text"
                    value={reviewForm.caseType}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, caseType: e.target.value }))}
                    className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
                    placeholder="e.g., Contract"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-navy-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-3 bg-navy-800 hover:bg-navy-700 text-slate-300 font-medium rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReview}
                disabled={!reviewForm.name.trim() || !reviewForm.comment.trim() || !reviewForm.caseType.trim()}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-700 disabled:text-slate-500 text-white font-semibold rounded-xl min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {editingReviewId ? 'Update' : 'Add Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
