#!/usr/bin/env node

import http from 'http';

const BASE_URL = 'http://127.0.0.1:8000';

function testEndpoint(path, name, needsAuth = false) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8000,
      path: path,
      method: 'GET',
      timeout: 2000,
    };

    if (needsAuth) {
      options.headers = {
        'x-app-secret': 'secret-key-not-expose-backend-outside-app'
      };
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const status = res.statusCode === 200 ? '✅' : '❌';
        console.log(`${status} ${name}: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode !== 200) {
          console.log(`   Response: ${data.substring(0, 100)}`);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${name}: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${name}: Timeout (backend may not be running)`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function runDiagnostics() {
  console.log('🔍 Backend Diagnostic Tests\n');
  console.log(`Testing: ${BASE_URL}\n`);

  const results = await Promise.all([
    testEndpoint('/health', 'Health Check', false),
    testEndpoint('/', 'Root Endpoint', true),
  ]);

  const allPassed = results.every(r => r);
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All tests passed! Backend is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check if backend is running:');
    console.log('   npm run dev-backend');
    process.exit(1);
  }
}

runDiagnostics();

