// Byg KUN det særskilte testprojekt; dette må aldrig bygge originalens hosting.
import { build } from 'esbuild';
import { mkdir, readFile, cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(resolve(root, '.openai/hosting.json'), 'utf8'));
if (manifest.project_id !== 'appgprj_6af9bc223af88191b6d68d7616afcc25'
  || manifest.d1 !== 'DB' || manifest.r2 !== null) {
  throw new Error('Afvist: dette script bygger kun det særskilte testprojekt med egen DB og uden R2.');
}
const productionVersions = resolve(root, 'shared/engine-versions.js');
const testVersions = resolve(root, 'dev/engine-versions-local.js');
const mode = JSON.parse(await readFile(resolve(root, 'dev/test-host/host-mode.json'), 'utf8'));
if (typeof mode.allowSetup !== 'boolean') throw new Error('Testhostens byggetilstand mangler.');
await build({
  entryPoints: [resolve(root, 'dev/test-host/entry.js')],
  outfile: resolve(root, 'dist/server/index.js'),
  bundle: true, minify: true, platform: 'browser', format: 'esm',
  define: { __TOUCHLINE_ALLOW_TEST_SETUP__: JSON.stringify(mode.allowSetup) },
  plugins: [{ name: 'isolated-android-test-only', setup(b) {
    b.onResolve({ filter: /engine-versions\.js$/ }, args => {
      if (args.importer === testVersions || resolve(args.resolveDir, args.path) !== productionVersions) return;
      return { path: testVersions };
    });
    b.onResolve({ filter: /generated-[^/]+\.js$/ }, args => ({ path: args.path, namespace: 'test-disabled-assets' }));
    b.onLoad({ filter: /.*/, namespace: 'test-disabled-assets' }, () => ({ contents: 'export default {}', loader: 'js' }));
    // Testserveren må ikke kunne sende mail, selv hvis en ny rute tilføjes senere.
    b.onResolve({ filter: /(?:^|\/)mail\.js$/ }, args => {
      if (resolve(args.resolveDir, args.path) !== resolve(root, 'worker/mail.js')) return;
      return { path: 'disabled-test-mail', namespace: 'test-no-mail' };
    });
    b.onLoad({ filter: /.*/, namespace: 'test-no-mail' }, () => ({
      contents: 'export function mailReady(){return false} export async function sendMail(){throw new Error("Mail er deaktiveret i testmiljøet.")}', loader: 'js',
    }));
  } }],
});
await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await cp(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
// Ryd kun denne nye testkopis genererede schema-output før deterministisk kopi.
await rm(resolve(root, 'dist/drizzle'), { recursive: true, force: true });
await cp(resolve(root, 'drizzle'), resolve(root, 'dist/drizzle'), { recursive: true });
console.log('Bygget særskilt motor 11-testserver med egen DB; ingen mail, R2, websitebilleder eller APK.');
