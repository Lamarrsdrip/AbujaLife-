import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { configuration, currentRelease, safeEnvironment } from './runtime.mjs';

const config = configuration(), release = currentRelease(config);
const argument = process.argv[2];
if (argument && argument !== '--recover-stale-lock') throw new Error('Unsupported backup runner option.');
const script = argument === '--recover-stale-lock' ? 'recover-backup-lock.mjs' : 'backup.mjs';
const log = fs.openSync(path.join(config.logs, `backup-${new Date().toISOString().slice(0, 10)}.jsonl`), 'a', 0o600);
const child = spawn(config.nodePath, [path.join(release.directory, 'deploy', 'windows', script)], { cwd: release.directory, env: { ...safeEnvironment(), ABUJALIFE_WINDOWS_ROOT: config.root }, stdio: ['ignore', log, log], windowsHide: true });
let closed = false;
function closeLog() { if (!closed) { closed = true; fs.closeSync(log); } }
child.once('error', () => { closeLog(); process.exitCode = 1; });
child.once('exit', code => { closeLog(); process.exitCode = code ?? 1; });
