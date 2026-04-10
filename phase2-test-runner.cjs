const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function request(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== PHASE 2 AUTOMATED TESTS ===\n');
  
  let passed = 0;
  let failed = 0;
  const results = [];

  function test(name, condition, detail = '') {
    if (condition) {
      passed++;
      console.log(`✓ ${name}`);
      results.push({ test: name, status: 'PASS', detail });
    } else {
      failed++;
      console.log(`✗ ${name}${detail ? ' - ' + detail : ''}`);
      results.push({ test: name, status: 'FAIL', detail });
    }
  }

  try {
    // Test 1: Health check
    console.log('\n--- Health Check ---');
    const health = await request('GET', '/api/health');
    test('Server healthy', health.status === 200 && health.data.success);
    test('Database connected', health.data.database === 'connected');
    test('Collections exist', health.data.collections >= 12);

    // Test 2: Auth - Login as SuperAdmin
    console.log('\n--- Auth Tests ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      phone: '1234567890',
      password: 'admin123'
    });
    test('SuperAdmin login works', adminLogin.status === 200 && adminLogin.data.success, 
         adminLogin.data.error || '');
    
    if (adminLogin.data.success && adminLogin.data.token) {
      const adminToken = adminLogin.data.token;
      const adminHeaders = { Authorization: `Bearer ${adminToken}` };

      // Test role-based redirect logic (check user object)
      test('SuperAdmin has admin role', adminLogin.data.user.roles?.includes('admin'));
      test('SuperAdmin has activeRole', adminLogin.data.user.activeRole === 'admin');
    }

    // Test 3: Login as regular user
    const db = JSON.parse(fs.readFileSync('database.json', 'utf-8'));
    const regularUser = db.users?.find(u => !u.roles?.includes('admin'));
    if (regularUser) {
      const userLogin = await request('POST', '/api/auth/login', {
        phone: regularUser.phone,
        password: 'password123'
      });
      test('Regular user login works', userLogin.status === 200 && userLogin.data?.success);
      if (userLogin.data?.user) {
        test('Regular user has user role', userLogin.data.user.roles?.includes('user'));
        test('Regular user activeRole is user', userLogin.data.user.activeRole === 'user');
      }
    }

    // Test 4: Documents API
    console.log('\n--- Documents Tests ---');
    const testUser = regularUser || db.users?.[0];
    const docLogin = await request('POST', '/api/auth/login', {
      phone: testUser?.phone,
      password: testUser?.password || 'password123'
    });
    
    if (docLogin.data.success) {
      const userToken = docLogin.data.token;
      const userId = docLogin.data.user?.id;

      // Create a document
      const template = db.templates?.find(t => t.status === 'ACTIVE') || db.templates?.[0];
      if (template && userId) {
        const createDoc = await request('POST', '/api/documents', {
          templateId: template.id,
          userId: userId,
          fields: { partyA: 'Test User', partyB: 'Test Lawyer' }
        });
        
        test('Document created', createDoc.status === 201 && createDoc.data?.success, 
             createDoc.data?.error || '');
        
        if (createDoc.data?.success && createDoc.data.documentId) {
          const docId = createDoc.data.documentId;
          test('Document has ID', !!docId);

          // Test document detail
          const docDetail = await request('GET', `/api/documents/${docId}`);
          test('Document detail retrieved', docDetail.status === 200);
          
          if (docDetail.data?.data) {
            test('Document has status PENDING', docDetail.data.data.status === 'PENDING');
            test('Document has templateVersion', docDetail.data.data.templateVersion === (template.version || 1));
          }
        }
      }

      // Test 5: Jobs API - Check if endpoint exists
      console.log('\n--- Jobs Tests ---');
      // Jobs use different endpoint structure - check /api/jobs
      const jobsList = await request('GET', '/api/jobs');
      test('Jobs list accessible', jobsList.status === 200);
    }

    // Test 9: SuperAdmin - Document Review
    console.log('\n--- SuperAdmin Tests ---');
    const adminLogin2 = await request('POST', '/api/auth/login', {
      phone: '1234567890',
      password: 'admin123'
    });
    
    if (adminLogin2.data.success) {
      const adminToken = adminLogin2.data.token;

      // Get pending documents
      const docs = await request('GET', '/api/documents?status=PENDING', null,
                                 { Authorization: `Bearer ${adminToken}` });
      test('SuperAdmin can view documents', docs.status === 200);

      // Test system config
      const config = await request('GET', '/api/system/config', null,
                                   { Authorization: `Bearer ${adminToken}` });
      test('System config accessible', config.status === 200);
    }

    // Test 10: No Payment System
    console.log('\n--- No Payment System Check ---');
    const allFiles = [];
    function scanDir(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && !file.name.includes('node_modules') && !file.name.includes('.git')) {
          scanDir(fullPath);
        } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts') || file.name.endsWith('.js')) {
          allFiles.push(fullPath);
        }
      }
    }
    scanDir(path.join(process.cwd(), 'src'));

    let hasPaymentCode = false;
    for (const file of allFiles.slice(0, 50)) { // Check first 50 files
      const content = fs.readFileSync(file, 'utf-8').toLowerCase();
      if (content.includes('payment') || content.includes('subscription') || 
          content.includes('credit') || content.includes('stripe')) {
        console.log(`  Warning: Found payment-related code in ${file}`);
        hasPaymentCode = true;
      }
    }
    test('No payment system code found', !hasPaymentCode, 
         hasPaymentCode ? 'Payment-related code detected' : '');

    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    // Save results
    fs.writeFileSync('PHASE2-TEST-RESULTS.json', JSON.stringify({
      date: new Date().toISOString(),
      passed,
      failed,
      total: passed + failed,
      successRate: ((passed / (passed + failed)) * 100).toFixed(1) + '%',
      results
    }, null, 2));

    console.log('\nDetailed results saved to PHASE2-TEST-RESULTS.json');

  } catch (error) {
    console.error('Test runner error:', error.message);
    console.error(error.stack);
  }
}

runTests();
