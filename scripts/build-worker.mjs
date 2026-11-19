// Bundles worker/index.ts into dist/_worker.js (Cloudflare Pages advanced mode).
import { build } from 'esbuild';

await build({
  entryPoints: ['worker/index.ts'],
  outfile: 'dist/_worker.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  minify: true,
  legalComments: 'none',
});
console.log('Built dist/_worker.js');
