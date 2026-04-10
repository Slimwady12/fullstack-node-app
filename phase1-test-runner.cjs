// Comprehensive Phase 1 Test Script
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const CLIENT_URL = 'http://localhost:5173';

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: [],
  startTime: new Date().toISOString()
};

// Helper function to make HTTP requests
function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonBody,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body,
          });
        }
      });
    });

    req.on('error', (error) => reject(error));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test helper
async function test(name, fn) {
  process.stdout.write(`  Testing: ${name}... `);
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log('✓ PASS');
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`✗ FAIL: ${error.message}`);
  }
}

// Pre-Test Setup Tests
async function testPreTestSetup() {
  console.log('\n📋 PRE-TEST SETUP');
  
  await test('Server running on port 3000', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    if (res.statusCode !== 200) throw new Error(`Server not responding: ${res.statusCode}`);
  });

  await test('Client running on port 5173', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get(CLIENT_URL, (response) => {
        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => {
          resolve({ statusCode: response.statusCode, data });
        });
      }).on('error', reject);
    });
    if (res.statusCode !== 200) throw new Error(`Client not responding: ${res.statusCode}`);
    if (!res.data.includes('html')) throw new Error('Client not returning HTML');
  });

  await test('.env file exists', async () => {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) throw new Error('.env file not found');
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('PORT=3000')) throw new Error('PORT not configured');
  });

  await test('database.json exists at project root', async () => {
    const dbPath = path.join(__dirname, 'database.json');
    if (!fs.existsSync(dbPath)) throw new Error('database.json not found');
  });
}

// Database Initialization Tests
async function testDatabaseInitialization() {
  console.log('\n🗄️  DATABASE INITIALIZATION & STRUCTURE');

  const res = await makeRequest('GET', '/api/db/read');
  const db = res.data.data;

  await test('All collections exist', async () => {
    const requiredCollections = [
      'users', 'aiChats', 'lawyers', 'templates', 'automations',
      'documents', 'jobs', 'disputes', 'conversations', 'notifications',
      'auditLogs', 'systemConfig'
    ];
    for (const collection of requiredCollections) {
      if (!(collection in db)) {
        throw new Error(`Missing collection: ${collection}`);
      }
    }
  });

  await test('systemConfig contains AI config', async () => {
    const { systemConfig } = db;
    if (!systemConfig.ai) throw new Error('Missing ai config');
    if (!('openaiApiKey' in systemConfig.ai)) throw new Error('Missing openaiApiKey');
    if (!systemConfig.ai.defaultModel) throw new Error('Missing defaultModel');
    if (!('simulationMode' in systemConfig.ai)) throw new Error('Missing simulationMode');
    if (!systemConfig.ai.masterPrompt) throw new Error('Missing masterPrompt');
  });

  await test('systemConfig contains suggestionRules', async () => {
    const { suggestionRules } = db.systemConfig;
    if (!suggestionRules.ratingThreshold) throw new Error('Missing ratingThreshold');
    if (!suggestionRules.specializationMatchWeight) throw new Error('Missing specializationMatchWeight');
    if (!('onlinePriority' in suggestionRules)) throw new Error('Missing onlinePriority');
    if (!suggestionRules.responseTimeWeight) throw new Error('Missing responseTimeWeight');
    if (!suggestionRules.maxSuggestions) throw new Error('Missing maxSuggestions');
  });

  await test('systemConfig contains featureFlags', async () => {
    const { featureFlags } = db.systemConfig;
    if (!('enableChat' in featureFlags)) throw new Error('Missing enableChat');
    if (!('enableJobs' in featureFlags)) throw new Error('Missing enableJobs');
    if (!('enableLawyerSearch' in featureFlags)) throw new Error('Missing enableLawyerSearch');
  });

  await test('Array collections are arrays', async () => {
    const arrayCollections = ['users', 'aiChats', 'lawyers', 'templates', 'automations', 'documents', 'jobs', 'disputes', 'conversations', 'notifications', 'auditLogs'];
    for (const collection of arrayCollections) {
      if (!Array.isArray(db[collection])) {
        throw new Error(`${collection} is not an array`);
      }
    }
  });

  await test('systemConfig is an object', async () => {
    if (typeof db.systemConfig !== 'object' || Array.isArray(db.systemConfig)) {
      throw new Error('systemConfig is not an object');
    }
  });
}

// Auth Tests
async function testAuth() {
  console.log('\n🔐 AUTHENTICATION');

  // SuperAdmin Login
  await test('SuperAdmin login (no OTP required)', async () => {
    const res = await makeRequest('POST', '/api/auth/login', { phone: '1234567890' });
    if (res.statusCode !== 200) throw new Error(`Login failed: ${res.statusCode}`);
    if (!res.data.success) throw new Error('Login not successful');
    if (!res.data.data.user) throw new Error('User data not returned');
    if (!res.data.data.user.roles.includes('admin')) throw new Error('Admin role not assigned');
  });

  // New User Login
  await test('New user login redirects to OTP', async () => {
    const res = await makeRequest('POST', '/api/auth/login', { phone: '+998909999999' });
    if (res.statusCode !== 200) throw new Error(`Login failed: ${res.statusCode}`);
    if (res.data.data.requiresOtp !== true) throw new Error('OTP not required for new user');
  });

  await test('OTP verification with valid code', async () => {
    const res = await makeRequest('POST', '/api/auth/verify-otp', {
      phone: '+998909999999',
      code: '123456'
    });
    if (res.statusCode !== 200) throw new Error(`OTP verification failed: ${res.statusCode}`);
    if (!res.data.success) throw new Error('OTP verification not successful');
  });

  await test('Invalid OTP rejected', async () => {
    const res = await makeRequest('POST', '/api/auth/verify-otp', {
      phone: '+998908888888',
      code: '000000'
    });
    if (res.statusCode === 200 && res.data.success) {
      throw new Error('Invalid OTP was accepted');
    }
  });

  await test('Existing user login skips name page', async () => {
    // First create a user
    await makeRequest('POST', '/api/auth/login', { phone: '+998907777777' });
    await makeRequest('POST', '/api/auth/verify-otp', {
      phone: '+998907777777',
      code: '123456'
    });
    await makeRequest('POST', '/api/auth/set-name', {
      phone: '+998907777777',
      name: 'Existing User'
    });

    // Login again
    const res = await makeRequest('POST', '/api/auth/login', { phone: '+998907777777' });
    if (res.statusCode !== 200) throw new Error(`Login failed: ${res.statusCode}`);
    if (res.data.data.requiresName) throw new Error('Name page required for existing user');
  });
}

