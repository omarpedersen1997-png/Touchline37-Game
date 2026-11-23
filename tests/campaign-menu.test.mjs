import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const brand = read('src/touchline-brand.css');

function luminance(hex) {
  const values = hex.match(/../g).map(byte => parseInt(byte, 16) / 255);
  const linear = values.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

test('Campaign menu text, primary actions and error messages meet WCAG AA contrast', () => {
  function value(name) {
    return luminance(brand.match(new RegExp('--tl-brand-' + name + ': #([a-f0-9]{6});'))[1]);
  }
  for (const [text, background] of [
    ['text', 'surface'], ['muted', 'raised'], ['bg', 'accent'], ['danger', 'danger-surface'],
  ]) {
    const pair = [value(text), value(background)].sort((a, b) => b - a);
    assert.ok((pair[0] + .05) / (pair[1] + .05) >= 4.5, text + ' / ' + background);
  }
});

test('Both app build paths package the campaign design and its live-match scope stays separate', () => {
  for (const path of ['build.mjs', 'dev/build-performance-assets.mjs']) {
    const source = read(path);
    assert.match(source, /touchline-brand\.css/);
    assert.match(source, /campaign-menu\.css/);
  }
  const menus = read('src/campaign-menu.css');
  assert.match(menus, /\.game-console > \.main-shell/);
  assert.match(menus, /\.toast/);
  assert.doesNotMatch(menus, /\.game-match|canvas|backdrop-filter|@keyframes/);
});
