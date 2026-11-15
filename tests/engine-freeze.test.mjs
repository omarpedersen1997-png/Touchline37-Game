// Fastfrysning af kampmotor 1–10.
//
// Motorerne skal forblive byte-for-byte uændrede, så igangværende og gemte kampe
// kan genafspilles korrekt på serveren. Nye regler skal ligge i en ny motorfil
// (motor 11+) og registreres i shared/arcade.js – de frosne filer må aldrig ændres.
//
// Testen fejler, hvis:
//  1. en frossen motorfil ændrer sig med blot én byte,
//  2. dispatcheren ikke længere sender version 1–10 til deres oprindelige motor,
//  3. en fast, deterministisk genafspilning pr. motor giver et andet resultat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getArcadeRules, replayArcade, encodeInputs, decodeInputs } from '../shared/arcade.js';
import * as v1 from '../shared/arcade-v1.js';
import * as v2 from '../shared/football11.js';
import * as v3 from '../shared/football-modern.js';
import * as v4 from '../shared/football-spaced.js';
import * as v5 from '../shared/football-pro.js';
import * as v6 from '../shared/football-halves.js';
import * as v7 from '../shared/football-contact.js';
import * as v8 from '../shared/football-tactics.js';
import * as v9 from '../shared/football-receiving.js';
import * as v10 from '../shared/football-goals.js';
import { FROZEN_ENGINE_FILES } from './engine-freeze-data.mjs';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// SHA256-værdierne ligger i tests/engine-freeze-data.mjs.
const MODULES = { 1: v1, 2: v2, 3: v3, 4: v4, 5: v5, 6: v6, 7: v7, 8: v8, 9: v9, 10: v10 };
export const FROZEN_ENGINES = Object.freeze(FROZEN_ENGINE_FILES.map((entry) => ({ ...entry, module: MODULES[entry.version] })));

// Fast genafspilning pr. motor: SHA256 af hele sluttilstanden samt slutstillingen.
export const GOLDEN_REPLAYS = Object.freeze({
  1: { homeScore: 0, awayScore: 7, sha256: '50c93ad6bd27337153556dfaefdd89632a3dd1be7a1fb83856e2492ee6958c94' },
  2: { homeScore: 1, awayScore: 2, sha256: '183542d98961eb943071c7801c771d0f806d97df2ba3944d0c6cb18dc3270c91' },
  3: { homeScore: 2, awayScore: 3, sha256: '239fc7aec4d43aff314e9493eed2730c0100f0f0c2225b0795b06d192a468360' },
  4: { homeScore: 1, awayScore: 4, sha256: '4b5fe4cf78c61a66c0ade5f40e67b7575d72c7622cbe503fd8aa587eeb32189e' },
  5: { homeScore: 0, awayScore: 1, sha256: '17176d3dbfe974851c55a13853fd415029fc0661ada704b7eaaf7af50451061b' },
  6: { homeScore: 0, awayScore: 0, sha256: 'bd16b6a6d98bb83c177315d80dbd4c4651d79615553b0c3c4c59e3fb0cd473da' },
  7: { homeScore: 0, awayScore: 1, sha256: '2fdb92dd8d4c55d49aa7dc0d95c62be9ca310a73a5816b6fa60b81f3cbfb029e' },
  8: { homeScore: 0, awayScore: 0, sha256: '502c1bb8ad6ab468ff221662f94572671586ab45dedb371ddd6068f57900aae3' },
  9: { homeScore: 2, awayScore: 2, sha256: '60b280c43367f764b28cb5f65755d739d01da42514cec721d8bd18fdc74fb896' },
  10: { homeScore: 0, awayScore: 2, sha256: '56851a6f70c7685a1068147005f59d2f8fd2da23259c2f37abe553fab8844be5' },
});

const CONFIG = { homeRating: 62, awayRating: 58, tactic: 'balanced', personalPosition: 'MID' };

/** Deterministisk inputbånd (xorshift32). Ugyldige værdier erstattes af gyldige eller 0. */
export function goldenTape(version) {
  const rules = getArcadeRules(version);
  let x = (0x9e3779b9 ^ version) >>> 0;
  const next = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const tape = new (version >= 2 ? Uint16Array : Uint8Array)(rules.INPUT_COUNT);
  let current = 0;
  for (let i = 0; i < rules.INPUT_COUNT; i++) {
    if (i % 20 === 0) {
      const candidate = next() & 0xffff;
      current = rules.validateMask(candidate) ? candidate
        : rules.validateMask(candidate & 0xff) ? candidate & 0xff
        : rules.validateMask(candidate & 0x7fff) ? candidate & 0x7fff
        : 0;
    }
    tape[i] = current;
  }
  return tape;
}

test('motorfil 1–10 er byte-for-byte uændrede', () => {
  for (const engine of FROZEN_ENGINES) {
    assert.equal(
      sha256(readFileSync(engine.file)),
      engine.sha256,
      `${engine.file} (motor ${engine.version}) er ændret. Motor 1–10 må ikke ændres – lav en ny motorversion i stedet.`,
    );
  }
});

test('frosne motorer har uændrede versionsnumre', () => {
  for (const engine of FROZEN_ENGINES) {
    assert.equal(engine.module.ARCADE_VERSION, engine.version, engine.file);
  }
});

test('dispatcheren sender version 1–10 til deres oprindelige motor', () => {
  for (const engine of FROZEN_ENGINES) {
    assert.equal(getArcadeRules(engine.version), engine.module, `version ${engine.version}`);
  }
  // Ukendte/manglende versioner falder fortsat tilbage til motor 1, som i baseline.
  assert.equal(getArcadeRules(undefined), v1);
  assert.equal(getArcadeRules(1), v1);
});

test('fast genafspilning pr. motor giver præcis samme sluttilstand som baseline', () => {
  for (const engine of FROZEN_ENGINES) {
    const tape = goldenTape(engine.version);
    assert(tape.some((mask) => mask !== 0), `motor ${engine.version} skal have aktivt input`);
    const result = replayArcade('touchline-golden-' + engine.version, { ...CONFIG, matchVersion: engine.version }, tape);
    const golden = GOLDEN_REPLAYS[engine.version];
    assert.equal(result.homeScore, golden.homeScore, `motor ${engine.version} hjemmescore`);
    assert.equal(result.awayScore, golden.awayScore, `motor ${engine.version} udescore`);
    assert.equal(sha256(JSON.stringify(result)), golden.sha256, `motor ${engine.version} sluttilstand`);
  }
});

test('serverens dekodning af den gemte optagelse giver samme resultat som klienten', () => {
  for (const engine of FROZEN_ENGINES) {
    const tape = goldenTape(engine.version);
    const decoded = decodeInputs(encodeInputs(tape, engine.version), engine.version);
    const config = { ...CONFIG, matchVersion: engine.version };
    const client = replayArcade('touchline-golden-' + engine.version, config, tape);
    const server = replayArcade('touchline-golden-' + engine.version, config, decoded);
    assert.equal(sha256(JSON.stringify(server)), sha256(JSON.stringify(client)), `motor ${engine.version}`);
  }
});
