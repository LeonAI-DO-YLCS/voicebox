#!/usr/bin/env node
/**
 * Set up backend Python environment using uv (mandatory).
 */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
const VENV_DIR = path.join(BACKEND_DIR, '.venv');
const VENV_PYTHON =
  process.platform === 'win32'
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function detectPython() {
  const candidates = ['python3.12', 'python3.11', 'python3'];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function main() {
  if (!commandExists('uv')) {
    throw new Error(
      'uv is required but not installed. Install it first: https://docs.astral.sh/uv/getting-started/installation/',
    );
  }

  const python = detectPython();
  if (!python) {
    throw new Error('Python 3.11+ is required but no compatible python3 executable was found.');
  }

  console.log(`[setup:python] Using ${python}`);
  const shouldClear = process.env.UV_VENV_CLEAR === '1';
  const hasVenvDir = fs.existsSync(VENV_DIR);
  const hasVenvPython = fs.existsSync(VENV_PYTHON);

  if (shouldClear) {
    console.log('[setup:python] Recreating backend .venv with uv (--clear)...');
    run('uv', ['venv', '--clear', '--python', python, VENV_DIR]);
  } else if (!hasVenvDir || !hasVenvPython) {
    const args = ['venv', '--python', python];
    if (hasVenvDir && !hasVenvPython) {
      args.push('--clear');
    }
    args.push(VENV_DIR);
    console.log('[setup:python] Creating backend .venv with uv...');
    run('uv', args);
  } else {
    console.log('[setup:python] Reusing existing backend/.venv');
  }

  console.log('[setup:python] Installing backend dependencies...');
  run('uv', ['pip', 'install', '--python', VENV_PYTHON, '-r', path.join(BACKEND_DIR, 'requirements.txt')]);

  if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    console.log('[setup:python] Detected Apple Silicon. Installing MLX dependencies...');
    run('uv', [
      'pip',
      'install',
      '--python',
      VENV_PYTHON,
      '-r',
      path.join(BACKEND_DIR, 'requirements-mlx.txt'),
    ]);
  }

  console.log('[setup:python] Installing Qwen3-TTS...');
  run('uv', [
    'pip',
    'install',
    '--python',
    VENV_PYTHON,
    'git+https://github.com/QwenLM/Qwen3-TTS.git',
  ]);

  if (!fs.existsSync(VENV_PYTHON)) {
    throw new Error(`Expected virtual environment python at ${VENV_PYTHON}, but it was not found.`);
  }

  console.log('[setup:python] Complete.');
  console.log(`[setup:python] Python env: ${VENV_DIR}`);
}

try {
  main();
} catch (error) {
  console.error('[setup:python] Failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
