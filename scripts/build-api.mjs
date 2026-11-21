// Bundles the API worker (api/src) into api/dist/index.js for profjero-edu-api.
import { build } from 'esbuild';

await build({
  entryPoints: ['api/src/index.ts'],
  outfile: 'api/dist/index.js',
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
console.log('Built api/dist/index.js');
