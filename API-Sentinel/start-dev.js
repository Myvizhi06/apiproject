/**
 * API Sentinel - Unified Dev Environment Launcher
 * Spawns both Backend Server (with Simulator) and Frontend Vite Server concurrently.
 */

const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('===============================================================');
console.log('🚀 Starting API Sentinel Unified Development Environment');
console.log('   - Backend API & FSM Engine (port 5000)');
console.log('   - Simulator & Mock Services (/api/demo/*)');
console.log('   - Frontend SaaS UI (port 5173 / port 5000)');
console.log('===============================================================');

// 1. Spawn Backend
const serverProc = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: isWin,
});

// 2. Spawn Frontend
const clientProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: isWin,
});

function handleExit(code) {
  serverProc.kill();
  clientProc.kill();
  process.exit(code || 0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
serverProc.on('exit', handleExit);
clientProc.on('exit', handleExit);
