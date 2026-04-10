import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { read, write, transaction, init as dbInit } from './services/jsonDb.js';
import { callOpenAI } from './services/openaiProxy.js';
import { processMessage as middlemanProcess } from './services/middleman.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'].map(e => e.toLowerCase());

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (!ALLOWED_MIME_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error('Invalid file type. Allowed: jpg, jpeg, png, pdf');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use('/uploads', express.static(UPLOADS_DIR));

function logRequest(req, res, next) {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    return originalJson(body);
  };

  next();
}

app.use(logRequest);

function auditLog(db, userId, action, details, activeRole = 'USER') {
  db.auditLogs.push({
    id: uuidv4(),
    userId,
    action,
    details,
    timestamp: new Date().toISOString(),
    activeRole,
  });
}

function sendNotification(db, userId, type, title, message, relatedId = null, relatedType = null) {
  db.notifications.push({
    id: uuidv4(),
    userId,
    type,
    title,
    message,
    relatedId,
    relatedType,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function validateOwnership(resource, userId, roles) {
  if (resource.userId === userId) return true;
  if (roles && roles.includes('admin')) return true;
  return false;
}

function recalculateRating(lawyer) {
  if (!lawyer.reviews || lawyer.reviews.length === 0) {
    lawyer.rating = 0;
    lawyer.reviewCount = 0;
    return lawyer;
  }

  const realReviews = lawyer.reviews.filter(r => !r.isFake);
  const totalRating = realReviews.reduce((sum, r) => sum + r.rating, 0);
  lawyer.rating = realReviews.length > 0 ? Math.round((totalRating / realReviews.length) * 10) / 10 : 0;
  lawyer.reviewCount = realReviews.length;
  return lawyer;
}

function errorHandler(err, req, res, next) {
  const statusCode = err.status || 500;
  const message = err.message || err.error || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, message, err);

  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      code: 'INVALID_FILE_TYPE',
      details: 'Allowed types: jpg, jpeg, png, pdf',
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      code: 'FILE_TOO_LARGE',
      details: 'Maximum file size is 5MB',
    });
  }

  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code || 'ERROR',
    });
  }

  res.status(statusCode).json({
    error: message,
    code,
  });
}

app.use(errorHandler);

// 1. GET /api/db/read
app.get('/api/db/read', (req, res) => {
  try {
    const db = read();
    console.log('[server/db/read] Database keys:', Object.keys(db), 'hasUsers:', 'users' in db);
    
    // Handle both formats: 
    // 1. New format with data/lastModified wrapper
    // 2. Old flat format (direct database object)
    if (db && db.data && typeof db.data === 'object') {
      console.log('[server/db/read] Unwrapping data wrapper');
      res.json({ success: true, data: db.data });
    } else {
      res.json({ success: true, data: db });
    }
  } catch (error) {
    console.error('[server/db/read] Error:', error.message);
    res.status(500).json({ error: error.message, code: 'DB_READ_ERROR' });
  }
});

