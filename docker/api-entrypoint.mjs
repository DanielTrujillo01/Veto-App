import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secure = /^(1|true|yes)$/i.test(process.env.SMTP_SECURE ?? '');
const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;

if (!process.env.SMTP_URL && host && user && password) {
  const port = process.env.SMTP_PORT || (secure ? '465' : '587');
  const scheme = secure ? 'smtps' : 'smtp';
  const url = new URL(scheme + '://' + host + ':' + port);
  url.username = user;
  url.password = password;
  process.env.SMTP_URL = url.toString();
}

if (!process.env.SMTP_FROM && process.env.MAIL_FROM) {
  process.env.SMTP_FROM = process.env.MAIL_FROM;
}

const apiDirectory = fileURLToPath(new URL('../apps/api/', import.meta.url));
const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiDirectory,
  env: process.env,
  stdio: 'inherit',
});

process.on('SIGINT', () => api.kill('SIGINT'));
process.on('SIGTERM', () => api.kill('SIGTERM'));
api.on('error', (error) => {
  console.error('No se pudo iniciar la API:', error.message);
  process.exitCode = 1;
});
api.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
