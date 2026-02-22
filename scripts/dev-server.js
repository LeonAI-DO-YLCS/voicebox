#!/usr/bin/env node
/**
 * Backend development launcher with automatic port fallback.
 */

const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = parsePort(process.env.VOICEBOX_SERVER_PORT, 17493);
const HOST = process.env.VOICEBOX_SERVER_HOST || '127.0.0.1';
const ENABLE_RELOAD = process.env.VOICEBOX_SERVER_RELOAD !== '0';
const VENV_PYTHON =
  process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'backend', '.venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'backend', '.venv', 'bin', 'python');

function parsePort(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(startPort, maxAttempts = 300) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (candidate > 65535) {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find a free backend port after ${maxAttempts} attempts starting at ${startPort}`);
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function backendDepsReady() {
  if (!fs.existsSync(VENV_PYTHON)) {
    return false;
  }
  const result = spawnSync(VENV_PYTHON, ['-c', 'import fastapi,uvicorn'], {
    stdio: 'ignore',
    cwd: PROJECT_ROOT,
  });
  return result.status === 0;
}

async function main() {
  if (!commandExists('uv')) {
    throw new Error(
      'uv is required but not installed. Install it first: https://docs.astral.sh/uv/getting-started/installation/',
    );
  }
  if (!fs.existsSync(VENV_PYTHON)) {
    throw new Error(
      'backend/.venv is missing. Run `bun run setup:python` before starting the backend.',
    );
  }
  if (!backendDepsReady()) {
    throw new Error(
      'backend/.venv is missing required packages. Run `bun run setup:python` before starting the backend.',
    );
  }

  const port = await findFreePort(DEFAULT_PORT);

  const args = [
    'run',
    '--python',
    VENV_PYTHON,
    '-m',
    'uvicorn',
    'backend.main:app',
    '--host',
    HOST,
    '--port',
    String(port),
  ];
  if (ENABLE_RELOAD) {
    args.push('--reload');
  }

  const env = {
    ...process.env,
    VOICEBOX_SERVER_PORT: String(port),
  };

  if (port !== DEFAULT_PORT) {
    console.log(`[dev:server] Port ${DEFAULT_PORT} is busy, using ${port}`);
  } else {
    console.log(`[dev:server] Using port ${port}`);
  }
  console.log(`[dev:server] URL: http://${HOST}:${port}`);

  const child = spawn('uv', args, {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[dev:server] Failed to start backend.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
