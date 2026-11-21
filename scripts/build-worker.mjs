// Bundles worker/index.ts into dist/_worker.js (Cloudflare Pages advanced mode).
import { build } from 'esbuild';

await build({
  entryPoints: ['worker/index.ts'],
  outfile: 'dist/_worker.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['worker', 'browser', 'import'],
  external: ['node:*'], // provided by the Workers runtime (nodejs_compat)
  minify: true,
  legalComments: 'none',
});
console.log('Built dist/_worker.js');
