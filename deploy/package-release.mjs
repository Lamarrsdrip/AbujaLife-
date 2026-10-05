#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'abujacity-release.tar.gz'));
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'abujacity-release-'));
const allowedRoots = ['app', 'src', 'deploy', 'scripts', 'tests', 'preview'];
const allowedFiles = ['Dockerfile', '.dockerignore', '.env.example', 'package.json', 'package-lock.json', 'docs/PRODUCTION_DEPLOYMENT.md', 'docs/ADMIN_PAYMENTS.md'];
const exampleFiles = new Set(['.env.example','deploy/.env.example']);
const privateFile = entry => !exampleFiles.has(entry) && /(^|\/)(\.env(?:\..*)?|\.local|\.secrets|backups|releases|node_modules|\.git)(\/|$)/.test(entry) || /\.(?:sqlite|db)(?:-.*)?$|\.(?:log|enc|partial)$|\.(?:tar\.gz|zip)$/i.test(entry);
const files = [];
function copyFile(relative) {
  if (privateFile(relative)) return;
  const source = path.join(root, relative), target = path.join(stage, relative);
  const stat = fs.lstatSync(source);
  if (!stat.isFile()) throw new Error(`Only regular release files are permitted: ${relative}`);
  const content = fs.readFileSync(source);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content, {mode: stat.mode & 0o777});
  files.push({path: relative, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex')});
}
function copyTree(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), {withFileTypes: true})) {
    const next = path.join(relative, entry.name);
    if (privateFile(next)) continue;
    if (entry.isDirectory()) copyTree(next);
    else copyFile(next);
  }
}
try {
  for (const relative of allowedRoots) copyTree(relative);
  for (const relative of allowedFiles) copyFile(relative);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim());
  fs.writeFileSync(path.join(stage, 'RELEASE.json'), JSON.stringify({application: 'AbujaLife',mode:'production-mongodb-api',publicOrigin:'https://abujacity.life',apiPublicOrigin:'https://api.abujacity.life',database:'abujalife_prod',revision,workingTreeChanged:dirty,createdAt:new Date().toISOString(),files}, null, 2) + '\n');
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  execFileSync('tar', ['-czf', destination, '-C', stage, '.']);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
  fs.writeFileSync(destination + '.sha256', `${sha256}  ${path.basename(destination)}\n`, {mode: 0o644});
  console.log(JSON.stringify({ok: true,archive: destination,sha256,files: files.length,revision,workingTreeChanged: dirty}));
} finally {
  fs.rmSync(stage, {recursive: true, force: true});
}
