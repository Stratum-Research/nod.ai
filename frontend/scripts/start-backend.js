#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Script is in frontend/scripts/, so go up two levels to reach project root
const rootDir = path.join(__dirname, '../..');
const backendDir = path.join(rootDir, 'backend');

// Determine the venv Python executable path based on platform
const isWindows = os.platform() === 'win32';
const pythonExecutable = isWindows
  ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
  : path.join(backendDir, 'venv', 'bin', 'python');

// Check if venv exists, if not, provide helpful error
import fs from 'fs';
if (!fs.existsSync(pythonExecutable)) {
  console.error('❌ Backend virtual environment not found!');
  console.error(`   Expected path: ${pythonExecutable}`);
  console.error('\n   Please create the venv first:');
  console.error('   cd backend');
  if (isWindows) {
    console.error('   python -m venv venv');
  } else {
    console.error('   python3 -m venv venv');
  }
  console.error('   pip install -r requirements.txt');
  process.exit(1);
}

// Spawn uvicorn using the venv's Python
const uvicornArgs = [
  '-m',
  'uvicorn',
  'app.app:app',
  '--reload',
  '--host',
  '127.0.0.1',
  '--port',
  '8000',
];

console.log(`🚀 Starting FastAPI backend with ${pythonExecutable}`);
console.log(`📁 Working directory: ${backendDir}`);
console.log(`🔗 Backend will be available at: http://127.0.0.1:8000`);
console.log(`💚 Health check: http://127.0.0.1:8000/health\n`);

const backendProcess = spawn(pythonExecutable, uvicornArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
});

// Add startup diagnostic
setTimeout(async () => {
  try {
    const http = await import('http');
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('\n✅ Backend is UP and responding!');
        } else {
          console.log(`\n⚠️  Backend responded with status ${res.statusCode}`);
        }
      });
    });
    req.on('error', () => {
      console.log('\n⏳ Backend starting... (check again in a few seconds)');
    });
    req.setTimeout(3000, () => req.destroy());
  } catch (e) {
    // Ignore if http module not available
  }
}, 3000);

backendProcess.on('error', (error) => {
  console.error('❌ Failed to start backend:', error.message);
  process.exit(1);
});

backendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Backend exited with code ${code}`);
    process.exit(code);
  }
});

// Handle termination signals
process.on('SIGINT', () => {
  backendProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  backendProcess.kill('SIGTERM');
  process.exit(0);
});

