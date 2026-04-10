// Stress Test Script
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let responseTimes = [];

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    totalRequests++;
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), responseTime });
        } catch {
          resolve({ status: res.statusCode, data, responseTime });
        }
      });
    });

    req.on('error', (err) => {
      failedRequests++;
      reject(err);
    });

    req.setTimeout(5000, () => { 
      req.destroy(); 
      failedRequests++;
      reject(new Error('Timeout')); 
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function stressTest(name, concurrentRequests, path, body = null) {
  console.log(`\n[STRESS TEST] ${name}`);
  console.log(`  Running ${concurrentRequests} concurrent requests to ${path}`);
  
  const promises = Array.from({ length: concurrentRequests }, (_, i) => 
    request('GET', path).catch(err => ({ error: err.message }))
  );
  
  const results = await Promise.allSettled(promises);
  
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.status >= 200 && r.value.status < 300).length;
  const failures = results.filter(r => r.status === 'rejected' || r.value.status < 200 || r.value.status >= 300).length;
  const avgTime = responseTimes.length > 0 
    ? responseTimes.slice(-concurrentRequests).reduce((a, b) => a + b, 0) / concurrentRequests 
    : 0;
  
  console.log(`  ✓ Success: ${successes}/${concurrentRequests}`);
  console.log(`  ✗ Failed: ${failures}/${concurrentRequests}`);
  console.log(`  ⏱️  Avg Response Time: ${avgTime.toFixed(2)}ms`);
  
  return { successes, failures, avgTime };
}

async function runStressTests() {
  console.log('===========================================');
  console.log('STRESS TESTING SUITE');
  console.log('===========================================');
  
  try {
    // Test 1: Concurrent reads
    await stressTest('Database Read Concurrency', 20, '/api/db/read');
    
    // Test 2: Rapid sequential writes
    console.log('\n[STRESS TEST] Rapid Sequential Writes');
    console.log('  Running 10 sequential writes...');
    
    for (let i = 0; i < 10; i++) {
      const readRes = await request('GET', '/api/db/read');
      const db = readRes.data.data;
      db.auditLogs.push({
        id: `stress-${Date.now()}-${i}`,
        userId: 'system',
        action: 'STRESS_TEST_WRITE',
        details: { iteration: i, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
        activeRole: 'SYSTEM'
      });
      
      try {
        const writeRes = await request('POST', '/api/db/write', db);
        if (writeRes.status === 200) {
          console.log(`    ✓ Write ${i + 1}/10 succeeded (${writeRes.responseTime}ms)`);
        } else {
          console.log(`    ✗ Write ${i + 1}/10 failed: ${writeRes.status}`);
        }
      } catch (err) {
        console.log(`    ✗ Write ${i + 1}/10 error: ${err.message}`);
      }
    }
    
    // Test 3: Multiple document creation
    await stressTest('Document Creation', 5, '/api/documents?userId=test-user-001');
    
    // Test 4: Multiple job listing
    await stressTest('Job Listing', 5, '/api/jobs?userId=test-user-001');
    
    // Test 5: Concurrent template reads
    await stressTest('Template Read Concurrency', 10, '/api/db/read');
    
    // Summary
    console.log('\n===========================================');
    console.log('STRESS TEST SUMMARY');
    console.log('===========================================');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Failed: ${failedRequests}`);
    console.log(`Success Rate: ${((successfulRequests / totalRequests) * 100).toFixed(2)}%`);
    
    if (responseTimes.length > 0) {
      const sorted = [...responseTimes].sort((a, b) => a - b);
      console.log(`\nResponse Time Statistics:`);
      console.log(`  Min: ${sorted[0]}ms`);
      console.log(`  Max: ${sorted[sorted.length - 1]}ms`);
      console.log(`  Avg: ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)}ms`);
      console.log(`  P50: ${sorted[Math.floor(sorted.length * 0.5)]}ms`);
      console.log(`  P95: ${sorted[Math.floor(sorted.length * 0.95)]}ms`);
      console.log(`  P99: ${sorted[Math.floor(sorted.length * 0.99)]}ms`);
    }
    
    console.log('\n===========================================');
    
    if (failedRequests === 0) {
      console.log('✅ ALL STRESS TESTS PASSED');
    } else {
      console.log('⚠️  SOME STRESS TESTS FAILED');
    }
    
  } catch (error) {
    console.error('\n❌ Stress test error:', error.message);
  }
}

runStressTests();
