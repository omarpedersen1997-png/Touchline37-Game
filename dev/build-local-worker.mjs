// Bygger testserverens Worker (KUN lokalt testmiljø) til .dev-data/build/local-worker.mjs.
// Forudsætter "node build.mjs --web-draft" (genererede filer til web-draft).
// shared/engine-versions.js udskiftes med dev/engine-versions-local.js, så kampmotor 11
// kan vælges lokalt. Produktionsbygningen (build.mjs) påvirkes ikke.
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_WORKER = resolve(ROOT, '.dev-data', 'build', 'local-worker.mjs');
const PRODUCTION_VERSIONS = resolve(ROOT, 'shared', 'engine-versions.js');
const LOCAL_VERSIONS = resolve(ROOT, 'dev', 'engine-versions-local.js');

const localVersions = {
  name: 'local-engine-versions',
  setup(b) {
    b.onResolve({ filter: /engine-versions\.js$/ }, (args) => {
      const target = resolve(args.resolveDir, args.path);
      if (target !== PRODUCTION_VERSIONS || args.importer === LOCAL_VERSIONS) return undefined;
      return { path: LOCAL_VERSIONS };
    });
  },
};

export async function buildLocalWorker() {
  await build({ entryPoints: [resolve(ROOT, 'dev', 'local-worker-entry.js')], bundle: true, format: 'esm', platform: 'browser', outfile: LOCAL_WORKER, plugins: [localVersions], logLevel: 'error' });
  return LOCAL_WORKER;
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  await buildLocalWorker();
  console.log('Lokal test-Worker bygget (kampmotor 11 kan vælges via /dev/motor11).');
}