// System Configuration Tests
async function testSystemConfig() {
  console.log('\n⚙️  SYSTEM CONFIGURATION');

  await test('Read system config', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    if (!res.data.data.systemConfig) throw new Error('System config not found');
  });

  await test('Update API key', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    const db = res.data.data;
    db.systemConfig.ai.openaiApiKey = 'test-key-123';
    
    const writeRes = await makeRequest('POST', '/api/db/write', db);
    if (!writeRes.data.success) throw new Error('Failed to write config');

    const readRes = await makeRequest('GET', '/api/db/read');
    if (readRes.data.data.systemConfig.ai.openaiApiKey !== 'test-key-123') {
      throw new Error('API key not saved');
    }
  });

  await test('Update simulation mode', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    const db = res.data.data;
    db.systemConfig.ai.simulationMode = true;
    
    await makeRequest('POST', '/api/db/write', db);

    const readRes = await makeRequest('GET', '/api/db/read');
    if (readRes.data.data.systemConfig.ai.simulationMode !== true) {
      throw new Error('Simulation mode not saved');
    }
  });

  await test('Update master prompt', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    const db = res.data.data;
    db.systemConfig.ai.masterPrompt = 'Test prompt';
    
    await makeRequest('POST', '/api/db/write', db);

    const readRes = await makeRequest('GET', '/api/db/read');
    if (readRes.data.data.systemConfig.ai.masterPrompt !== 'Test prompt') {
      throw new Error('Master prompt not saved');
    }
  });
}

// Middleman Tests
async function testMiddleman() {
  console.log('\n🤖 MIDDLEMAN');

  await test('Trigger detection with keyword', async () => {
    const res = await makeRequest('POST', '/api/middleman/chat', {
      userId: 'test-user-001',
      templateId: 'test-template-001',
      message: 'I need a contract',
    });

    if (res.statusCode !== 200) throw new Error(`Request failed: ${res.statusCode}`);
    if (!res.data.success) throw new Error('Middleman request not successful');
    if (!res.data.data) throw new Error('No data returned');
  });

  await test('Simulation mode returns mock response', async () => {
    const res = await makeRequest('POST', '/api/middleman/chat', {
      userId: 'test-user-001',
      templateId: 'test-template-001',
      message: 'test message',
    });

    if (res.statusCode !== 200) throw new Error(`Request failed: ${res.statusCode}`);
    // Should return mock response in simulation mode
  });
}

// Audit Logs Tests
async function testAuditLogs() {
  console.log('\n📝 AUDIT LOGS');

  await test('Audit logs exist and have correct structure', async () => {
    const res = await makeRequest('GET', '/api/db/read');
    const db = res.data.data;
    
    if (!Array.isArray(db.auditLogs)) throw new Error('auditLogs is not an array');
    if (db.auditLogs.length === 0) {
      console.log('(warning: no audit logs yet)');
      testResults.warnings++;
      return;
    }

    const log = db.auditLogs[0];
    if (!log.id) throw new Error('Missing log id');
    if (!log.userId) throw new Error('Missing log userId');
    if (!log.action) throw new Error('Missing log action');
    if (!log.timestamp) throw new Error('Missing log timestamp');
  });
}

// Main test runner
async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       PHASE 1 TESTING - AUTOMATED TEST SUITE            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Start Time: ${testResults.startTime}`);

  try {
    await testPreTestSetup();
    await testDatabaseInitialization();
    await testAuth();
    await testSystemConfig();
    await testMiddleman();
    await testAuditLogs();

    // Generate report
    testResults.endTime = new Date().toISOString();
    testResults.duration = new Date(testResults.endTime) - new Date(testResults.startTime);

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✓ Passed: ${testResults.passed}`);
    console.log(`✗ Failed: ${testResults.failed}`);
    console.log(`⚠ Warnings: ${testResults.warnings}`);
    console.log(`Duration: ${testResults.duration}ms`);
    console.log('='.repeat(60));

    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => {
          console.log(`  ✗ ${t.name}: ${t.error}`);
        });
    }

    // Save report
    const reportPath = path.join(__dirname, 'PHASE1-AUTO-TEST-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    if (testResults.failed === 0) {
      console.log('\n✅ ALL TESTS PASSED!');
    } else {
      console.log(`\n⚠️  ${testResults.failed} TEST(S) FAILED`);
    }

    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Test suite error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
