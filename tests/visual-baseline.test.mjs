// Beskytter de visuelle referencebilleder mod utilsigtet sletning eller ændring.
// Selve billedsammenligningen kræver en browser og køres med "npm run visual:check".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { SCREENS, BASELINE_DIR, VIEWPORT, DEVICE_SCALE_FACTOR } from '../dev/visual.mjs';

const manifest = JSON.parse(readFileSync(BASELINE_DIR + '/manifest.json', 'utf8'));

test('alle skærme har et referencebillede, der matcher manifestet', () => {
  for (const screen of SCREENS) {
    const file = `${BASELINE_DIR}/${screen.name}.png`;
    assert(existsSync(file), `${screen.name}.png mangler`);
    const png = readFileSync(file);
    const entry = manifest.screens[screen.name];
    assert(entry, `${screen.name} mangler i manifest.json`);
    assert.equal(png.length, entry.bytes, screen.name);
    assert.equal(createHash('sha256').update(png).digest('hex'), entry.sha256, `${screen.name}.png er ændret uden at opdatere manifestet`);
    // PNG-signatur og korrekt størrelse (bredde/højde i IHDR).
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), VIEWPORT.width * DEVICE_SCALE_FACTOR);
    assert.equal(png.readUInt32BE(20), VIEWPORT.height * DEVICE_SCALE_FACTOR);
  }
});

test('manifestet og mappen indeholder ikke forældede skærme', () => {
  const names = SCREENS.map((screen) => screen.name).sort();
  assert.deepEqual(Object.keys(manifest.screens).sort(), names);
  const files = readdirSync(BASELINE_DIR).filter((name) => name.endsWith('.png')).map((name) => name.slice(0, -4)).sort();
  assert.deepEqual(files, names);
});

test('referencen er taget i bredformat som på en Android-telefon', () => {
  assert.deepEqual(manifest.viewport, VIEWPORT);
  assert(VIEWPORT.width > VIEWPORT.height);
});
