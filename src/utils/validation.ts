import { z } from 'zod';

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;
const phoneUzRegex = /^\+998\d{9}$/;
const urlRegex = /^https?:\/\/.+/;

export const userProfileSchema = z.object({
  email: z.string().email().nullable(),
  avatar: z.string().regex(urlRegex).nullable(),
  language: z.enum(['uz', 'ru', 'en']),
});

export const userNotificationsSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  quietHours: z.object({
    start: z.string().regex(hhmmRegex),
    end: z.string().regex(hhmmRegex),
  }),
});

export const userPrivacySchema = z.object({
  showPhone: z.boolean(),
  showEmail: z.boolean(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().regex(phoneUzRegex),
  name: z.string().min(1),
  roles: z.array(z.enum(['user', 'lawyer', 'admin'])),
  joinedAt: z.string().regex(iso8601Regex),
  savedLawyers: z.array(z.string().uuid()),
  profile: userProfileSchema,
  notifications: userNotificationsSchema,
  privacy: userPrivacySchema,
});

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'ai']),
  content: z.string().min(1),
  timestamp: z.string().regex(iso8601Regex),
  attachments: z.array(z.string()),
});

export const aiChatSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  messages: z.array(aiChatMessageSchema),
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  year: z.number().int().positive(),
});

export const experienceSchema = z.object({
  company: z.string().min(1),
  position: z.string().min(1),
  from: z.string().regex(iso8601Regex),
  to: z.string().regex(iso8601Regex).nullable(),
});

export const licenseSchema = z.object({
  number: z.string().min(1),
  issuedAt: z.string().regex(iso8601Regex),
  expiresAt: z.string().regex(iso8601Regex),
});

export const lawyerImagesSchema = z.object({
  profile: z.string().regex(urlRegex).nullable(),
  license: z.string().regex(urlRegex).nullable(),
  cv: z.string().regex(urlRegex).nullable(),
});

export const reviewSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  name: z.string().min(1),
  rating: z.number().min(0).max(5),
  comment: z.string().min(1),
  date: z.string().regex(iso8601Regex),
  caseType: z.string().min(1),
  isFake: z.boolean(),
});

export const lawyerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().regex(phoneUzRegex),
  verified: z.boolean(),
  specializations: z.array(z.string().min(1)),
  languages: z.array(z.enum(['uz', 'ru', 'en'])),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  casesCompleted: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  responseTime: z.string().min(1),
  online: z.boolean(),
  bio: z.string().min(1),
  education: z.array(educationSchema),
  experience: z.array(experienceSchema),
  license: licenseSchema,
  images: lawyerImagesSchema,
  reviews: z.array(reviewSchema),
  addedBy: z.string().uuid(),
  addedAt: z.string().regex(iso8601Regex),
});

export const templateFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'boolean']),
  required: z.boolean(),
  validation: z.string().nullable(),
  pii: z.boolean(),
});

export const fieldQuestionSchema = z.object({
  fieldKey: z.string().min(1),
  aiQuestion: z.string().min(1),
  aiHint: z.string().min(1),
  extractionRule: z.string().min(1),
  retryPrompt: z.string().min(1),
  skipCondition: z.string().nullable(),
});

export const aiConfigSchema = z.object({
  model: z.string().min(1),
  language: z.enum(['uz', 'ru', 'en']),
  temperature: z.number().min(0).max(2),
  systemPrompt: z.string().min(1),
  conversationStyle: z.string().min(1),
  maxTurns: z.number().int().positive(),
  fieldQuestions: z.array(fieldQuestionSchema),
  triggerKeywords: z.array(z.string().min(1)),
  triggerSignal: z.string().min(1),
});

export const templateReviewSchema = z.object({
  requiresLawyerReview: z.boolean(),
  signatureRequired: z.boolean(),
  signatureFields: z.array(z.string().min(1)),
});

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  riskLevel: z.enum(['GREEN', 'YELLOW', 'RED']),
  jurisdiction: z.string().min(1),
  status: z.enum(['ACTIVE', 'DRAFT', 'DISABLED']),
  version: z.number().int().positive(),
  pdfFile: z.string().nullable(),
  fields: z.array(templateFieldSchema),
  aiConfig: aiConfigSchema,
  review: templateReviewSchema,
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
  createdBy: z.string().uuid(),
});

