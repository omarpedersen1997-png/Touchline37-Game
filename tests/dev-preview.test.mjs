// Testmiljøet bag Claude-appens forhåndsvisning (en https-proxy foran 127.0.0.1).
// Login skal virke gennem proxyen, mens spillets Origin-beskyttelse stadig afviser
// fremmede adresser. Kræver web-draft/server.mjs (bygges af npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalServer, requestUrl, requestSummary } from '../dev/local-server.mjs';
import { seed, TEST_ACCOUNTS } from '../dev/seed.mjs';

const nativeFetch = globalThis.fetch.bind(globalThis);
const PREVIEW = 'https://touchline-preview.example';
const account = TEST_ACCOUNTS[1];
const fake = (headers) => ({ url: '/api/auth/login', method: 'POST', headers });

test('adressen bestemmes korrekt for direkte adgang og for almindelige proxy-headere', () => {
  assert.equal(requestUrl(fake({ host: '127.0.0.1:8787' })).origin, 'http://127.0.0.1:8787');
  assert.equal(requestUrl(fake({ host: '127.0.0.1:8787', 'x-forwarded-host': 'touchline-preview.example', 'x-forwarded-proto': 'https' })).origin, PREVIEW);
  assert.equal(requestUrl(fake({ host: '127.0.0.1:8787', forwarded: 'for=10.0.0.1;host=touchline-preview.example;proto=https' })).origin, PREVIEW);
  // Proxy der bevarer Host, men ikke sender protokol: https udledes kun ved samme vært.
  assert.equal(requestUrl(fake({ host: 'touchline-preview.example', origin: PREVIEW })).origin, PREVIEW);
  assert.equal(requestUrl(fake({ host: 'touchline-preview.example', origin: 'https://evil.example' })).origin, 'http://touchline-preview.example');
});

test('forespørgselsloggen indeholder aldrig cookies eller adgangskoder', () => {
  const req = fake({ host: '127.0.0.1:8787', cookie: '__Host-touchline=hemmelig-session', origin: PREVIEW });
  const line = requestSummary(req, new Request('http://127.0.0.1:8787/api/auth/login', { method: 'POST', body: '{"password":"Touchline-test-2"}' }), 200);
  assert(!line.includes('hemmelig-session'));
  assert(!line.includes('Touchline-test-2'));
  assert(line.includes('origin=' + PREVIEW));
});

test('login og gemning virker gennem en https-proxy, og fremmede adresser afvises stadig', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'touchline-preview-'));
  const lines = [];
  const local = await startLocalServer({ env: {}, port: 0, dataDir, log: (line) => lines.push(line) });
  t.after(async () => {
    await local.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  await seed({ db: local.db, worker: local.worker, pepper: local.env.AUTH_PEPPER });

  const viaProxy = (path, init = {}) =>
    nativeFetch(local.url + path, {
      ...init,
      headers: { 'X-Forwarded-Host': 'touchline-preview.example', 'X-Forwarded-Proto': 'https', ...(init.headers || {}) },
    });

  const login = await viaProxy('/api/auth/login', {
    method: 'POST',
    headers: { Origin: PREVIEW, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-touchline=/);
  assert.match(setCookie, /Secure/i);
  const cookie = setCookie.split(';')[0];

  const game = await viaProxy('/api/game', { headers: { Cookie: cookie } });
  assert.equal(game.status, 200);
  assert.equal((await game.json()).state.name, account.clubName);

  const save = await viaProxy('/api/game', {
    method: 'POST',
    headers: { Origin: PREVIEW, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'upgrade', key: 'sponsor', id: 'preview-upgrade-1' }),
  });
  assert.equal(save.status, 200, await save.clone().text());

  const foreign = await viaProxy('/api/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(foreign.status, 403);

  assert.deepEqual(local.guard.blocked, []);
  assert(lines.some((line) => line.includes('/api/auth/login 200') && line.includes('url=' + PREVIEW)));
  assert(lines.every((line) => !line.includes(account.password) && !line.includes(cookie.split('=')[1])));
});
