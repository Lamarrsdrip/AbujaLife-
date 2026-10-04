import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function configuration(root = process.env.ABUJALIFE_WINDOWS_ROOT || 'C:\\services\\abujalife') {
  const base = path.resolve(root), config = JSON.parse(fs.readFileSync(path.join(base, 'shared', 'windows.json'), 'utf8'));
  if (config.database !== 'abujalife_prod' || config.replicaSet !== 'abujalife' || config.mongoHost !== '127.0.0.1:27017' || config.apiPort !== 18787 || config.mongoService !== 'AbujaLifeMongoDB' || config.apiTask !== 'AbujaLife-API') throw new Error('Only the dedicated AbujaLife Windows resources are permitted.');
  for (const name of ['nodePath', 'mongodPath', 'mongoToolsDirectory']) if (!path.isAbsolute(config[name]) || !fs.existsSync(config[name])) throw new Error(`${name} must identify an installed runtime.`);
  for (const name of ['publicWebUrl', 'apiPublicUrl']) {
    const url = new URL(config[name]);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || /^(localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname)) throw new Error(`${name} must identify a public HTTPS origin.`);
  }
  return { ...config, root: base, shared: path.join(base, 'shared'), state: path.join(base, 'shared', 'state'), run: path.join(base, 'shared', 'run'), secrets: path.join(base, 'shared', '.secrets'), releases: path.join(base, 'releases'), backups: path.join(base, 'shared', 'backups'), logs: path.join(base, 'shared', 'logs') };
}

export function secret(config, name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid secret filename.');
  return fs.readFileSync(path.join(config.secrets, name), 'utf8').trim();
}

export function mongoUri(config, user = 'abujalife_app', password = 'mongo-app-password', authSource = config.database) {
  return `mongodb://${user}:${encodeURIComponent(secret(config, password))}@${config.mongoHost}/${config.database}?replicaSet=${config.replicaSet}&authSource=${authSource}&directConnection=true`;
}

export function apiEnvironment(config, port = config.apiPort) {
  const env = { ...safeEnvironment(), NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), MONGODB_DATABASE: config.database, MONGODB_URI: mongoUri(config), PUBLIC_WEB_URL: config.publicWebUrl, API_PUBLIC_URL: config.apiPublicUrl, CORS_ORIGINS: config.corsOrigins.join(','), TRUST_PROXY: '1', ABUJALIFE_CONFIG_KEY: secret(config, 'config-key') };
  // Optional provider secrets are server-only and are never included in a build.
  const providers = path.join(config.shared, 'providers.json');
  if (fs.existsSync(providers)) {
    const values = JSON.parse(fs.readFileSync(providers, 'utf8'));
    for (const key of ['RESEND_API_KEY', 'EMAIL_FROM']) if (typeof values[key] === 'string' && values[key]) env[key] = values[key];
  }
  return env;
}

export function safeEnvironment() {
  const env = {};
  // Machine-wide credentials from unrelated applications never enter AbujaLife.
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'COMSPEC', 'ComSpec', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'CommonProgramFiles', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']) if (typeof process.env[name] === 'string') env[name] = process.env[name];
  return env;
}

export function acquireLock(file, purpose = 'operation') {
  let recovered = false, previous;
  if (fs.existsSync(file)) {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isSafeInteger(old.pid) || old.pid < 1) throw new Error('Inspect the malformed operation lock before continuing.');
    if (lockOwnerRunning(old)) throw new Error('Another operation owns the deployment/backup lock.');
    fs.rmSync(file); recovered = true; previous = old;
  }
  const descriptor = fs.openSync(file, 'wx', 0o600);
  fs.writeSync(descriptor, JSON.stringify({ pid: process.pid, purpose, startedAt: new Date().toISOString() }));
  return { descriptor, recovered, previous };
}

export function lockOwnerRunning(recorded) {
  if (!Number.isSafeInteger(recorded.pid) || recorded.pid < 1 || !Number.isFinite(Date.parse(recorded.startedAt))) throw new Error('Inspect the malformed operation lock before continuing.');
  try { process.kill(recorded.pid, 0); }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  if (process.platform === 'win32') {
    const script = `$p=Get-Process -Id ${recorded.pid} -ErrorAction Stop; ([DateTimeOffset]$p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()`;
    let started;
    try { started = Number(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', env: safeEnvironment(), stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()); }
    catch {
      try { process.kill(recorded.pid, 0); } catch (error) { if (error.code === 'ESRCH') return false; }
      throw new Error('Cannot verify the process that owns this operation lock.');
    }
    if (!Number.isFinite(started)) throw new Error('Cannot verify the operation process start time.');
    // A process created after the lock timestamp is a reused Windows PID.
    if (started > Date.parse(recorded.startedAt) + 1000) return false;
  }
  return true;
}

export function safeCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{1,60}$/.test(error.code) ? error.code : 'operation_failed';
}

export function writeJson(file, value) {
  const temp = `${file}.${process.pid}.partial`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}

export async function health(port, timeout = 2000) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(timeout) });
    const data = await response.json();
    return response.ok && data.ok === true && data.storage === 'mongodb';
  } catch { return false; }
}

export async function waitHealth(port, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await health(port)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The private production health check did not pass.');
}

export function currentRelease(config) {
  const value = JSON.parse(fs.readFileSync(path.join(config.state, 'current.json'), 'utf8'));
  if (!/^[a-f0-9]{12}-[a-f0-9]{12}$/.test(value.releaseId) || !/^[a-f0-9]{40}$/.test(value.revision)) throw new Error('Invalid deployed release record.');
  const directory = path.join(config.releases, value.releaseId);
  if (!fs.existsSync(path.join(directory, 'deploy', 'windows', 'api.mjs'))) throw new Error('The deployed release is missing its private entrypoint.');
  return { ...value, directory };
}