export const sessionStateSchema = z.object({
  extracted: z.record(z.string(), z.unknown()),
  remaining: z.array(z.string()),
  currentField: z.string().nullable(),
  progress: z.number().min(0).max(100),
  messages: z.array(z.unknown()),
});

export const automationSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  userId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  sessionState: sessionStateSchema,
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const documentReviewSchema = z.object({
  lawyerId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  signature: z.string().nullable(),
  reviewedAt: z.string().regex(iso8601Regex).nullable(),
});

export const auditTrailEntrySchema = z.object({
  event: z.string().min(1),
  timestamp: z.string().regex(iso8601Regex),
  actor: z.string().min(1),
});

export const documentSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  userId: z.string().uuid(),
  status: z.enum(['PENDING', 'REVIEWED', 'CANCELLED', 'COMPLETED']),
  fields: z.record(z.string(), z.unknown()),
  review: documentReviewSchema,
  auditTrail: z.array(auditTrailEntrySchema),
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const jobResponseSchema = z.object({
  lawyerId: z.string().uuid(),
  coverNote: z.string().min(1),
  price: z.number().nonnegative(),
  submittedAt: z.string().regex(iso8601Regex),
});

export const jobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  budget: z.number().nonnegative(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DISPUTED', 'COMPLETED', 'CANCELLED']),
  attachments: z.array(z.string()),
  responses: z.array(jobResponseSchema),
  assignedLawyerId: z.string().uuid().nullable(),
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const disputeSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  lawyerId: z.string().uuid(),
  reason: z.string().min(1),
  details: z.string().min(1),
  attachments: z.array(z.string()),
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolution: z.string().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: z.string().regex(iso8601Regex).nullable(),
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  sender: z.enum(['user', 'lawyer']),
  content: z.string().min(1),
  timestamp: z.string().regex(iso8601Regex),
  read: z.boolean(),
  attachments: z.array(z.string()),
});

export const unreadCountSchema = z.object({
  userId: z.number().int().nonnegative(),
  lawyerId: z.number().int().nonnegative(),
});

export const conversationContextSchema = z.object({
  type: z.enum(['job', 'document']),
  id: z.string().uuid(),
});

export const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  lawyerId: z.string().uuid(),
  context: conversationContextSchema.nullable(),
  messages: z.array(conversationMessageSchema),
  unreadCount: unreadCountSchema,
  createdAt: z.string().regex(iso8601Regex),
  updatedAt: z.string().regex(iso8601Regex),
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  relatedId: z.string().uuid().nullable(),
  relatedType: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string().regex(iso8601Regex),
});

export const auditLogDetailsSchema = z.object({
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }).optional(),
}).passthrough();

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string().min(1),
  details: auditLogDetailsSchema,
  timestamp: z.string().regex(iso8601Regex),
  activeRole: z.string().min(1),
});

export const aiConfigSystemSchema = z.object({
  openaiApiKey: z.string().min(1),
  defaultModel: z.string().min(1),
  masterPrompt: z.string().min(1),
});

export const suggestionRulesSchema = z.object({
  ratingThreshold: z.number().min(0).max(5),
  specializationMatchWeight: z.number().min(0).max(1),
  onlinePriority: z.boolean(),
  responseTimeWeight: z.number().min(0).max(1),
  maxSuggestions: z.number().int().positive(),
});

export const featureFlagsSchema = z.object({
  enableChat: z.boolean(),
  enableJobs: z.boolean(),
  enableLawyerSearch: z.boolean(),
});

export const systemConfigSchema = z.object({
  ai: aiConfigSystemSchema,
  suggestionRules: suggestionRulesSchema,
  featureFlags: featureFlagsSchema,
});

export const databaseSchema = z.object({
  users: z.array(userSchema),
  aiChats: z.array(aiChatSchema),
  lawyers: z.array(lawyerSchema),
  templates: z.array(templateSchema),
  automations: z.array(automationSchema),
  documents: z.array(documentSchema),
  jobs: z.array(jobSchema),
  disputes: z.array(disputeSchema),
  conversations: z.array(conversationSchema),
  notifications: z.array(notificationSchema),
  auditLogs: z.array(auditLogSchema),
  systemConfig: systemConfigSchema,
});
