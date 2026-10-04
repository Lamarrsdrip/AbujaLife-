import fs from 'node:fs';
function secret(name, required = false) {
  const file = process.env[`${name}_FILE`];
  if (file) process.env[name] = fs.readFileSync(file, 'utf8').trim();
  if (required && !process.env[name]) throw new Error(`${name} must be configured privately before starting production.`);
  delete process.env[`${name}_FILE`];
}
secret('MONGODB_URI', true);
secret('ABUJALIFE_CONFIG_KEY');
if (process.getuid?.() === 0) {
  process.setgroups([]);
  process.setgid(1000);
  process.setuid(1000);
}
const {startProduction}=await import('../src/server/production.mjs');
await startProduction();
