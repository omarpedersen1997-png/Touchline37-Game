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

export const DOCUMENTED_LIMIT_BYTES = 10 * 1024 * 1024; // ubekræftet hostinggrænse
export const LIMIT_VERIFIED = false;
export const FAIL_AT_BYTES = 9_400_000; // forsigtig grænse, mens hostinggrænsen er ubekræftet
export const WARN_AT_BYTES = 9_000_000;

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
