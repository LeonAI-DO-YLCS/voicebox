#!/usr/bin/env node
/**
 * Development launcher that picks available frontend/backend ports
 * and starts Tauri with a matching devUrl override.
 */

const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TAURI_DIR = path.join(PROJECT_ROOT, 'tauri');
const BACKEND_VENV_PYTHON =
  process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'backend', '.venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'backend', '.venv', 'bin', 'python');

const DEFAULT_FRONTEND_PORT = parsePort(process.env.TAURI_DEV_FRONTEND_PORT, 5173);
const DEFAULT_BACKEND_PORT = parsePort(process.env.VOICEBOX_SERVER_PORT, 17493);

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

function isPortFree(port, host = 'localhost') {
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
  throw new Error(`Could not find a free port after ${maxAttempts} attempts starting at ${startPort}`);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const exitDetails = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`${command} ${args.join(' ')} failed with ${exitDetails}`));
    });
  });
}

function backendDepsReady() {
  if (!fs.existsSync(BACKEND_VENV_PYTHON)) {
    return false;
  }
  const result = spawnSync(BACKEND_VENV_PYTHON, ['-c', 'import fastapi,uvicorn'], {
    stdio: 'ignore',
    cwd: PROJECT_ROOT,
  });
  return result.status === 0;
}

async function main() {
  const frontendPort = await findFreePort(DEFAULT_FRONTEND_PORT);
  const backendPort = await findFreePort(DEFAULT_BACKEND_PORT);

  console.log(`[dev] Frontend port: ${frontendPort}`);
  console.log(`[dev] Backend port: ${backendPort}`);

  const sharedEnv = {
    ...process.env,
    TAURI_DEV_FRONTEND_PORT: String(frontendPort),
    VOICEBOX_SERVER_PORT: String(backendPort),
  };

  if (!backendDepsReady()) {
    console.log('[dev] backend/.venv missing or incomplete. Running Python setup with uv...');
    await run('bun', ['run', 'setup:python'], {
      cwd: PROJECT_ROOT,
      env: sharedEnv,
    });
  }

  await run('bun', ['run', 'scripts/setup-dev-sidecar.js'], {
    cwd: PROJECT_ROOT,
    env: sharedEnv,
  });

  const configOverride = JSON.stringify({
    build: {
      devUrl: `http://localhost:${frontendPort}`,
    },
  });

  await run('bun', ['run', 'tauri', 'dev', '--config', configOverride], {
    cwd: TAURI_DIR,
    env: sharedEnv,
  });
}

main().catch((error) => {
  console.error('[dev] Failed to launch Tauri dev environment.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
