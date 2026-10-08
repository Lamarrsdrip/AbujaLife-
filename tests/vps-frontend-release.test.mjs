import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const deploy = fs.readFileSync('deploy/windows/deploy.mjs', 'utf8');
const frontend = fs.readFileSync('deploy/windows/configure-frontend.ps1', 'utf8');
const qaCompose = fs.readFileSync('deploy/compose.qa.yml', 'utf8');
const releasePackager = fs.readFileSync('deploy/package-release.mjs', 'utf8');
const workflowPath = '.github/workflows/frontend-deploy.yml';

test('VPS frontend changes only after the promoted API reports healthy', () => {
  const healthy = deploy.indexOf('await waitRelease(next.releaseId);');
  const switchFrontend = deploy.indexOf('configure-frontend.ps1');
  assert.ok(healthy >= 0 && switchFrontend > healthy);
  assert.match(deploy, /-ReleaseDirectory', destination/);
});

test('Caddy serves the release manifest revision and validates before activation', () => {
  assert.match(frontend, /revision = \[string\]\$releaseManifest\.revision/);
  assert.match(frontend, /validate --config \$candidate --adapter caddyfile/);
  assert.ok(frontend.indexOf('validate --config $candidate') < frontend.indexOf('[IO.File]::Replace($candidate, $config, $backup)'));
  assert.match(frontend, /Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(frontend, /Cache-Control "no-cache, no-store, must-revalidate"/);
  assert.match(frontend, /rewrite @admin \/admin\/index\.html/);
  assert.match(frontend, /# BEGIN ABUJALIFE FRONTEND/);
});

test('AbujaLife Caddy clears the HTTP/3 advertisement without editing other sites', () => {
  assert.match(frontend, /Alt-Svc "clear"/);
  assert.match(fs.readFileSync('deploy/caddy-api.snippet', 'utf8'), /header Alt-Svc clear/);
  assert.match(fs.readFileSync('deploy/configure-caddy.ps1', 'utf8'), /header Alt-Svc clear/);
  const clear = fs.readFileSync('deploy/windows/clear-quic-advertisement.ps1', 'utf8');
  assert.match(clear, /\^api\\.abujacity\\.life/);
  assert.match(clear, /header Alt-Svc clear/);
  assert.ok(deploy.indexOf('clear-quic-advertisement.ps1') > deploy.indexOf('configure-frontend.ps1'));
});

test('frontend CI validates the build without publishing a drifting Hostinger branch', { skip: !fs.existsSync(workflowPath) }, () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /Verify the static site ships in the VPS release/);
  assert.doesNotMatch(workflow, /git push --force/);
  assert.doesNotMatch(workflow, /hostinger-production/);
});

test('production source archives include documentation consumed by release QA', () => {
  assert.match(releasePackager, /allowedFiles\s*=\s*\[[^\]]*['"]docs\/ABUJALIFE_ADS\.md['"]/s);
});

test('the disposable Mongo infrastructure fixture publishes only a loopback port', () => {
  assert.match(qaCompose, /host_ip:\s*127\.0\.0\.1/);
  assert.match(qaCompose, /published:\s*"0"/);
  assert.match(fs.readFileSync('deploy/test-production.mjs', 'utf8'), /HostIp==='127\.0\.0\.1'/);
});