// 2. POST /api/db/write
app.post('/api/db/write', async (req, res) => {
  try {
    let data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data', code: 'INVALID_DATA' });
    }

    // If the client sends the full wrapper format, extract just the database part
    // The database.json should store only the actual database, not the wrapper
    if (data.data && typeof data.data === 'object') {
      data = data.data;
    }

    await write(data);
    res.json({ success: true, message: 'Database written successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'DB_WRITE_ERROR' });
  }
});

// 3. POST /api/middleman/chat
app.post('/api/middleman/chat', async (req, res, next) => {
  try {
    const { userId, templateId, message, sessionId } = req.body;

    if (!userId || !templateId || !message) {
      return res.status(400).json({ error: 'userId, templateId, and message are required', code: 'MISSING_FIELDS' });
    }

    const result = await middlemanProcess(userId, templateId, message, sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 4. POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
    }

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: `/uploads/${req.file.filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 5. POST /api/chat/general
app.post('/api/chat/general', async (req, res, next) => {
  try {
    const { userId, message, attachments = [], sessionId } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const systemConfig = db.systemConfig;
    const now = new Date().toISOString();

    let chat;

    if (sessionId) {
      chat = db.aiChats.find(c => c.id === sessionId && c.userId === userId);
    }

    if (!chat) {
      chat = {
        id: sessionId || uuidv4(),
        userId,
        title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      db.aiChats.push(chat);
    }

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: now,
      attachments,
    };
    chat.messages.push(userMessage);

    const messages = [
      { role: 'system', content: systemConfig.ai.masterPrompt },
      ...chat.messages.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ];

    let aiResponse;
    let tokens = { input: 0, output: 0 };
    let latency = 0;
    let model = systemConfig.ai.defaultModel;

    try {
      aiResponse = await callOpenAI({
        messages,
        temperature: 0.7,
        userId,
      });
      tokens = aiResponse.tokens;
      latency = aiResponse.latency;
      model = aiResponse.model;
    } catch (error) {
      console.error('[chat] OpenAI call failed:', error);
      auditLog(db, userId, 'CHAT_ERROR', { sessionId: chat.id, error: error.message || String(error) });
      await write(db);
      return res.status(503).json({
        error: error.message || 'Failed to get AI response',
        code: error.code || 'OPENAI_CALL_FAILED',
      });
    }

    const aiMessage = {
      role: 'ai',
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      attachments: [],
    };
    chat.messages.push(aiMessage);
    chat.updatedAt = new Date().toISOString();

    auditLog(db, userId, 'CHAT_GENERAL', {
      sessionId: chat.id,
      tokens,
      latency,
      model,
      messageLength: message.length,
    });

    await write(db);

    res.json({
      success: true,
      data: {
        sessionId: chat.id,
        message: aiResponse.content,
        tokens,
        latency,
        model,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 6. POST /api/conversations
app.post('/api/conversations', async (req, res, next) => {
  try {
    const { userId, lawyerId, context, content, attachments = [] } = req.body;

    if (!userId || !lawyerId || !content) {
      return res.status(400).json({ error: 'userId, lawyerId, and content are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const now = new Date().toISOString();

    const messageId = uuidv4();

    const conversation = {
      id: uuidv4(),
      userId,
      lawyerId,
      context: context || null,
      messages: [
        {
          id: messageId,
          sender: 'user',
          content,
          timestamp: now,
          read: false,
          attachments,
        },
      ],
      unreadCount: {
        userId: 0,
        lawyerId: 1,
      },
      createdAt: now,
      updatedAt: now,
    };

    db.conversations.push(conversation);

    sendNotification(db, lawyerId, 'message_received', 'New message', `You have a new message from ${userId}`, conversation.id, 'conversation');

    auditLog(db, userId, 'CONVERSATION_CREATED', { conversationId: conversation.id, lawyerId, context });

    await write(db);

    res.status(201).json({ success: true, data: { conversationId: conversation.id, messageId } });
  } catch (error) {
    next(error);
  }
});

// 7. POST /api/conversations/:id/message
app.post('/api/conversations/:id/message', async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { userId, content, attachments = [] } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'userId and content are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const conversation = db.conversations.find(c => c.id === conversationId);

    if (!conversation) {
      throw { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found', status: 404 };
    }

    if (conversation.userId !== userId && conversation.lawyerId !== userId) {
      throw { code: 'UNAUTHORIZED', message: 'Not a participant in this conversation', status: 403 };
    }

    const now = new Date().toISOString();
    const sender = conversation.userId === userId ? 'user' : 'lawyer';
    const otherId = sender === 'user' ? conversation.lawyerId : conversation.userId;

    const message = {
      id: uuidv4(),
      sender,
      content,
      timestamp: now,
      read: false,
      attachments,
    };

    conversation.messages.push(message);
    conversation.updatedAt = now;
    conversation.unreadCount[sender === 'user' ? 'userId' : 'lawyerId']++;

    const notificationType = sender === 'user' ? 'message_received' : 'message_from_lawyer';
    sendNotification(db, otherId, notificationType, 'New message', `You have a new message in conversation ${conversationId}`, conversationId, 'conversation');

    auditLog(db, userId, 'MESSAGE_SENT', { conversationId, messageId: message.id, sender });

    await write(db);

    res.json({ success: true, data: { messageId: message.id, unreadCount: conversation.unreadCount } });
  } catch (error) {
    next(error);
  }
});

// 8. POST /api/conversations/:id/read
app.post('/api/conversations/:id/read', async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const conversation = db.conversations.find(c => c.id === conversationId);

    if (!conversation) {
      throw { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found', status: 404 };
    }

    if (conversation.userId !== userId && conversation.lawyerId !== userId) {
      throw { code: 'UNAUTHORIZED', message: 'Not a participant in this conversation', status: 403 };
    }

    if (conversation.userId === userId) {
      conversation.unreadCount.userId = 0;
    } else {
      conversation.unreadCount.lawyerId = 0;
    }

    conversation.updatedAt = new Date().toISOString();

    auditLog(db, userId, 'MARKED_READ', { conversationId });

    await write(db);

    res.json({ success: true, data: { unreadCount: conversation.unreadCount } });
  } catch (error) {
    next(error);
  }
});

// 9. POST /api/documents
app.post('/api/documents', async (req, res, next) => {
  try {
    const { templateId, userId, fields = {} } = req.body;

    if (!templateId || !userId) {
      return res.status(400).json({ error: 'templateId and userId are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const template = db.templates.find(t => t.id === templateId);

    if (!template) {
      throw { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found', status: 404 };
    }

    for (const field of template.fields) {
      if (field.required && (fields[field.key] === undefined || fields[field.key] === null || fields[field.key] === '')) {
        throw { code: 'VALIDATION_ERROR', message: `Required field '${field.key}' is missing`, status: 400 };
      }
    }

    const now = new Date().toISOString();

    const document = {
      id: uuidv4(),
      templateId,
      templateVersion: template.version,
      userId,
      status: 'PENDING',
      fields,
      review: {
        lawyerId: null,
        notes: null,
        signature: null,
        reviewedAt: null,
      },
      auditTrail: [
        { event: 'DOCUMENT_CREATED', timestamp: now, actor: userId },
      ],
      createdAt: now,
      updatedAt: now,
    };

    db.documents.push(document);

    if (template.review.requiresLawyerReview) {
      const admins = db.users.filter(u => u.roles.includes('admin'));
      for (const admin of admins) {
        sendNotification(db, admin.id, 'document_review', 'Document Review Required', `New document requires review`, document.id, 'document');
      }
    }

    auditLog(db, userId, 'DOCUMENT_CREATED', { documentId: document.id, templateId, templateVersion: template.version });

    await write(db);

    res.status(201).json({ success: true, data: { documentId: document.id, status: document.status } });
  } catch (error) {
    next(error);
  }
});

// 10. GET /api/documents?userId
app.get('/api/documents', (req, res) => {
  try {
    const { userId } = req.query;
    const db = read();

    let documents = db.documents;

    if (userId) {
      documents = documents.filter(d => d.userId === userId);
    }

    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'DB_READ_ERROR' });
  }
});

// 11. GET /api/documents/:id
app.get('/api/documents/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, roles } = req.query;

    const db = read();
    const document = db.documents.find(d => d.id === id);

    if (!document) {
      throw { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', status: 404 };
    }

    if (document.userId !== userId && !(roles && roles.includes('admin'))) {
      throw { code: 'UNAUTHORIZED', message: 'Not authorized to view this document', status: 403 };
    }

    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
});

// 12. POST /api/documents/:id/cancel
app.post('/api/documents/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const document = db.documents.find(d => d.id === id);

    if (!document) {
      throw { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', status: 404 };
    }

    if (!validateOwnership(document, userId, ['admin'])) {
      throw { code: 'UNAUTHORIZED', message: 'Not authorized to cancel this document', status: 403 };
    }

    const now = new Date().toISOString();
    document.status = 'CANCELLED';
    document.updatedAt = now;
    document.auditTrail.push({ event: 'DOCUMENT_CANCELLED', timestamp: now, actor: userId });

    auditLog(db, userId, 'DOCUMENT_CANCELLED', { documentId: id });

    await write(db);

    res.json({ success: true, data: { status: document.status } });
  } catch (error) {
    next(error);
  }
});

// 13. PUT /api/documents/:id
app.put('/api/documents/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, fields } = req.body;

    if (!userId || !fields) {
      return res.status(400).json({ error: 'userId and fields are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const document = db.documents.find(d => d.id === id);

    if (!document) {
      throw { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', status: 404 };
    }

    if (!validateOwnership(document, userId, ['admin'])) {
      throw { code: 'UNAUTHORIZED', message: 'Not authorized to update this document', status: 403 };
    }

    const now = new Date().toISOString();
    document.fields = { ...document.fields, ...fields };
    document.status = 'PENDING';
    document.updatedAt = now;
    document.auditTrail.push({ event: 'DOCUMENT_UPDATED', timestamp: now, actor: userId });

    auditLog(db, userId, 'DOCUMENT_UPDATED', { documentId: id });

    await write(db);

    res.json({ success: true, data: { documentId: id, status: document.status } });
  } catch (error) {
    next(error);
  }
});

// 14. POST /api/documents/:id/review
app.post('/api/documents/:id/review', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, notes, signature, status = 'REVIEWED' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const admin = db.users.find(u => u.id === userId && u.roles.includes('admin'));

    if (!admin) {
      throw { code: 'UNAUTHORIZED', message: 'Only admins can review documents', status: 403 };
    }

    const document = db.documents.find(d => d.id === id);

    if (!document) {
      throw { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', status: 404 };
    }

    const now = new Date().toISOString();
    document.status = status;
    document.review = {
      lawyerId: userId,
      notes: notes || null,
      signature: signature || null,
      reviewedAt: now,
    };
    document.updatedAt = now;
    document.auditTrail.push({ event: 'DOCUMENT_REVIEWED', timestamp: now, actor: userId });

    sendNotification(db, document.userId, 'document_reviewed', 'Document Reviewed', `Your document has been reviewed by an admin`, id, 'document');

    auditLog(db, userId, 'DOCUMENT_REVIEWED', { documentId: id, status, reviewerId: userId });

    await write(db);

    res.json({ success: true, data: { status: document.status, reviewedAt: document.review.reviewedAt } });
  } catch (error) {
    next(error);
  }
});

// 15. POST /api/reviews
app.post('/api/reviews', async (req, res, next) => {
  try {
    const { lawyerId, userId, name, rating, comment, caseType, isFake = false } = req.body;

    if (!lawyerId || !name || !rating || !comment || !caseType) {
      return res.status(400).json({ error: 'All fields are required', code: 'MISSING_FIELDS' });
    }

    if (rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5', code: 'INVALID_RATING' });
    }

    const db = read();
    const lawyer = db.lawyers.find(l => l.id === lawyerId);

    if (!lawyer) {
      throw { code: 'LAWYER_NOT_FOUND', message: 'Lawyer not found', status: 404 };
    }

    if (userId) {
      const existingReview = lawyer.reviews.find(r => r.userId === userId);
      if (existingReview) {
        throw { code: 'DUPLICATE_REVIEW', message: 'You have already reviewed this lawyer', status: 409 };
      }
    }

    const review = {
      id: uuidv4(),
      userId: userId || null,
      name,
      rating,
      comment,
      date: new Date().toISOString(),
      caseType,
      isFake,
    };

    lawyer.reviews.push(review);
    recalculateRating(lawyer);

    sendNotification(db, lawyerId, 'review_received', 'New Review', `You received a new ${rating}-star review`, lawyerId, 'lawyer');

    auditLog(db, userId || 'anonymous', 'REVIEW_CREATED', { lawyerId, reviewId: review.id, rating });

    await write(db);

    res.status(201).json({ success: true, data: { reviewId: review.id, newRating: lawyer.rating, reviewCount: lawyer.reviewCount } });
  } catch (error) {
    next(error);
  }
});

// 16. POST /api/disputes
app.post('/api/disputes', async (req, res, next) => {
  try {
    const { jobId, userId, lawyerId, reason, details, attachments = [] } = req.body;

    if (!jobId || !userId || !lawyerId || !reason || !details) {
      return res.status(400).json({ error: 'All fields are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const job = db.jobs.find(j => j.id === jobId);

    if (!job) {
      throw { code: 'JOB_NOT_FOUND', message: 'Job not found', status: 404 };
    }

    if (!job.assignedLawyerId) {
      throw { code: 'INVALID_DISPUTE', message: 'Cannot dispute a job without an assigned lawyer', status: 400 };
    }

    const dispute = {
      id: uuidv4(),
      jobId,
      userId,
      lawyerId,
      reason,
      details,
      attachments,
      status: 'UNDER_REVIEW',
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.disputes.push(dispute);

    const admins = db.users.filter(u => u.roles.includes('admin'));
    for (const admin of admins) {
      sendNotification(db, admin.id, 'dispute_created', 'New Dispute', `A new dispute has been filed on job ${jobId}`, dispute.id, 'dispute');
    }

    auditLog(db, userId, 'DISPUTE_CREATED', { disputeId: dispute.id, jobId, lawyerId });

    await write(db);

    res.status(201).json({ success: true, data: { disputeId: dispute.id, status: dispute.status } });
  } catch (error) {
    next(error);
  }
});

// 17. GET /api/disputes
app.get('/api/disputes', (req, res, next) => {
  try {
    const { userId, roles } = req.query;

    if (!(roles && roles.includes('admin'))) {
      throw { code: 'UNAUTHORIZED', message: 'Only admins can view disputes', status: 403 };
    }

    const db = read();
    res.json({ success: true, data: db.disputes });
  } catch (error) {
    next(error);
  }
});

// 18. POST /api/disputes/:id/resolve
app.post('/api/disputes/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, resolution, action = 'resolve' } = req.body;

    if (!userId || !resolution) {
      return res.status(400).json({ error: 'userId and resolution are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const admin = db.users.find(u => u.id === userId && u.roles.includes('admin'));

    if (!admin) {
      throw { code: 'UNAUTHORIZED', message: 'Only admins can resolve disputes', status: 403 };
    }

    const dispute = db.disputes.find(d => d.id === id);

    if (!dispute) {
      throw { code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found', status: 404 };
    }

    const now = new Date().toISOString();
    dispute.status = action === 'resolve' ? 'RESOLVED' : 'DISMISSED';
    dispute.resolution = resolution;
    dispute.resolvedBy = userId;
    dispute.resolvedAt = now;
    dispute.updatedAt = now;

    if (action === 'resolve') {
      const job = db.jobs.find(j => j.id === dispute.jobId);
      if (job) {
        job.status = 'DISPUTED';
        job.updatedAt = now;
      }
    }

    sendNotification(db, dispute.userId, 'dispute_resolved', 'Dispute Resolved', `Your dispute has been ${dispute.status.toLowerCase()}`, dispute.id, 'dispute');
    sendNotification(db, dispute.lawyerId, 'dispute_resolved', 'Dispute Resolved', `The dispute on job ${dispute.jobId} has been ${dispute.status.toLowerCase()}`, dispute.id, 'dispute');

    auditLog(db, userId, `DISPUTE_${dispute.status}`, { disputeId: id, jobId: dispute.jobId });

    await write(db);

    res.json({ success: true, data: { status: dispute.status, resolvedAt: dispute.resolvedAt } });
  } catch (error) {
    next(error);
  }
});

// 19. GET /api/jobs
app.get('/api/jobs', (req, res) => {
  try {
    const { userId, status, category } = req.query;
    const db = read();

    let jobs = db.jobs;

    if (userId) {
      jobs = jobs.filter(j => j.userId === userId || j.assignedLawyerId === userId);
    }

    if (status) {
      jobs = jobs.filter(j => j.status === status);
    }

    if (category) {
      jobs = jobs.filter(j => j.category.toLowerCase() === category.toLowerCase());
    }

    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'DB_READ_ERROR' });
  }
});

// 20. POST /api/jobs/:id/response
app.post('/api/jobs/:id/response', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lawyerId, coverNote, price } = req.body;

    if (!lawyerId || !coverNote || price === undefined) {
      return res.status(400).json({ error: 'lawyerId, coverNote, and price are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const job = db.jobs.find(j => j.id === id);

    if (!job) {
      throw { code: 'JOB_NOT_FOUND', message: 'Job not found', status: 404 };
    }

    const existingResponse = job.responses.find(r => r.lawyerId === lawyerId);
    if (existingResponse) {
      throw { code: 'DUPLICATE_RESPONSE', message: 'You have already responded to this job', status: 409 };
    }

    const response = {
      lawyerId,
      coverNote,
      price,
      submittedAt: new Date().toISOString(),
    };

    job.responses.push(response);
    job.updatedAt = new Date().toISOString();

    sendNotification(db, job.userId, 'job_response', 'New Job Response', `A lawyer has responded to your job: ${job.title}`, job.id, 'job');

    auditLog(db, lawyerId, 'JOB_RESPONSE', { jobId: id, price });

    await write(db);

    res.status(201).json({ success: true, data: { responseId: response.lawyerId, submittedAt: response.submittedAt } });
  } catch (error) {
    next(error);
  }
});

// 21. POST /api/jobs/:id/accept
app.post('/api/jobs/:id/accept', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, lawyerId } = req.body;

    if (!userId || !lawyerId) {
      return res.status(400).json({ error: 'userId and lawyerId are required', code: 'MISSING_FIELDS' });
    }

    const db = read();
    const job = db.jobs.find(j => j.id === id);

    if (!job) {
      throw { code: 'JOB_NOT_FOUND', message: 'Job not found', status: 404 };
    }

    if (job.userId !== userId) {
      throw { code: 'UNAUTHORIZED', message: 'Only the job poster can accept a response', status: 403 };
    }

    if (job.status !== 'OPEN') {
      throw { code: 'INVALID_STATUS', message: 'Job is not open for acceptance', status: 400 };
    }

    const now = new Date().toISOString();
    job.assignedLawyerId = lawyerId;
    job.status = 'IN_PROGRESS';
    job.updatedAt = now;

    const lawyer = db.lawyers.find(l => l.id === lawyerId);
    const lawyerName = lawyer ? lawyer.name : 'Lawyer';

    sendNotification(db, lawyerId, 'job_assigned', 'Job Assigned', `You have been assigned to job: ${job.title}`, job.id, 'job');

    auditLog(db, userId, 'JOB_ACCEPTED', { jobId: id, lawyerId });

    await write(db);

    res.json({ success: true, data: { status: job.status, assignedLawyerId: job.assignedLawyerId } });
  } catch (error) {
    next(error);
  }
});

// 22. DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, roles } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_FIELDS' });
    }

    if (userId !== id && !(roles && roles.includes('admin'))) {
      throw { code: 'UNAUTHORIZED', message: 'Not authorized to delete this user', status: 403 };
    }

    const db = read();

    const userToDelete = db.users.find(u => u.id === id);
    if (!userToDelete) {
      throw { code: 'USER_NOT_FOUND', message: 'User not found', status: 404 };
    }

    db.documents = db.documents.filter(d => d.userId !== id);
    db.jobs = db.jobs.filter(j => j.userId !== id);
    db.aiChats = db.aiChats.filter(c => c.userId !== id);
    db.conversations = db.conversations.filter(c => c.userId !== id && c.lawyerId !== id);
    db.notifications = db.notifications.filter(n => n.userId !== id);
    db.disputes = db.disputes.filter(d => d.userId !== id && d.lawyerId !== id);

    for (const lawyer of db.lawyers) {
      const reviewIndex = lawyer.reviews.findIndex(r => r.userId === id);
      if (reviewIndex !== -1) {
        lawyer.reviews.splice(reviewIndex, 1);
        recalculateRating(lawyer);
      }
    }

    db.users = db.users.filter(u => u.id !== id);

    auditLog(db, userId, 'USER_DELETED', { deletedUserId: id, cascadedCollections: ['documents', 'jobs', 'aiChats', 'conversations', 'notifications', 'disputes'] });

    await write(db);

    res.json({ success: true, message: 'User and all related data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ADDITIONAL ENDPOINTS FOR PHASE 1 TESTING
// ==========================================

// 23. GET /api/health - Health check
app.get('/api/health', (req, res) => {
  try {
    const db = read();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      collections: Object.keys(db).length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// 24. POST /api/auth/login - Login with phone
app.post('/api/auth/login', (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required', code: 'MISSING_PHONE' });
    }

    const db = read();
    const SUPERADMIN_PHONE = '+998123456789';

    // Check if SuperAdmin
    if (phone === SUPERADMIN_PHONE || phone === '1234567890' || phone === '123456789') {
      let admin = db.users.find(u => u.roles.includes('admin'));
      
      if (!admin) {
        admin = {
          id: 'superadmin-001',
          phone: SUPERADMIN_PHONE,
          name: 'Super Admin',
          roles: ['admin'],
          joinedAt: new Date().toISOString(),
          savedLawyers: [],
          profile: { email: null, avatar: null, language: 'en' },
          notifications: { email: true, push: true, quietHours: { start: '22:00', end: '07:00' } },
          privacy: { showPhone: false, showEmail: false },
        };
        db.users.push(admin);
        write(db);
      }

      return res.json({
        success: true,
        data: {
          isSuperAdmin: true,
          requiresOtp: false,
          user: {
            userId: admin.id,
            phone: admin.phone,
            name: admin.name,
            roles: admin.roles,
          },
        },
      });
    }

    // Check if user exists
    const existingUser = db.users.find(u => u.phone === phone);

    if (existingUser) {
      return res.json({
        success: true,
        data: {
          isSuperAdmin: false,
          requiresOtp: true,
          requiresName: false,
          phone: phone,
        },
      });
    }

    // New user
    return res.json({
      success: true,
      data: {
        isSuperAdmin: false,
        requiresOtp: true,
        requiresName: true,
        phone: phone,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 25. POST /api/auth/verify-otp - Verify OTP
app.post('/api/auth/verify-otp', (req, res, next) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required', code: 'MISSING_FIELDS' });
    }

    const SIMULATED_OTP = '123456';

    if (code !== SIMULATED_OTP) {
      return res.status(401).json({
        success: false,
        error: 'Invalid OTP code',
        code: 'INVALID_OTP',
      });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    next(error);
  }
});

// 26. POST /api/auth/set-name - Set user name after OTP
app.post('/api/auth/set-name', async (req, res, next) => {
  try {
    const { phone, name } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'Phone and name are required', code: 'MISSING_FIELDS' });
    }

    if (name.length < 3) {
      return res.status(400).json({
        error: 'Name must be at least 3 characters',
        code: 'INVALID_NAME',
      });
    }

    const db = read();

    // Check if user already exists
    let user = db.users.find(u => u.phone === phone);

    if (user) {
      // Update existing user
      user.name = name;
      auditLog(db, user.id, 'USER_UPDATED', { userId: user.id, name });
      await write(db);

      return res.json({
        success: true,
        data: {
          userId: user.id,
          phone: user.phone,
          name: user.name,
          roles: user.roles,
          activeRole: user.roles[0],
          joinedAt: user.joinedAt,
        },
      });
    }

    // Create new user
    const newUser = {
      id: uuidv4(),
      phone,
      name,
      roles: ['user'],
      joinedAt: new Date().toISOString(),
      savedLawyers: [],
      profile: { email: null, avatar: null, language: 'uz' },
      notifications: { email: true, push: true, quietHours: { start: '22:00', end: '07:00' } },
      privacy: { showPhone: false, showEmail: false },
    };

    db.users.push(newUser);
    auditLog(db, newUser.id, 'USER_CREATED', { userId: newUser.id, name, phone });
    await write(db);

    return res.status(201).json({
      success: true,
      data: {
        userId: newUser.id,
        phone: newUser.phone,
        name: newUser.name,
        roles: newUser.roles,
        activeRole: newUser.roles[0],
        joinedAt: newUser.joinedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 27. POST /api/auth/complete - Complete login (find user and return session)
app.post('/api/auth/complete', (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone is required', code: 'MISSING_PHONE' });
    }

    const db = read();
    const user = db.users.find(u => u.phone === phone);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.json({
      success: true,
      data: {
        userId: user.id,
        phone: user.phone,
        name: user.name,
        roles: user.roles,
        activeRole: user.roles[0],
        joinedAt: user.joinedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 28. GET /api/lawyers - Get all lawyers with filters
app.get('/api/lawyers', (req, res, next) => {
  try {
    const { search, specialization, verified, online, minRating } = req.query;
    const db = read();

    let lawyers = db.lawyers;

    // Search by name or specialization
    if (search) {
      const searchLower = search.toLowerCase();
      lawyers = lawyers.filter(l =>
        l.name.toLowerCase().includes(searchLower) ||
        (l.specializations && l.specializations.some(s => s.toLowerCase().includes(searchLower)))
      );
    }

    // Filter by specialization
    if (specialization) {
      lawyers = lawyers.filter(l =>
        l.specializations && l.specializations.includes(specialization)
      );
    }

    // Filter by verified
    if (verified !== undefined) {
      lawyers = lawyers.filter(l => l.verified === (verified === 'true'));
    }

    // Filter by online
    if (online !== undefined) {
      lawyers = lawyers.filter(l => l.online === (online === 'true'));
    }

    // Filter by minimum rating
    if (minRating !== undefined) {
      lawyers = lawyers.filter(l => l.rating >= parseFloat(minRating));
    }

    return res.json({ success: true, data: lawyers });
  } catch (error) {
    next(error);
  }
});

// 29. GET /api/lawyers/:id - Get single lawyer
app.get('/api/lawyers/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const db = read();
    const lawyer = db.lawyers.find(l => l.id === id);

    if (!lawyer) {
      throw { code: 'LAWYER_NOT_FOUND', message: 'Lawyer not found', status: 404 };
    }

    return res.json({ success: true, data: lawyer });
  } catch (error) {
    next(error);
  }
});

// 30. POST /api/lawyers - Create lawyer
app.post('/api/lawyers', async (req, res, next) => {
  try {
    const { name, phone, verified, specializations, languages, price, responseTime, online, bio, license, education, experience, addedBy } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required', code: 'MISSING_FIELDS' });
    }

    const db = read();

    const newLawyer = {
      id: uuidv4(),
      name,
      phone,
      verified: verified || false,
      specializations: specializations || [],
      languages: languages || ['uz'],
      rating: 0,
      reviewCount: 0,
      casesCompleted: 0,
      price: price || 0,
      responseTime: responseTime || '24 hours',
      online: online || false,
      bio: bio || '',
      education: education || [],
      experience: experience || [],
      license: license || { number: '', issuedAt: null, expiresAt: null },
      images: { profile: null, license: null, cv: null },
      reviews: [],
      addedBy: addedBy || 'system',
      addedAt: new Date().toISOString(),
    };

    db.lawyers.push(newLawyer);
    auditLog(db, addedBy || 'system', 'LAWYER_CREATED', {
      lawyerId: newLawyer.id,
      lawyerName: newLawyer.name,
    });

    await write(db);

    return res.status(201).json({ success: true, data: newLawyer });
  } catch (error) {
    next(error);
  }
});

// 31. PUT /api/lawyers/:id - Update lawyer
app.put('/api/lawyers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const db = read();
    const lawyer = db.lawyers.find(l => l.id === id);

    if (!lawyer) {
      throw { code: 'LAWYER_NOT_FOUND', message: 'Lawyer not found', status: 404 };
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key in lawyer) {
        lawyer[key] = updates[key];
      }
    });

    // Recalculate rating if reviews changed
    if (updates.reviews) {
      recalculateRating(lawyer);
    }

    auditLog(db, 'system', 'LAWYER_UPDATED', {
      lawyerId: lawyer.id,
      lawyerName: lawyer.name,
    });

    await write(db);

    return res.json({ success: true, data: lawyer });
  } catch (error) {
    next(error);
  }
});

// 32. DELETE /api/lawyers/:id - Delete lawyer
app.delete('/api/lawyers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const db = read();
    const lawyerIndex = db.lawyers.findIndex(l => l.id === id);

    if (lawyerIndex === -1) {
      throw { code: 'LAWYER_NOT_FOUND', message: 'Lawyer not found', status: 404 };
    }

    db.lawyers.splice(lawyerIndex, 1);

    auditLog(db, userId || 'system', 'LAWYER_DELETED', { lawyerId: id });

    await write(db);

    return res.json({ success: true, message: 'Lawyer deleted' });
  } catch (error) {
    next(error);
  }
});

// 33. GET /api/templates - Get all templates
app.get('/api/templates', (req, res, next) => {
  try {
    const { status, category } = req.query;
    const db = read();

    let templates = db.templates;

    if (status) {
      templates = templates.filter(t => t.status === status);
    }

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

// 34. GET /api/templates/:id - Get single template
app.get('/api/templates/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const db = read();
    const template = db.templates.find(t => t.id === id);

    if (!template) {
      throw { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found', status: 404 };
    }

    return res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// 35. POST /api/templates - Create template
app.post('/api/templates', async (req, res, next) => {
  try {
    const { name, description, category, riskLevel, jurisdiction, status, fields, aiConfig, review, createdBy } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required', code: 'MISSING_FIELDS' });
    }

    const db = read();

    const newTemplate = {
      id: uuidv4(),
      name,
      description,
      category: category || 'General',
      riskLevel: riskLevel || 'GREEN',
      jurisdiction: jurisdiction || 'Uzbekistan',
      status: status || 'DRAFT',
      version: 1,
      pdfFile: null,
      fields: fields || [],
      aiConfig: aiConfig || {
        model: 'gpt-5.4-mini',
        language: 'uz',
        temperature: 0.7,
        systemPrompt: '',
        maxTurns: 10,
        fieldQuestions: [],
        triggerKeywords: [],
        triggerSignal: '',
      },
      review: review || { requiresLawyerReview: false, signatureRequired: false, signatureFields: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'system',
    };

    db.templates.push(newTemplate);
    auditLog(db, createdBy || 'system', 'TEMPLATE_CREATED', {
      templateId: newTemplate.id,
      templateName: newTemplate.name,
      version: newTemplate.version,
    });

    await write(db);

    return res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    next(error);
  }
});

// 36. PUT /api/templates/:id - Update template
app.put('/api/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const db = read();
    const template = db.templates.find(t => t.id === id);

    if (!template) {
      throw { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found', status: 404 };
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key in template) {
        template[key] = updates[key];
      }
    });

    // Increment version on update
    template.version += 1;
    template.updatedAt = new Date().toISOString();

    auditLog(db, 'system', 'TEMPLATE_UPDATED', {
      templateId: template.id,
      templateName: template.name,
      version: template.version,
    });

    await write(db);

    return res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// 37. DELETE /api/templates/:id - Delete template
app.delete('/api/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const db = read();
    const templateIndex = db.templates.findIndex(t => t.id === id);

    if (templateIndex === -1) {
      throw { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found', status: 404 };
    }

    db.templates.splice(templateIndex, 1);

    auditLog(db, userId || 'system', 'TEMPLATE_DELETED', { templateId: id });

    await write(db);

    return res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

// 38. POST /api/system/reset - Reset all data (Danger Zone)
app.post('/api/system/reset', async (req, res, next) => {
  try {
    const { userId, confirm } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_USER_ID' });
    }

    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({
        error: 'Confirmation required',
        code: 'CONFIRMATION_REQUIRED',
        message: 'You must send { confirm: "RESET_ALL_DATA" } to proceed',
      });
    }

    const db = read();

    // Collections to clear
    const collectionsToClear = [
      'users',
      'documents',
      'jobs',
      'conversations',
      'disputes',
      'notifications',
      'automations',
      'aiChats',
    ];

    // Clear collections
    const clearedCollections = [];
    collectionsToClear.forEach(collection => {
      if (db[collection]) {
        db[collection] = [];
        clearedCollections.push(collection);
      }
    });

    // Create audit log before clearing
    auditLog(db, userId, 'DATA_RESET', {
      clearedCollections,
      timestamp: new Date().toISOString(),
    });

    await write(db);

    return res.json({
      success: true,
      message: 'All data has been reset',
      data: {
        clearedCollections,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 38. GET /api/system/config - Get system configuration
app.get('/api/system/config', (req, res, next) => {
  try {
    const db = read();
    
    return res.json({
      success: true,
      data: db.systemConfig || {
        ai: { masterPrompt: '' },
        suggestionRules: { specializationMatchWeight: 0.6, responseTimeWeight: 0.4 },
        featureFlags: {},
      },
    });
  } catch (error) {
    next(error);
  }
});

// 39. PUT /api/system/config - Update system configuration
app.put('/api/system/config', async (req, res, next) => {
  try {
    const { ai, suggestionRules, featureFlags } = req.body;

    // Validation
    if (ai && ai.masterPrompt) {
      if (ai.masterPrompt.trim().length === 0) {
        return res.status(400).json({
          error: 'Master prompt cannot be empty',
          code: 'INVALID_MASTER_PROMPT',
        });
      }

      if (ai.masterPrompt.length > 2000) {
        return res.status(400).json({
          error: 'Master prompt must be less than 2000 characters',
          code: 'MASTER_PROMPT_TOO_LONG',
        });
      }
    }

    if (suggestionRules) {
      const { specializationMatchWeight, responseTimeWeight } = suggestionRules;

      if (specializationMatchWeight !== undefined && responseTimeWeight !== undefined) {
        const sum = specializationMatchWeight + responseTimeWeight;

        if (sum > 1.0) {
          return res.status(400).json({
            error: 'Sum of weights must not exceed 1.0',
            code: 'INVALID_WEIGHTS',
            details: `Current sum: ${sum}`,
          });
        }
      }
    }

    const db = read();

    // Update config
    if (ai) {
      db.systemConfig.ai = { ...db.systemConfig.ai, ...ai };
    }

    if (suggestionRules) {
      db.systemConfig.suggestionRules = { ...db.systemConfig.suggestionRules, ...suggestionRules };
    }

    if (featureFlags) {
      db.systemConfig.featureFlags = { ...db.systemConfig.featureFlags, ...featureFlags };
    }

    auditLog(db, 'system', 'SYSTEM_CONFIG_UPDATED', {
      updatedFields: Object.keys(req.body),
    });

    await write(db);

    return res.json({
      success: true,
      message: 'System configuration updated successfully',
      data: db.systemConfig,
    });
  } catch (error) {
    next(error);
  }
});

// 40. GET /api/notifications - Get notifications for user
app.get('/api/notifications', (req, res, next) => {
  try {
    const { userId } = req.query;
    const db = read();

    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'MISSING_USER_ID' });
    }

    const notifications = db.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// 41. POST /api/notifications/:id/read - Mark notification as read
app.post('/api/notifications/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = read();
    const notification = db.notifications.find(n => n.id === id);

    if (!notification) {
      throw { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found', status: 404 };
    }

    notification.read = true;
    await write(db);

    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

// 42. POST /api/reviews/:id - Update review
app.put('/api/reviews/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const db = read();
    let reviewFound = false;

    // Find review in any lawyer's reviews
    for (const lawyer of db.lawyers) {
      const review = lawyer.reviews.find(r => r.id === id);
      if (review) {
        reviewFound = true;

        if (rating !== undefined) {
          review.rating = rating;
        }

        if (comment !== undefined) {
          review.comment = comment;
        }

        recalculateRating(lawyer);
        break;
      }
    }

    if (!reviewFound) {
      throw { code: 'REVIEW_NOT_FOUND', message: 'Review not found', status: 404 };
    }

    await write(db);

    return res.json({ success: true, message: 'Review updated' });
  } catch (error) {
    next(error);
  }
});

// 43. DELETE /api/reviews/:id - Delete review
app.delete('/api/reviews/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const db = read();
    let reviewDeleted = false;

    for (const lawyer of db.lawyers) {
      const reviewIndex = lawyer.reviews.findIndex(r => r.id === id);
      if (reviewIndex !== -1) {
        lawyer.reviews.splice(reviewIndex, 1);
        recalculateRating(lawyer);
        reviewDeleted = true;
        break;
      }
    }

    if (!reviewDeleted) {
      throw { code: 'REVIEW_NOT_FOUND', message: 'Review not found', status: 404 };
    }

    await write(db);

    return res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
});

app.listen(PORT, () => {
  console.log(`[server] Initializing database...`);
  dbInit();
  console.log(`[server] Server running on port ${PORT}`);
});

export default app;
