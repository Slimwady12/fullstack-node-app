export type ISO8601 = string;
export type HHMM = string;
export type Language = 'uz' | 'ru' | 'en';
export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';
export type TemplateStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';
export type AutomationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DocumentStatus = 'PENDING' | 'REVIEWED' | 'CANCELLED' | 'COMPLETED';
export type JobUrgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type JobStatus = 'OPEN' | 'IN_PROGRESS' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED';
export type DisputeStatus = 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type MessageRole = 'user' | 'ai';
export type MessageSender = 'user' | 'lawyer';
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type UserRole = 'user' | 'lawyer' | 'admin';

export interface UserProfile {
  email: string | null;
  avatar: string | null;
  language: Language;
}

export interface UserNotifications {
  email: boolean;
  push: boolean;
  quietHours: {
    start: HHMM;
    end: HHMM;
  };
}

export interface UserPrivacy {
  showPhone: boolean;
  showEmail: boolean;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  roles: UserRole[];
  joinedAt: ISO8601;
  savedLawyers: string[];
  profile: UserProfile;
  notifications: UserNotifications;
  privacy: UserPrivacy;
}

export interface AiChatMessage {
  role: MessageRole;
  content: string;
  timestamp: ISO8601;
  attachments: string[];
}

export interface AiChat {
  id: string;
  userId: string;
  title: string;
  messages: AiChatMessage[];
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Education {
  institution: string;
  degree: string;
  year: number;
}

export interface Experience {
  company: string;
  position: string;
  from: ISO8601;
  to: ISO8601 | null;
}

export interface License {
  number: string;
  issuedAt: ISO8601;
  expiresAt: ISO8601;
}

export interface LawyerImages {
  profile: string | null;
  license: string | null;
  cv: string | null;
}

export interface Review {
  id: string;
  userId: string | null;
  name: string;
  rating: number;
  comment: string;
  date: ISO8601;
  caseType: string;
  isFake: boolean;
}

export interface Lawyer {
  id: string;
  name: string;
  phone: string;
  verified: boolean;
  specializations: string[];
  languages: Language[];
  rating: number;
  reviewCount: number;
  casesCompleted: number;
  price: number;
  responseTime: string;
  online: boolean;
  bio: string;
  education: Education[];
  experience: Experience[];
  license: License;
  images: LawyerImages;
  reviews: Review[];
  addedBy: string;
  addedAt: ISO8601;
}

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  validation: string | null;
  pii: boolean;
}

export interface FieldQuestion {
  fieldKey: string;
  aiQuestion: string;
  aiHint: string;
  extractionRule: string;
  retryPrompt: string;
  skipCondition: string | null;
}

export interface AiConfig {
  model: string;
  language: Language;
  temperature: number;
  systemPrompt: string;
  conversationStyle: string;
  maxTurns: number;
  fieldQuestions: FieldQuestion[];
  triggerKeywords: string[];
  triggerSignal: string;
}

export interface TemplateReview {
  requiresLawyerReview: boolean;
  signatureRequired: boolean;
  signatureFields: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  jurisdiction: string;
  status: TemplateStatus;
  version: number;
  pdfFile: string | null;
  fields: TemplateField[];
  aiConfig: AiConfig;
  review: TemplateReview;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  createdBy: string;
}

export interface SessionState {
  extracted: Record<string, unknown>;
  remaining: string[];
  currentField: string | null;
  progress: number;
  messages: unknown[];
}

export interface Automation {
  id: string;
  templateId: string;
  templateVersion: number;
  userId: string;
  status: AutomationStatus;
  sessionState: SessionState;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface DocumentReview {
  lawyerId: string | null;
  notes: string | null;
  signature: string | null;
  reviewedAt: ISO8601 | null;
}

export interface AuditTrailEntry {
  event: string;
  timestamp: ISO8601;
  actor: string;
}

export interface Document {
  id: string;
  templateId: string;
  templateVersion: number;
  userId: string;
  status: DocumentStatus;
  fields: Record<string, unknown>;
  review: DocumentReview;
  auditTrail: AuditTrailEntry[];
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface JobResponse {
  lawyerId: string;
  coverNote: string;
  price: number;
  submittedAt: ISO8601;
}

export interface Job {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  urgency: JobUrgency;
  status: JobStatus;
  attachments: string[];
  responses: JobResponse[];
  assignedLawyerId: string | null;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Dispute {
  id: string;
  jobId: string;
  userId: string;
  lawyerId: string;
  reason: string;
  details: string;
  attachments: string[];
  status: DisputeStatus;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: ISO8601 | null;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: ISO8601;
  read: boolean;
  attachments: string[];
}

export interface UnreadCount {
  userId: number;
  lawyerId: number;
}

export interface ConversationContext {
  type: 'job' | 'document';
  id: string;
}

export interface Conversation {
  id: string;
  userId: string;
  lawyerId: string;
  context: ConversationContext | null;
  messages: ConversationMessage[];
  unreadCount: UnreadCount;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  relatedType: string | null;
  read: boolean;
  createdAt: ISO8601;
}

export interface AuditLogDetails {
  tokens?: {
    input: number;
    output: number;
  };
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: AuditLogDetails;
  timestamp: ISO8601;
  activeRole: string;
}

export interface AiConfig_System {
  openaiApiKey: string;
  defaultModel: string;
  masterPrompt: string;
}

export interface SuggestionRules {
  ratingThreshold: number;
  specializationMatchWeight: number;
  onlinePriority: boolean;
  responseTimeWeight: number;
  maxSuggestions: number;
}

export interface FeatureFlags {
  enableChat: boolean;
  enableJobs: boolean;
  enableLawyerSearch: boolean;
}

export interface SystemConfig {
  ai: AiConfig_System;
  suggestionRules: SuggestionRules;
  featureFlags: FeatureFlags;
}

export interface Database {
  users: User[];
  aiChats: AiChat[];
  lawyers: Lawyer[];
  templates: Template[];
  automations: Automation[];
  documents: Document[];
  jobs: Job[];
  disputes: Dispute[];
  conversations: Conversation[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  systemConfig: SystemConfig;
}
