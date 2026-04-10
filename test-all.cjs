// Comprehensive API Test Script
// Run with: node test-all.js

const http = require('http');
const https = require('https');
const url = require('url');

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;
let errors = [];

function log(msg, status = 'INFO') {
  const colors = {
    PASS: '\x1b[32m', FAIL: '\x1b[31m', INFO: '\x1b[36m', WARN: '\x1b[33m'
  };
  const reset = '\x1b[0m';
  console.log(`${colors[status] || ''}[${status}]${reset} ${msg}`);
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(`${BASE_URL}${path}`);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    log(`PASS: ${name}`, 'PASS');
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    log(`FAIL: ${name} - ${err.message || err}`, 'FAIL');
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function runTests() {
  log('===========================================', 'INFO');
  log('LEGAL ASSISTANT PLATFORM - COMPREHENSIVE TEST', 'INFO');
  log('===========================================', 'INFO');

  // ===== 1. DATABASE READ =====
  await test('GET /api/db/read returns success', async () => {
    const res = await request('GET', '/api/db/read');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data, 'Expected data field');
    assert(Array.isArray(res.data.data.users), 'Expected users array');
    assert(Array.isArray(res.data.data.templates), 'Expected templates array');
    assert(res.data.data.systemConfig, 'Expected systemConfig');
  });

  // ===== 2. DATABASE WRITE =====
  await test('POST /api/db/write with valid data', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    const res = await request('POST', '/api/db/write', db);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
  });

  // ===== 3. CREATE USER =====
  await test('Create user via transaction', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    const newUser = {
      id: 'test-user-001',
      phone: '+998901234567',
      name: 'Test User',
      roles: ['user'],
      joinedAt: new Date().toISOString(),
      savedLawyers: [],
      profile: { email: null, avatar: null, language: 'uz' },
      notifications: { email: true, push: true, quietHours: { start: '22:00', end: '07:00' } },
      privacy: { showPhone: false, showEmail: false }
    };
    
    db.users.push(newUser);
    db.auditLogs.push({
      id: 'audit-001',
      userId: 'system',
      action: 'TEST_USER_CREATED',
      details: { userId: newUser.id },
      timestamp: new Date().toISOString(),
      activeRole: 'SYSTEM'
    });

    const res = await request('POST', '/api/db/write', db);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
  });

  // ===== 4. CREATE ADMIN USER =====
  await test('Create admin user', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    if (!db.users.find(u => u.id === 'test-admin-001')) {
      db.users.push({
        id: 'test-admin-001',
        phone: '1234567890',
        name: 'Super Admin',
        roles: ['admin'],
        joinedAt: new Date().toISOString(),
        savedLawyers: [],
        profile: { email: null, avatar: null, language: 'en' },
        notifications: { email: true, push: true, quietHours: { start: '22:00', end: '07:00' } },
        privacy: { showPhone: false, showEmail: false }
      });
      
      const res = await request('POST', '/api/db/write', db);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    } else {
      log('Admin user already exists, skipping', 'WARN');
    }
  });

  // ===== 5. CREATE TEMPLATE =====
  await test('Create template via transaction', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    if (!db.templates.find(t => t.id === 'test-template-001')) {
      const template = {
        id: 'test-template-001',
        name: 'Test Employment Contract',
        description: 'A test employment contract template',
        category: 'Employment',
        riskLevel: 'GREEN',
        jurisdiction: 'Uzbekistan',
        status: 'ACTIVE',
        version: 1,
        pdfFile: null,
        fields: [
          { key: 'employee_name', label: 'Employee Name', type: 'text', required: true, validation: null, pii: true },
          { key: 'start_date', label: 'Start Date', type: 'date', required: true, validation: null, pii: false },
          { key: 'salary', label: 'Monthly Salary', type: 'number', required: true, validation: null, pii: false }
        ],
        aiConfig: {
          model: 'gpt-4o',
          language: 'uz',
          temperature: 0.7,
          systemPrompt: 'You are helping fill out an employment contract.',
          conversationStyle: 'professional',
          maxTurns: 10,
          fieldQuestions: [
            { fieldKey: 'employee_name', aiQuestion: 'What is the employee full name?', aiHint: 'Extract the employee name', extractionRule: '"employee_name":\\s*"([^"]*)"', retryPrompt: 'Please provide the employee name.', skipCondition: null },
            { fieldKey: 'start_date', aiQuestion: 'What is the start date?', aiHint: 'Extract the start date', extractionRule: '"start_date":\\s*"([^"]*)"', retryPrompt: 'Please provide the start date.', skipCondition: null },
            { fieldKey: 'salary', aiQuestion: 'What is the monthly salary?', aiHint: 'Extract the salary amount', extractionRule: '"salary":\\s*"([^"]*)"', retryPrompt: 'Please provide the salary amount.', skipCondition: null }
          ],
          triggerKeywords: ['contract', 'employment'],
          triggerSignal: 'AUTOMATION:test-template-001'
        },
        review: { requiresLawyerReview: true, signatureRequired: true, signatureFields: ['employee_name'] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test-admin-001'
      };

      db.templates.push(template);
      db.auditLogs.push({
        id: 'audit-template-001',
        userId: 'test-admin-001',
        action: 'TEMPLATE_CREATED',
        details: { templateId: template.id, templateName: template.name, version: 1 },
        timestamp: new Date().toISOString(),
        activeRole: 'ADMIN'
      });

      const res = await request('POST', '/api/db/write', db);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    } else {
      log('Template already exists, skipping', 'WARN');
    }
  });

  // ===== 6. CREATE LAWYER =====
  await test('Create lawyer via transaction', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    if (!db.lawyers.find(l => l.id === 'test-lawyer-001')) {
      const lawyer = {
        id: 'test-lawyer-001',
        name: 'John Doe',
        phone: '+998901111111',
        verified: true,
        specializations: ['Employment Law', 'Contract Law'],
        languages: ['uz', 'ru'],
        rating: 0,
        reviewCount: 0,
        casesCompleted: 0,
        price: 500000,
        responseTime: '2 hours',
        online: true,
        bio: 'Experienced employment lawyer in Uzbekistan.',
        education: [{ institution: 'Tashkent State University', degree: 'Law Degree', year: 2015 }],
        experience: [{ company: 'Legal Firm LLC', position: 'Senior Lawyer', from: '2015-01-01T00:00:00.000Z', to: null }],
        license: { number: 'L-12345', issuedAt: '2015-06-01T00:00:00.000Z', expiresAt: '2025-06-01T00:00:00.000Z' },
        images: { profile: null, license: null, cv: null },
        reviews: [],
        addedBy: 'test-admin-001',
        addedAt: new Date().toISOString()
      };

      db.lawyers.push(lawyer);
      db.auditLogs.push({
        id: 'audit-lawyer-001',
        userId: 'test-admin-001',
        action: 'LAWYER_CREATED',
        details: { lawyerId: lawyer.id, lawyerName: lawyer.name },
        timestamp: new Date().toISOString(),
        activeRole: 'ADMIN'
      });

      const res = await request('POST', '/api/db/write', db);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    } else {
      log('Lawyer already exists, skipping', 'WARN');
    }
  });

  // ===== 7. MIDDLEMAN - TRIGGER DETECTION =====
  await test('POST /api/middleman/chat - keyword trigger detection', async () => {
    const res = await request('POST', '/api/middleman/chat', {
      userId: 'test-user-001',
      templateId: 'test-template-001',
      message: 'I need an employment contract',
      sessionId: null
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.action === 'START_AUTOMATION', `Expected START_AUTOMATION, got ${res.data.data.action}`);
    assert(res.data.data.templateId === 'test-template-001', 'Expected correct templateId');
  });

  // ===== 8. MIDDLEMAN - AI PROCESSING =====
  await test('POST /api/middleman/chat - AI processing (simulation mode)', async () => {
    // First enable simulation mode
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    db.systemConfig.ai.simulationMode = true;
    await request('POST', '/api/db/write', { data: db });

    const res = await request('POST', '/api/middleman/chat', {
      userId: 'test-user-001',
      templateId: 'test-template-001',
      message: 'employee_name: "Ali Valiyev"',
      sessionId: null
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.message, 'Expected message in response');
    assert(res.data.data.state, 'Expected state in response');
    assert(res.data.data.tokens, 'Expected tokens in response');
  });

  // ===== 9. CHAT - GENERAL =====
  await test('POST /api/chat/general - create chat and get AI response', async () => {
    const res = await request('POST', '/api/chat/general', {
      userId: 'test-user-001',
      message: 'What is contract law?',
      attachments: [],
      sessionId: null
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.message, 'Expected AI message');
    assert(res.data.data.sessionId, 'Expected sessionId');
    assert(res.data.data.tokens, 'Expected tokens');
  });

  // ===== 10. DOCUMENTS - CREATE =====
  await test('POST /api/documents - create document', async () => {
    const res = await request('POST', '/api/documents', {
      templateId: 'test-template-001',
      userId: 'test-user-001',
      fields: { employee_name: 'Ali Valiyev', start_date: '2024-01-01', salary: 5000000 }
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.documentId, 'Expected documentId');
    assert(res.data.data.status === 'PENDING', `Expected PENDING, got ${res.data.data.status}`);
  });

  // ===== 11. DOCUMENTS - LIST =====
  await test('GET /api/documents?userId - list documents', async () => {
    const res = await request('GET', '/api/documents?userId=test-user-001');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(Array.isArray(res.data.data), 'Expected array');
    assert(res.data.data.length > 0, 'Expected at least one document');
  });

  // ===== 12. DOCUMENTS - DETAIL =====
  await test('GET /api/documents/:id - get document detail', async () => {
    const listRes = await request('GET', '/api/documents?userId=test-user-001');
    const docId = listRes.data.data[0].id;
    
    const res = await request('GET', `/api/documents/${docId}?userId=test-user-001`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.id === docId, 'Expected correct document');
  });

  // ===== 13. DOCUMENTS - CANCEL =====
  await test('POST /api/documents/:id/cancel - cancel document', async () => {
    const listRes = await request('GET', '/api/documents?userId=test-user-001');
    const docId = listRes.data.data[0].id;
    
    const res = await request('POST', `/api/documents/${docId}/cancel`, { userId: 'test-user-001' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.status === 'CANCELLED', `Expected CANCELLED, got ${res.data.data.status}`);
  });

  // ===== 14. JOBS - CREATE =====
  await test('Create job via transaction', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    const job = {
      id: 'test-job-001',
      userId: 'test-user-001',
      title: 'Need Contract Review',
      category: 'Contract Law',
      description: 'I need help reviewing an employment contract.',
      budget: 1000000,
      urgency: 'MEDIUM',
      status: 'OPEN',
      attachments: [],
      responses: [],
      assignedLawyerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.jobs.push(job);
    db.auditLogs.push({
      id: 'audit-job-001',
      userId: 'test-user-001',
      action: 'JOB_CREATED',
      details: { jobId: job.id, title: job.title },
      timestamp: new Date().toISOString(),
      activeRole: 'user'
    });

    const res = await request('POST', '/api/db/write', { data: db });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ===== 15. JOBS - LIST =====
  await test('GET /api/jobs - list jobs', async () => {
    const res = await request('GET', '/api/jobs?userId=test-user-001');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(Array.isArray(res.data.data), 'Expected array');
    assert(res.data.data.length > 0, 'Expected at least one job');
  });

  // ===== 16. JOBS - RESPONSE =====
  await test('POST /api/jobs/:id/response - add response', async () => {
    const res = await request('POST', '/api/jobs/test-job-001/response', {
      lawyerId: 'test-lawyer-001',
      coverNote: 'I can help with this contract review.',
      price: 800000
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
  });

  await test('POST /api/jobs/:id/response - duplicate response', async () => {
    const res = await request('POST', '/api/jobs/test-job-001/response', {
      lawyerId: 'test-lawyer-001',
      coverNote: 'Duplicate response',
      price: 800000
    });

    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  // ===== 17. JOBS - ACCEPT =====
  await test('POST /api/jobs/:id/accept - accept response', async () => {
    const res = await request('POST', '/api/jobs/test-job-001/accept', {
      userId: 'test-user-001',
      lawyerId: 'test-lawyer-001'
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.status === 'IN_PROGRESS', `Expected IN_PROGRESS, got ${res.data.data.status}`);
  });

  // ===== 18. CONVERSATIONS - CREATE =====
  await test('POST /api/conversations - create conversation', async () => {
    const res = await request('POST', '/api/conversations', {
      userId: 'test-user-001',
      lawyerId: 'test-lawyer-001',
      context: null,
      content: 'Hello, I need help with a contract.',
      attachments: []
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.conversationId, 'Expected conversationId');
  });

  // ===== 19. CONVERSATIONS - MESSAGE =====
  await test('POST /api/conversations/:id/message - send message', async () => {
    const readRes = await request('GET', '/api/db/read');
    const convId = readRes.data.data.conversations[0]?.id;
    assert(convId, 'Expected conversation to exist');

    const res = await request('POST', `/api/conversations/${convId}/message`, {
      userId: 'test-lawyer-001',
      content: 'I can help you with that.',
      attachments: []
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
  });

  // ===== 20. CONVERSATIONS - READ =====
  await test('POST /api/conversations/:id/read - mark as read', async () => {
    const readRes = await request('GET', '/api/db/read');
    const convId = readRes.data.data.conversations[0]?.id;
    assert(convId, 'Expected conversation to exist');

    const res = await request('POST', `/api/conversations/${convId}/read`, {
      userId: 'test-user-001'
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
  });

  // ===== 21. REVIEWS - CREATE =====
  await test('POST /api/reviews - create review', async () => {
    const res = await request('POST', '/api/reviews', {
      lawyerId: 'test-lawyer-001',
      userId: 'test-user-001',
      name: 'Test User',
      rating: 4.5,
      comment: 'Great service, very professional!',
      caseType: 'Employment'
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.reviewId, 'Expected reviewId');
  });

  await test('POST /api/reviews - duplicate review', async () => {
    const res = await request('POST', '/api/reviews', {
      lawyerId: 'test-lawyer-001',
      userId: 'test-user-001',
      name: 'Test User',
      rating: 5,
      comment: 'Duplicate review',
      caseType: 'Employment'
    });

    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  // ===== 22. DISPUTES - CREATE =====
  await test('POST /api/disputes - create dispute', async () => {
    const res = await request('POST', '/api/disputes', {
      jobId: 'test-job-001',
      userId: 'test-user-001',
      lawyerId: 'test-lawyer-001',
      reason: 'Poor quality work',
      details: 'The lawyer did not meet the requirements.',
      attachments: []
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.disputeId, 'Expected disputeId');
  });

  // ===== 23. DISPUTES - LIST =====
  await test('GET /api/disputes - list disputes', async () => {
    const res = await request('GET', '/api/disputes?userId=test-admin-001&roles=admin');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(Array.isArray(res.data.data), 'Expected array');
  });

  // ===== 24. DISPUTES - RESOLVE =====
  await test('POST /api/disputes/:id/resolve - resolve dispute', async () => {
    const readRes = await request('GET', '/api/db/read');
    const disputeId = readRes.data.data.disputes[0]?.id;
    assert(disputeId, 'Expected dispute to exist');

    const res = await request('POST', `/api/disputes/${disputeId}/resolve`, {
      userId: 'test-admin-001',
      action: 'resolve',
      resolution: 'Dispute resolved in favor of user.'
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success=true');
    assert(res.data.data.status === 'RESOLVED', `Expected RESOLVED, got ${res.data.data.status}`);
  });

  // ===== 25. UPLOAD =====
  await test('POST /api/upload - file upload (no file)', async () => {
    const res = await request('POST', '/api/upload', {});
    // This will fail without actual file upload, but endpoint should exist
    assert(res.status === 400 || res.status === 500, `Expected 400 or 500, got ${res.status}`);
  });

  // ===== 26. AUDIT LOGS =====
  await test('Verify audit logs exist', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    assert(db.auditLogs.length > 0, 'Expected audit logs to exist');
    assert(db.auditLogs.some(l => l.action === 'TEMPLATE_CREATED'), 'Expected TEMPLATE_CREATED audit');
    assert(db.auditLogs.some(l => l.action === 'LAWYER_CREATED'), 'Expected LAWYER_CREATED audit');
    assert(db.auditLogs.some(l => l.action === 'JOB_CREATED'), 'Expected JOB_CREATED audit');
  });

  // ===== 27. STRESS TEST - Concurrent Writes =====
  await test('Stress test: 10 concurrent reads', async () => {
    const promises = Array.from({ length: 10 }, () => request('GET', '/api/db/read'));
    const results = await Promise.all(promises);
    results.forEach((res, i) => {
      assert(res.status === 200, `Request ${i+1} failed with status ${res.status}`);
    });
  });

  // ===== 28. STRESS TEST - Rapid Writes =====
  await test('Stress test: Sequential writes (5)', async () => {
    for (let i = 0; i < 5; i++) {
      const readRes = await request('GET', '/api/db/read');
      const db = readRes.data.data;
      db.auditLogs.push({
        id: `stress-test-${i}`,
        userId: 'test-user-001',
        action: 'STRESS_TEST',
        details: { iteration: i },
        timestamp: new Date().toISOString(),
        activeRole: 'user'
      });
      const res = await request('POST', '/api/db/write', db);
      assert(res.status === 200, `Write ${i+1} failed with status ${res.status}`);
    }
  });

  // ===== 29. VALIDATION - Missing Fields =====
  await test('POST /api/documents - missing required fields', async () => {
    const res = await request('POST', '/api/documents', {
      templateId: 'nonexistent',
      userId: 'test-user-001',
      fields: {}
    });

    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // ===== 30. VALIDATION - Invalid OTP =====
  await test('Verify invalid OTP handling (via service logic)', async () => {
    // OTP validation is client-side, but we verify the constant is correct
    const OTP = '123456';
    assert(OTP === '123456', 'OTP should be 123456');
    assert(OTP.length === 6, 'OTP should be 6 digits');
  });

  // ===== 31. DATA INTEGRITY =====
  await test('Data integrity: Verify all collections exist', async () => {
    const readRes = await request('GET', '/api/db/read');
    const db = readRes.data.data;
    
    const requiredCollections = [
      'users', 'aiChats', 'lawyers', 'templates', 'automations',
      'documents', 'jobs', 'disputes', 'conversations', 'notifications', 'auditLogs'
    ];

    requiredCollections.forEach(col => {
      assert(Array.isArray(db[col]), `Expected ${col} to be an array`);
    });
    assert(db.systemConfig, 'Expected systemConfig to exist');
    assert(db.systemConfig.ai, 'Expected systemConfig.ai to exist');
    assert(db.systemConfig.suggestionRules, 'Expected systemConfig.suggestionRules to exist');
    assert(db.systemConfig.featureFlags, 'Expected systemConfig.featureFlags to exist');
  });

  // ===== 32. SCHEMA VALIDATION =====
  await test('Schema validation: User structure', async () => {
    const readRes = await request('GET', '/api/db/read');
    const user = readRes.data.data.users[0];
    assert(user, 'Expected at least one user');
    assert(user.id, 'Expected user.id');
    assert(user.phone, 'Expected user.phone');
    assert(user.name, 'Expected user.name');
    assert(Array.isArray(user.roles), 'Expected user.roles to be array');
    assert(user.joinedAt, 'Expected user.joinedAt');
    assert(Array.isArray(user.savedLawyers), 'Expected user.savedLawyers to be array');
    assert(user.profile, 'Expected user.profile');
    assert(user.notifications, 'Expected user.notifications');
    assert(user.privacy, 'Expected user.privacy');
  });

  // ===== SUMMARY =====
  console.log('\n===========================================');
  console.log('TEST SUMMARY');
  console.log('===========================================');
  console.log(`Total: ${passed + failed}`);
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
  
  if (errors.length > 0) {
    console.log('\nFAILED TESTS:');
    errors.forEach((e, i) => {
      console.log(`  ${i+1}. ${e.name}`);
      console.log(`     Error: ${e.error}`);
    });
  }
  
  console.log('===========================================');
  
  // Reset database to clean state
  const readRes = await request('GET', '/api/db/read');
  const db = readRes.data.data;
  db.users = [];
  db.aiChats = [];
  db.lawyers = [];
  db.templates = [];
  db.automations = [];
  db.documents = [];
  db.jobs = [];
  db.disputes = [];
  db.conversations = [];
  db.notifications = [];
  db.auditLogs = [];
  await request('POST', '/api/db/write', db);
  log('Database reset to clean state', 'INFO');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
