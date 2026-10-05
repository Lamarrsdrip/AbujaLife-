import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { verifyRelease } from '../verify-release.mjs';
import { configuration, writeJson, waitHealth, health, safeEnvironment, acquireLock } from './runtime.mjs';

if (process.platform !== 'win32') throw new Error('Use this deployment helper only on Windows.');
const config = configuration(), source = path.resolve(process.argv[2] || process.cwd()), currentFile = path.join(config.state, 'current.json'), lockFile = path.join(config.shared, 'deployment.lock');
const { descriptor: lock } = acquireLock(lockFile, 'deploy');
let candidate, previous, promoted = false, mongoLock;
function command(executable, args, cwd, env = safeEnvironment()) {
  execFileSync(executable, args, { cwd, env, stdio: 'inherit', windowsHide: true });
}
function ps(script) { command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], config.root); }
function requestReload() { writeJson(path.join(config.run, 'api-control.json'), { id: randomUUID(), command: 'reload', requestedAt: new Date().toISOString() }); }
async function waitRelease(releaseId, timeout = 60000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    let state; try { state = JSON.parse(fs.readFileSync(path.join(config.run, 'supervisor-state.json'), 'utf8')); } catch {}
    if (state?.releaseId === releaseId && state.status === 'ready' && await health(config.apiPort)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The promoted API did not report ready and healthy.');
}
async function closeCandidate() {
  if (!candidate || candidate.exitCode !== null) return;
  const active = candidate;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { active.kill(); resolve(); }, 15000);
    active.once('exit', () => { clearTimeout(timeout); resolve(); });
    try { active.send({ type: 'shutdown' }); } catch { active.kill(); }
  });
  candidate = null;
}
try {
  const checked = verifyRelease(source);
  if (checked.manifest.workingTreeChanged !== false) throw new Error('Production promotion requires a clean, committed release manifest.');
  const destination = path.join(config.releases, checked.releaseId);
  if (fs.existsSync(destination)) verifyRelease(destination);
  else {
    fs.mkdirSync(destination, { recursive: false });
    for (const item of checked.manifest.files) {
      const target = path.join(destination, item.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(source, item.path), target);
    }
    fs.copyFileSync(path.join(source, 'RELEASE.json'), path.join(destination, 'RELEASE.json'));
    verifyRelease(destination);
  }
  if (!fs.existsSync(path.join(destination, 'scripts', 'qa.mjs')) || !fs.existsSync(path.join(destination, 'tests'))) throw new Error('The release must include the source QA/build scripts and tests.');
  const npm = path.join(path.dirname(config.nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  // Build/QA see public configuration only; they never receive runtime secrets.
  const buildEnv = { ...safeEnvironment(), PUBLIC_WEB_URL: config.publicWebUrl, API_PUBLIC_URL: config.apiPublicUrl };
  for (const name of ['MONGODB_URI', 'ABUJALIFE_CONFIG_KEY', 'RESEND_API_KEY', 'EMAIL_FROM']) delete buildEnv[name];
  command(config.nodePath, [npm, 'ci', '--no-audit', '--no-fund'], destination, buildEnv);
  command(config.nodePath, [npm, 'run', 'qa'], destination, buildEnv);
  command(config.nodePath, ['--test', 'deploy/windows/runtime.test.mjs'], destination, buildEnv);
  command(config.nodePath, [npm, 'run', 'build'], destination, buildEnv);
  verifyRelease(destination);
  previous = fs.existsSync(currentFile) ? JSON.parse(fs.readFileSync(currentFile, 'utf8')) : null;
  if (previous) {
    // A validated, encrypted rollback snapshot precedes privileged schema changes.
    const backupScript = path.join(config.releases, previous.releaseId, 'deploy', 'windows', 'backup.mjs');
    command(config.nodePath, [backupScript], path.dirname(path.dirname(path.dirname(backupScript))), { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root });
  }
  mongoLock = acquireLock(path.join(config.shared, 'mongo-operations.lock'), 'deploy');
  command(config.nodePath, [path.join(destination, 'deploy', 'windows', 'bootstrap-mongo.mjs')], destination, { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root });
  command(config.nodePath, [path.join(destination, 'deploy', 'windows', 'bootstrap-jackpot.mjs')], destination, { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root });
  if (await health(18788)) throw new Error('The private candidate port is already occupied.');
  candidate = spawn(config.nodePath, [path.join(destination, 'deploy', 'windows', 'api.mjs')], { cwd: destination, env: { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root, ABUJALIFE_CANDIDATE_PORT: '18788' }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The candidate did not report ready.')), 45000);
    candidate.once('error', error => { clearTimeout(timeout); reject(error); });
    candidate.once('exit', code => { clearTimeout(timeout); reject(new Error('The candidate exited before it became ready: ' + code)); });
    candidate.on('message', message => { if (message?.type === 'ready' && message.port === 18788) { clearTimeout(timeout); resolve(); } });
  });
  await waitHealth(18788); await closeCandidate();
  const next = { releaseId: checked.releaseId, revision: checked.manifest.revision, promotedAt: new Date().toISOString() };
  if (previous) writeJson(path.join(config.state, 'previous.json'), previous);
  writeJson(path.join(destination, 'QA.json'), { ok: true, deterministicInstall: true, tests: 'npm run qa', productionBuild: true, candidateHealth: true, revision: next.revision, checkedAt: new Date().toISOString() });
  writeJson(currentFile, next); promoted = true;
  requestReload();
  ps("$ErrorActionPreference='Stop'; $task=Get-ScheduledTask -TaskName 'AbujaLife-API'; if($task.State -ne 'Running'){Start-ScheduledTask -TaskName 'AbujaLife-API'}");
  await waitRelease(next.releaseId);
  console.log(JSON.stringify({ ok: true, ...next, port: config.apiPort, binding: '127.0.0.1', task: config.apiTask }));
} catch (error) {
  await closeCandidate();
  if (promoted && previous) {
    writeJson(currentFile, previous); requestReload();
    await waitRelease(previous.releaseId);
    console.error('The new release failed promotion; the previous healthy AbujaLife release was restored.');
  } else if (promoted) {
    writeJson(path.join(config.run, 'api-control.json'), { id: randomUUID(), command: 'stop' });
    fs.rmSync(currentFile, { force: true });
  }
  throw error;
} finally {
  if (mongoLock) { fs.closeSync(mongoLock.descriptor); fs.rmSync(path.join(config.shared, 'mongo-operations.lock'), { force: true }); }
  fs.closeSync(lock); fs.rmSync(lockFile, { force: true });
}
