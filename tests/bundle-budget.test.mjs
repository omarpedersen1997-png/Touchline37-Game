import {SIZE_POLICY} from '../dev/size-policy.mjs';
// Størrelseskontrol af serverpakken (dist/server/index.js).
//
// Den faktiske komprimerede grænse for den konkrete Sites/Cloudflare-hosting er
// IKKE bekræftet. Projektets dokumentation og release-check bruger 10 MiB. Indtil
// grænsen er verificeret, fejler denne test allerede ved en forsigtig grænse
// godt under 10 MiB, og den advarer tidligere.
// Kræver at "npm run build" er kørt (npm test gør det først).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { measure, growthViolations, BASELINE_FILE, MAX_COMPONENT_GROWTH } from '../dev/bundle-report.mjs';

export const DOCUMENTED_LIMIT_BYTES = SIZE_POLICY.worker.documentedLimitBytes; // ubekræftet hostinggrænse
export const LIMIT_VERIFIED = SIZE_POLICY.worker.limitVerified;
export const FAIL_AT_BYTES = SIZE_POLICY.worker.failAtBytes; // forsigtig grænse, mens hostinggrænsen er ubekræftet
export const WARN_AT_BYTES = SIZE_POLICY.worker.warnAtBytes;

const mb = (bytes) => (bytes / 1_000_000).toFixed(2) + ' MB';

test('grænserne er ordnet forsigtigt under den dokumenterede grænse', () => {
  assert(WARN_AT_BYTES < FAIL_AT_BYTES);
  assert(FAIL_AT_BYTES < DOCUMENTED_LIMIT_BYTES);
  if (!LIMIT_VERIFIED) assert(FAIL_AT_BYTES <= DOCUMENTED_LIMIT_BYTES * 0.9, 'Uden bekræftet grænse skal der være mindst 10 % luft');
});

test('komprimeret serverpakke holder sig under den forsigtige grænse', () => {
  const raw = readFileSync('dist/server/index.js');
  const compressed = gzipSync(raw).length;
  const headroom = DOCUMENTED_LIMIT_BYTES - compressed;
  console.log(
    `Serverpakke: ${mb(raw.length)} ukomprimeret, ${mb(compressed)} komprimeret. ` +
      `Fejlgrænse ${mb(FAIL_AT_BYTES)}. Luft til dokumenteret ${mb(DOCUMENTED_LIMIT_BYTES)}: ${mb(headroom)} ` +
      `(hostinggrænsen er ${LIMIT_VERIFIED ? 'bekræftet' : 'IKKE bekræftet'}).`,
  );
  if (compressed >= WARN_AT_BYTES) {
    console.warn(`ADVARSEL: Serverpakken er over ${mb(WARN_AT_BYTES)}. Undgå at lægge flere store filer i Worker-pakken.`);
  }
  assert(compressed < FAIL_AT_BYTES, `Serverpakken fylder ${mb(compressed)} komprimeret og overskrider ${mb(FAIL_AT_BYTES)}.`);
});

test('app-HTML til Android er rapporteret (kun information)', () => {
  const html = readFileSync('native-web/index.html');
  console.log(`native-web/index.html: ${mb(html.length)} ukomprimeret, ${mb(gzipSync(html).length)} komprimeret.`);
  assert(html.length > 0);
});

// M3: overvågning af de enkelte dele af serverpakken (se dev/bundle-report.mjs).

test('ingen del af serverpakken vokser mere end 5 % uden en bevidst opdatering af referencen', () => {
  assert(existsSync(BASELINE_FILE), 'tests/bundle-baseline.json mangler');
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  const report = measure();
  const violations = growthViolations(report, baseline);
  assert.deepEqual(
    violations,
    [],
    'Voksede dele:\n' + violations.map((v) => `  ${v.key}: ${v.reason}`).join('\n') +
      '\nEr væksten bevidst og godkendt, opdateres referencen med "node dev/bundle-report.mjs --update-baseline".',
  );
  assert.equal(MAX_COMPONENT_GROWTH, 0.05);
});

test('vækstkontrollen opdager en del, der vokser, og en ny ukendt del', () => {
  const baseline = { components: { webGame: { gzip: 1000 }, code: { gzip: 100 } } };
  const report = (webGame, extra = {}) => ({ worker: { components: { webGame: { gzip: webGame }, code: { gzip: 100 }, ...extra } } });
  assert.deepEqual(growthViolations(report(1050), baseline), []);
  assert.equal(growthViolations(report(1051), baseline).length, 1);
  assert.equal(growthViolations(report(900, { audio: { gzip: 5 } }), baseline)[0].key, 'audio');
});

test('rapportens dele summerer til hele serverpakken', () => {
  const report = measure();
  const sum = Object.values(report.worker.components).reduce((total, part) => total + part.bytes, 0);
  assert.equal(sum, report.worker.bytes);
  assert.equal(report.worker.limitVerified, false, 'hostinggrænsen behandles som ubekræftet');
});
