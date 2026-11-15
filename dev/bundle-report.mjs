// Størrelsesrapport for serverpakken og app-HTML'en (M3, trin 5).
//
//   node dev/bundle-report.mjs                    – viser rapporten
//   node dev/bundle-report.mjs --update-baseline  – gemmer nuværende tal som ny reference
//                                                   (kun efter en bevidst, godkendt ændring)
//
// Kræver "npm run build". Den præcise komprimerede grænse for produktionshostingen er
// IKKE bekræftet; 10 MiB er projektets dokumenterede værdi.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_FILE = resolve(ROOT, 'tests', 'bundle-baseline.json');
export const DOCUMENTED_LIMIT_BYTES = 10 * 1024 * 1024;
export const LIMIT_VERIFIED = false;
export const MAX_COMPONENT_GROWTH = 0.05;

// Genererede moduler, som build.mjs lægger ind i serverpakken (dist/server/index.js).
export const WORKER_COMPONENTS = Object.freeze([
  { key: 'webGame', file: 'generated-launch-game.js', label: 'Spillets web-HTML (/play)' },
  { key: 'siteCaptures', file: 'generated-site-captures.js', label: '4K-billeder til hjemmesiden' },
  { key: 'sitePage', file: 'generated-page.js', label: 'Hjemmesidens HTML' },
  { key: 'siteArt', file: 'generated-site-art.js', label: 'Hjemmesidens illustrationer' },
  { key: 'launchApk', file: 'generated-launch-apk.js', label: 'Indlejret APK (tom ved R2)' },
]);

const gz = (data) => gzipSync(data).length;
const read = (file) => readFileSync(resolve(ROOT, file));

function dataUrlBytes(html, pattern) {
  let total = 0;
  for (const match of html.matchAll(pattern)) total += match[0].length;
  return total;
}

export function measure() {
  for (const file of ['dist/server/index.js', 'native-web/index.html', ...WORKER_COMPONENTS.map((c) => c.file)]) {
    if (!existsSync(resolve(ROOT, file))) throw new Error(`${file} mangler. Kør "npm run build" først.`);
  }
  const worker = read('dist/server/index.js');
  const components = {};
  let known = 0;
  let knownGzip = 0;
  for (const component of WORKER_COMPONENTS) {
    const data = read(component.file);
    components[component.key] = { label: component.label, bytes: data.length, gzip: gz(data) };
    known += data.length;
    knownGzip += components[component.key].gzip;
  }
  components.code = {
    label: 'Serverkode og øvrigt (beregnet rest)',
    bytes: Math.max(0, worker.length - known),
    gzip: Math.max(0, gz(worker) - knownGzip),
  };

  const html = read('native-web/index.html').toString('utf8');
  const models = dataUrlBytes(html, /data:model\/gltf-binary;base64,[A-Za-z0-9+/=]+/g);
  const fonts = dataUrlBytes(html, /data:font\/ttf;base64,[A-Za-z0-9+/=]+/g);
  const images = dataUrlBytes(html, /data:image\/(?:webp|png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+/g);
  const app = {
    total: { label: 'App-HTML i alt (native-web/index.html)', bytes: Buffer.byteLength(html), gzip: gz(html) },
    models: { label: '3D-spillermodeller (2 × GLB som base64)', bytes: models },
    fonts: { label: 'Skrifttyper (base64)', bytes: fonts },
    images: { label: 'Billeder (base64)', bytes: images },
    rest: { label: 'JavaScript, CSS og øvrigt', bytes: Buffer.byteLength(html) - models - fonts - images },
  };

  return {
    worker: { bytes: worker.length, gzip: gz(worker), limit: DOCUMENTED_LIMIT_BYTES, limitVerified: LIMIT_VERIFIED, components },
    app,
  };
}

/** Komponenter, der er vokset mere end tilladt i forhold til referencen. */
export function growthViolations(report, baseline, maxGrowth = MAX_COMPONENT_GROWTH) {
  const violations = [];
  for (const [key, reference] of Object.entries(baseline.components)) {
    const current = report.worker.components[key];
    if (!current) {
      violations.push({ key, reason: 'mangler i den nye pakke' });
      continue;
    }
    if (current.gzip > reference.gzip * (1 + maxGrowth)) {
      violations.push({ key, reason: `${reference.gzip} → ${current.gzip} bytes komprimeret (+${(((current.gzip - reference.gzip) / reference.gzip) * 100).toFixed(1)} %)` });
    }
  }
  for (const key of Object.keys(report.worker.components)) {
    if (!baseline.components[key]) violations.push({ key, reason: 'ny komponent uden reference' });
  }
  return violations;
}

const mb = (bytes) => (bytes / 1e6).toFixed(2) + ' MB';

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const report = measure();
    if (process.argv.includes('--update-baseline')) {
      const baseline = {
        note: 'Reference for serverpakkens komponenter (komprimerede bytes). Opdateres kun med "node dev/bundle-report.mjs --update-baseline" efter en bevidst, godkendt ændring.',
        components: Object.fromEntries(Object.entries(report.worker.components).map(([key, value]) => [key, { gzip: value.gzip }])),
        totalGzip: report.worker.gzip,
      };
      writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
      console.log('Ny reference gemt i tests/bundle-baseline.json');
    }
    const { worker, app } = report;
    console.log('\nServerpakke (dist/server/index.js)');
    console.log(`  I alt: ${mb(worker.bytes)} ukomprimeret, ${mb(worker.gzip)} komprimeret`);
    console.log(`  Dokumenteret grænse: ${mb(worker.limit)} komprimeret – ${worker.limitVerified ? 'bekræftet' : 'IKKE bekræftet'}`);
    console.log(`  Luft til grænsen: ${mb(worker.limit - worker.gzip)} (${(((worker.limit - worker.gzip) / worker.limit) * 100).toFixed(1)} %)\n`);
    for (const value of Object.values(worker.components)) {
      console.log(`  ${value.label.padEnd(40)} ${mb(value.bytes).padStart(9)}  ${mb(value.gzip).padStart(9)} komprimeret  (${((value.gzip / worker.gzip) * 100).toFixed(0)} %)`);
    }
    console.log('\nApp-HTML til Android (native-web/index.html)');
    for (const value of Object.values(app)) {
      console.log(`  ${value.label.padEnd(40)} ${mb(value.bytes).padStart(9)}${value.gzip ? '  ' + mb(value.gzip).padStart(9) + ' komprimeret' : ''}`);
    }
    if (existsSync(BASELINE_FILE)) {
      const violations = growthViolations(report, JSON.parse(readFileSync(BASELINE_FILE, 'utf8')));
      console.log(violations.length ? '\nVækst over 5 %:\n  ' + violations.map((v) => `${v.key}: ${v.reason}`).join('\n  ') : '\nIngen komponent er vokset mere end 5 % i forhold til referencen.');
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
