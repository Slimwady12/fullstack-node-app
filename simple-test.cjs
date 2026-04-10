const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data.substring(0, 500)}`);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTest() {
  try {
    console.log('Testing server connection...');
    await makeRequest('/api/db/read');
    console.log('\nSUCCESS: Server is running!');
  } catch (err) {
    console.error('\nFAILED: Server is not running or not responding');
    console.error('Error:', err.message);
  }
}

runTest();
