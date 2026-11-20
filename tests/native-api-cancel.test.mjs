// Klientens rigtige apiFetch med en lokal Capacitor-transport. Ingen netværkskald.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withTimeout, requestWithRetry, NetworkError } from '../src/network.js';
const noSleep = async () => {};
const json = value => Response.json(value);

const compiled = await build({
  entryPoints: ['src/api.js'], bundle: true, platform: 'node', format: 'esm', write: false,
  define: { __WEB_GAME__: 'false' },
  plugins: [{ name: 'test-only-capacitor', setup(b) {
    b.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'local-capacitor', namespace: 'test-native' }));
    b.onLoad({ filter: /.*/, namespace: 'test-native' }, () => ({ contents: `
      export const Capacitor={getPlatform:()=>"android"};
      export const registerPlugin=()=>({
        request:(...args)=>globalThis.__touchlineNativeFixture.request(...args),
        cancel:(...args)=>globalThis.__touchlineNativeFixture.cancel?.(...args)
      });`, loader: 'js' }));
  } }], logLevel: 'error',
});
const output = resolve('.dev-data/build/native-api-cancel-test.mjs');
mkdirSync(resolve('.dev-data/build'), { recursive: true }); writeFileSync(output, compiled.outputFiles[0].contents);
const { apiFetch } = await import(pathToFileURL(output));

test('native abort sender det præcise request-id og afslutter uden at afvente native svar', { timeout: 2000 }, async () => {
  const calls = [], cancelled = [], controller = new AbortController();
  let late;
  globalThis.__touchlineNativeFixture = {
    request: args => { calls.push(args); return new Promise(resolve => { late = resolve; }); },
    cancel: args => { cancelled.push(args); return Promise.reject(new Error('Old native plugin has no cancel')); },
  };
  const reason = new DOMException('Stop native', 'AbortError');
  const pending = apiFetch('/api/game', { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].requestId, 'string');
  assert.deepEqual(cancelled, [{ requestId: calls[0].requestId }]);
  late({ status: 200, body: '{"stale":true}' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1, 'sent native svar må ikke udløse genforsøg');
});

test('et afbrudt native kald uden cancel-metode bliver stadig afbrudt i klienten', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  globalThis.__touchlineNativeFixture = { request: () => new Promise(() => {}) };
  const pending = apiFetch('/api/auth/login', { method: 'POST', body: '{"email":"fixture@touchline.invalid"}', signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('native spilgenforsøg har forskellige transport-id men uændret handlings-id og body', { timeout: 3000 }, async () => {
  const calls = [], body = '{"id":"same-action","type":"upgrade","key":"stadium"}';
  globalThis.__touchlineNativeFixture = {
    request: async args => {
      calls.push(args);
      if (calls.length === 1) throw new Error('Lost transport response');
      return { status: 200, body: '{"ok":true}' };
    },
  };
  const response = await apiFetch('/api/game', { method: 'POST', body });
  assert.equal(response.status, 200); assert.equal(calls.length, 2);
  assert.notEqual(calls[0].requestId, calls[1].requestId);
  assert(calls.every(args => args.body === body));
});

test('native auth POST gentages aldrig efter en transportfejl', async () => {
  let calls = 0;
  globalThis.__touchlineNativeFixture = { request: async () => { calls++; throw new Error('Login transport failed'); } };
  await assert.rejects(apiFetch('/api/auth/login', { method: 'POST', body: '{"id":"auth-is-not-retryable"}' }));
  assert.equal(calls, 1);
  delete globalThis.__touchlineNativeFixture;
});

test('hard deadline afviser også en transport som ignorerer AbortSignal', { timeout: 2000 }, async () => {
  let transportSignal;
  const started = Date.now();
  await assert.rejects(withTimeout(signal => {
    transportSignal = signal;
    return new Promise(() => {});
  }, { timeoutMs: 20 }), NetworkError);
  assert(transportSignal.aborted, 'native transport skal samtidig have annulleringsbesked');
  assert(Date.now() - started < 1500, 'fristen må ikke afhænge af native Promise-afvikling');
});

test('kalderabort afgør en uvillig transport straks og bevarer den oprindelige grund', { timeout: 2000 }, async () => {
  const controller = new AbortController(), reason = new DOMException('Caller stopped', 'AbortError');
  let calls = 0;
  const pending = requestWithRetry(() => { calls++; return new Promise(() => {}); }, {
    path: '/api/game', signal: controller.signal, sleep: noSleep,
  });
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(calls, 1, 'en annulleret transport må ikke blive et nyt spilforsøg');
});

test('sent native svar og sen fejl efter deadline bliver konsumeret uden ny afvikling', { timeout: 2000 }, async () => {
  for (const late of ['resolve', 'reject']) {
    let settleLate;
    const pending = withTimeout(() => new Promise((resolve, reject) => { settleLate = late === 'resolve' ? resolve : reject; }), { timeoutMs: 10 });
    let outcomes = 0;
    pending.then(() => outcomes++, () => outcomes++);
    await assert.rejects(pending, NetworkError);
    settleLate(late === 'resolve' ? json({ stale: true }) : new Error('Late transport failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(outcomes, 1, 'sen transportafvikling må ikke afgøre kaldet igen');
  }
});

test('abort under genforsøgsventetid afbryder også en uvillig sleep uden at sende igen', { timeout: 2000 }, async () => {
  const controller = new AbortController(), reason = new Error('Stop during retry wait');
  let calls = 0, waiting;
  const enteredSleep = new Promise(resolve => { waiting = resolve; });
  const pending = requestWithRetry(async () => { calls++; throw new TypeError('Connection failed'); }, {
    path: '/api/game', signal: controller.signal,
    sleep: () => { waiting(); return new Promise(() => {}); },
  });
  await enteredSleep; controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(calls, 1);
});

