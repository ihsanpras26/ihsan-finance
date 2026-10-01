// scripts/dev.mjs: run the API and the Vite dev server together.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const isWindows = process.platform === 'win32';

const children = [];

function run(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, shell: isWindows, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}] `;
  const forward = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) target.write(`${prefix}${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}berhenti dengan kode ${code ?? 0}\n`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Menjalankan API dan antarmuka web. Tekan Ctrl+C untuk berhenti.');
console.log('API  : http://127.0.0.1:8787');
// Vite binds IPv6 localhost here, so 127.0.0.1 would print a URL that does not answer.
console.log('Web  : http://localhost:5173 (proksi /api ke API)');
console.log('');

run('api', 'node', ['--watch', 'server/src/main.ts'], root);
run('web', 'pnpm', ['--dir', 'web', 'dev'], root);
