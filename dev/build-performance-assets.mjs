// Kun Android-test: separate ESM-moduler og lokale modeller, ingen base64-GLB ved login.
import { build, transform } from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm, lstat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.dev-data/android-web/public');
const testRelease=JSON.parse(await readFile(resolve(root,'dev/test-release.json'),'utf8'));
if(!Number.isInteger(testRelease.versionCode)||testRelease.versionCode<=37||!/^1\.0\.0-test-[a-z0-9]+$/.test(testRelease.versionName))throw Error('Ugyldig testversion.');
const origin = 'https://touchline37-engine11-test.glowingconch1.chatgpt.site';
const source = await readFile(resolve(root, 'src/ClubJourney.jsx'), 'utf8');
const shareOrigin = source.match(/url:\s*'([^']+)'/)?.[1];
if (!shareOrigin?.startsWith('https://')) throw new Error('Delingsadressen kunne ikke isoleres.');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Assetmappen må ikke være et link.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const captureInfo = JSON.parse(await readFile(resolve(root, 'release/site-captures.json'), 'utf8'));
const result = await build({
  absWorkingDir: root, entryPoints: ['src/App.jsx'], outdir: output,
  entryNames: 'assets/app-[hash]', chunkNames: 'assets/chunks/[name]-[hash]',
  publicPath: '/', bundle: true, splitting: true, minify: true, format: 'esm',
  platform: 'browser', target: 'es2022', metafile: true,
  logOverride: { 'ignored-bare-import': 'silent' }, // CSS pakkes udtrykkeligt nedenfor.
  loader: { '.css': 'text', '.webp': 'dataurl' },
  define: {
    'process.env.NODE_ENV': '"production"', '__WEB_GAME__': 'false',
    '__TOUCHLINE_TEST_APP__': 'true',
    '__TOUCHLINE_BUILD_VERSION__':JSON.stringify(testRelease.versionName),
    '__TOUCHLINE_BUILD_NUMBER__':JSON.stringify(testRelease.versionCode),
    '__SITE_CAPTURES__': JSON.stringify(captureInfo.screenshots),
    '__PRO_PLAYER_URL__': JSON.stringify('/assets/models/football-pro.glb'),
    '__PRO_PLAYER_AUTO_URL__': JSON.stringify('/assets/models/football-auto.glb'),
  },
});
const outputs = Object.entries(result.metafile.outputs);
// Sørg for at selve opstartsgrafen ikke allerede kræver Three eller modeller.
const [entry] = outputs.find(([, value]) => value.entryPoint === 'src/App.jsx');
const initial = new Set();
function visit(path) {
  if (initial.has(path)) return;
  initial.add(path);
  const info = result.metafile.outputs[path];
  if (!info) throw new Error('Et modul mangler i opstartsgrafen: ' + path);
  for (const item of info.imports) if (item.kind !== 'dynamic-import' && !item.external) {
    const found = outputs.find(([name]) => '/' + relative(output, resolve(root, name)).replaceAll('\\', '/') === item.path)?.[0] ?? item.path;
    visit(found);
  }
}
visit(entry);
const initialInputs = [...initial].flatMap(path => Object.keys(result.metafile.outputs[path].inputs));
if (initialInputs.some(name => /node_modules\/three\/|src\/pro-player\.js|football-motion\.json/.test(name))) {
  throw new Error('Tung 3D-kode er stadig koblet til login/opstart.');
}
for (const [name] of outputs) if (name.endsWith('.js')) {
  const file = resolve(root, name);
  const bytes = await readFile(file, 'utf8');
  if (bytes.includes('data:model/gltf-binary;base64,')) throw new Error('En model er stadig indlejret i JavaScript.');
  await writeFile(file, bytes.replaceAll(shareOrigin, origin));
}
const cssFiles = ['style.css','expansion.css','clubstudio.css','web-release.css','player-career.css','refresh.css','career-journey.css','manual-match.css','match-modes.css','redesign.css','redesign-club.css','redesign-career.css','redesign-auth.css','forest.css','game-dashboard.css','game-match.css','game-sections.css','match-statistics.css','match-upgrade.css','landscape-app.css','console-2026.css','workspace-deck.css','compact-2026.css'];
const rawCss = (await Promise.all(cssFiles.map(name => readFile(resolve(root, 'src', name), 'utf8')))).join('\n').replace(/@import\s+url\([^)]*\)\s*;/g, '');
const css = (await transform(rawCss, { loader: 'css', minify: true })).code;
const fonts = (await Promise.all([['DM Sans','DM-Sans.ttf','100 1000'],['Barlow Condensed','Barlow-Condensed.ttf','500 800']].map(async ([family,file,weight]) => `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${(await readFile(resolve(root, 'assets/fonts', file))).toString('base64')}) format('truetype');font-weight:${weight};font-display:swap}`))).join('');
const portraits = ':root{--player-portrait-sheet:url(data:image/webp;base64,' + (await readFile(resolve(root,'assets/game/portraits.webp'))).toString('base64') + ')}';
const script = '/' + relative(output, resolve(root, entry)).replaceAll('\\', '/');
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0b141d"><title>Touchline — Football Idle</title><style>${fonts + css + portraits}</style></head><body><div id="root"></div><noscript>Slå JavaScript til for at vise Touchline.</noscript><script type="module" src="${script}"></script></body></html>`);
await mkdir(resolve(output, 'assets/models'), { recursive: true });
const models = [];
for (const file of ['football-auto.glb','football-pro.glb']) {
  await cp(resolve(root, 'assets/game', file), resolve(output, 'assets/models', file));
  const bytes = await readFile(resolve(output, 'assets/models', file));
  models.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await mkdir(resolve(output, 'third-party'), { recursive: true });
await cp(resolve(root, 'assets/game/FOOTBALL-ASSET-LICENSES.md'), resolve(output, 'third-party/football-assets.txt'));
const report = {
  initialJavaScriptBytes: [...initial].reduce((sum, path) => sum + result.metafile.outputs[path].bytes, 0),
  allJavaScriptBytes: outputs.reduce((sum, [name, item]) => sum + (name.endsWith('.js') ? item.bytes : 0), 0),
  initialModuleCount: initial.size, allModuleCount: outputs.length, initialInputs, models, entryScript: script,
  modules: outputs.filter(([name]) => name.endsWith('.js')).map(([name, item]) => ({
    url: '/' + relative(output, resolve(root, name)).replaceAll('\\', '/'), bytes: item.bytes,
    imports: item.imports.map(value => ({ ...value, path: value.external ? value.path : '/' + relative(output, resolve(root, value.path)).replaceAll('\\', '/') })),
  })),
  noModelsAtLogin: true, noThreeAtLogin: true,
};
await mkdir(resolve(root, '.dev-data/review'), { recursive: true });
await writeFile(resolve(root, '.dev-data/review/performance-assets.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, initialInputs: undefined, modules: undefined }));
