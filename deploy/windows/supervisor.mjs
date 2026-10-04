import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { configuration, currentRelease, writeJson, safeCode, safeEnvironment } from './runtime.mjs';

const config = configuration(), stateFile = path.join(config.run, 'supervisor-state.json'), controlFile = path.join(config.run, 'api-control.json');
let child, stopping = false, launching = false, runningRelease = null, lastControl = '', crashes = 0;
try { lastControl = JSON.parse(fs.readFileSync(controlFile, 'utf8')).id || ''; } catch {}
let logDay = '', logSequence = 0, logSize = 0, logFile;
function log(line) {
  const day = new Date().toISOString().slice(0, 10), buffer = Buffer.from(line.endsWith('\n') ? line : line + '\n');
  if (day !== logDay || logSize + buffer.length > 20 * 1024 * 1024) {
    if (day !== logDay) logSequence = 0; else logSequence++;
    logDay = day; logFile = path.join(config.logs, `api-${day}-${process.pid}-${logSequence}.jsonl`); logSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  }
  fs.appendFileSync(logFile, buffer, { mode: 0o600 }); logSize += buffer.length;
}
function event(name, fields = {}) { log(JSON.stringify({ time: new Date().toISOString(), service: 'abujalife-supervisor', event: name, ...fields })); }
function state(status) { writeJson(stateFile, { supervisorPid: process.pid, apiPid: child?.pid || null, releaseId: runningRelease?.releaseId || null, revision: runningRelease?.revision || null, status, updatedAt: new Date().toISOString() }); }
async function closeChild() {
  const active = child;
  if (!active || active.exitCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { active.kill(); resolve(); }, 15000);
    active.once('exit', () => { clearTimeout(timeout); resolve(); });
    try { active.send({ type: 'shutdown' }); } catch { active.kill(); }
  });
}
async function launch() {
  if (stopping || launching || child) return;
  launching = true;
  try {
    runningRelease = currentRelease(config);
    const active = spawn(config.nodePath, [path.join(runningRelease.directory, 'deploy', 'windows', 'api.mjs')], { cwd: runningRelease.directory, env: { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child = active; state('starting');
    active.stdout.on('data', data => log(data.toString())); active.stderr.on('data', data => log(data.toString()));
    active.on('message', message => { if (message?.type === 'ready') { crashes = 0; state('ready'); event('api_ready', { releaseId: runningRelease.releaseId, port: config.apiPort }); } });
    active.once('error', error => event('api_spawn_failure', { code: safeCode(error) }));
    let completed = false;
    active.once('close', (code, signal) => {
      if (completed) return;
      completed = true;
      if (child === active) child = null;
      event('api_exit', { code, signal }); state(stopping ? 'stopped' : 'restarting');
      if (!stopping) setTimeout(() => void launch(), Math.min(30000, 1000 * 2 ** Math.min(crashes++, 5)));
    });
  } catch (error) {
    event('supervisor_launch_failure', { code: safeCode(error) });
    if (!stopping) setTimeout(() => void launch(), 5000);
  } finally { launching = false; }
}
const timer = setInterval(async () => {
  if (stopping) return;
  let command; try { command = JSON.parse(fs.readFileSync(controlFile, 'utf8')); } catch { return; }
  if (!command.id || command.id === lastControl || !['reload', 'stop'].includes(command.command)) return;
  lastControl = command.id;
  if (command.command === 'stop') {
    stopping = true; clearInterval(timer); state('stopping'); await closeChild(); state('stopped'); process.exit(0);
  }
  event('reload_requested'); await closeChild(); await launch();
}, 1000);
function pruneLogs() {
  const threshold = Date.now() - config.logRetentionDays * 86400000;
  for (const name of fs.readdirSync(config.logs)) if (/^((api|backup)-.*\.jsonl|mongo\.log\..*)$/.test(name)) {
    const file = path.join(config.logs, name); if (file !== logFile && fs.statSync(file).mtimeMs < threshold) fs.rmSync(file);
  }
}
pruneLogs(); setInterval(pruneLogs, 3600000).unref();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { stopping = true; clearInterval(timer); await closeChild(); state('stopped'); process.exit(0); });
process.on('uncaughtException', () => { event('supervisor_crash', { code: 'uncaught_exception' }); child?.kill(); process.exit(1); });
process.on('unhandledRejection', () => { event('supervisor_crash', { code: 'unhandled_rejection' }); child?.kill(); process.exit(1); });
event('supervisor_start', { instanceId: randomUUID() }); await launch();
