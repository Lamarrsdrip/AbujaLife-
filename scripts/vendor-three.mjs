import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'app/vendor');
await fs.mkdir(output, { recursive: true });
// Serve the pinned rendering library locally in the normal ESM client as well
// as in the anonymous preview. No CDN script or runtime package install is used.
await build({
  absWorkingDir: root,
  entryPoints: ['node_modules/three/build/three.module.js'],
  outfile: path.join(output, 'three.module.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
});
await fs.copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(output, 'LICENSE.three.txt'));
console.log('Built local Three.js 0.180.0 renderer asset.');
