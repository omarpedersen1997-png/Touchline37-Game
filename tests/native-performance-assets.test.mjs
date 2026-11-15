import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = hash(readFileSync('native-web/index.html'));
execFileSync(process.execPath, ['dev/build-performance-assets.mjs'], { stdio: 'pipe' });
const report = JSON.parse(readFileSync('.dev-data/review/performance-assets.json', 'utf8'));
const output = resolve('.dev-data/android-web/public');

test('native login does not parse Three, motion tracks or inline player models', () => {
  assert.equal(report.noThreeAtLogin, true);
  assert.equal(report.noModelsAtLogin, true);
  assert(report.initialJavaScriptBytes < 1_200_000, 'Startup JavaScript has a real byte budget');
  assert(report.allJavaScriptBytes < 2_500_000);
  assert(!report.initialInputs.some(name => /node_modules\/three\/|src\/pro-player\.js|football-motion\.json/.test(name)));
  assert.equal(hash(readFileSync('native-web/index.html')), baseline, 'The normal build assets are not overwritten');
});

test('every split native module resolves to a packaged local file', () => {
  const html = readFileSync(output + '/index.html', 'utf8');
  assert(html.includes(`type="module" src="${report.entryScript}"`));
  const urls = new Set(report.modules.map(item => item.url));
  assert(urls.has(report.entryScript));
  for (const item of report.modules) {
    assert(item.url.startsWith('/assets/') && existsSync(output + item.url));
    const text = readFileSync(output + item.url, 'utf8');
    assert(!text.includes('data:model/gltf-binary;base64,'));
    for (const match of text.matchAll(/(?:from|import)\s*(?:\(\s*)?["'](\/assets\/[^"']+\.js)["']/g)) {
      assert(urls.has(match[1]) && existsSync(output + match[1]), 'Actual ESM import must be packaged: ' + match[1]);
    }
    for (const imported of item.imports) {
      assert(!imported.external, 'No external JavaScript dependency may escape the test app');
      assert(urls.has(imported.path), imported.path);
    }
  }
});

test('both detailed player models retain their original bytes and local licenses', () => {
  assert.equal(report.models.length, 2);
  for (const item of report.models) {
    const original = readFileSync('assets/game/' + item.file);
    const packaged = readFileSync(output + '/assets/models/' + item.file);
    assert(original.equals(packaged));
    assert.equal(hash(packaged), item.sha256);
    assert.equal(packaged.readUInt32LE(0), 0x46546c67);
  }
  assert(readFileSync(output + '/third-party/football-assets.txt', 'utf8').includes('MakeHuman'));
});
