// Netværksstabilitet (M3, trin 3): tidsgrænser, fejlsvar og sikre genforsøg.
// Kræver dist/server/index.js (bygges af npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database, TEST_PEPPER, tokenFor } from './database.mjs';
import {
  requestWithRetry,
  retryAllowed,
  hasActionId,
  normalizeResponse,
  OFFLINE_MESSAGE,
  NetworkError,
  REQUEST_TIMEOUT_MS,
  RETRY_DELAYS_MS,
} from '../src/network.js';

const noSleep = async () => {};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const actionBody = (id) => JSON.stringify({ type: 'upgrade', key: 'stadium', id });

test('tidsgrænserne svarer til Android-broen, og der gentages højst to gange', () => {
  assert.deepEqual(REQUEST_TIMEOUT_MS, { GET: 15000, POST: 20000 });
  assert.deepEqual(RETRY_DELAYS_MS, [400, 1200]);
});

test('kun spillets hentning og handlinger med handlings-id må gentages', () => {
  assert.equal(retryAllowed('/api/game', 'GET'), true);
  assert.equal(retryAllowed('/api/game', 'POST', actionBody('a1')), true);
  assert.equal(retryAllowed('/api/game', 'POST', JSON.stringify({ type: 'upgrade' })), false, 'uden id');
  assert.equal(retryAllowed('/api/game', 'POST', 'ikke json'), false);
  for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/delete', '/api/auth/change-password', '/api/auth/reset-password', '/api/contact', '/api/auth/me']) {
    assert.equal(retryAllowed(path, 'POST', actionBody('x')), false, path);
    assert.equal(retryAllowed(path, 'GET'), false, path);
  }
  assert.equal(hasActionId(JSON.stringify({ id: 'x'.repeat(101) })), false);
});

test('afbrudt forbindelse gentages og lykkes med præcis samme indhold', async () => {
  const bodies = [];
  let calls = 0;
  const response = await requestWithRetry(
    async () => {
      calls++;
      bodies.push(actionBody('same-id'));
      if (calls < 3) throw new TypeError('Failed to fetch');
      return json({ ok: true });
    },
    { path: '/api/game', method: 'POST', body: actionBody('same-id'), sleep: noSleep },
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert(bodies.every((body) => JSON.parse(body).id === 'same-id'));
});

test('502/503/504 gentages; andre fejl returneres straks', async () => {
  for (const status of [502, 503, 504]) {
    let calls = 0;
    const response = await requestWithRetry(async () => (++calls < 2 ? json({ error: 'midlertidig' }, status) : json({ ok: true })), { path: '/api/game', sleep: noSleep });
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  }
  for (const status of [400, 401, 403, 409, 413, 500]) {
    let calls = 0;
    const response = await requestWithRetry(async () => (calls++, json({ error: 'fejl' }, status)), { path: '/api/game', sleep: noSleep });
    assert.equal(response.status, status);
    assert.equal(calls, 1, String(status));
  }
});

test('vedvarende fejl giver den eksisterende danske fejltekst efter tre forsøg', async () => {
  let calls = 0;
  await assert.rejects(
    requestWithRetry(async () => { calls++; throw new TypeError('Failed to fetch'); }, { path: '/api/game', sleep: noSleep }),
    (error) => error instanceof NetworkError && error.message === OFFLINE_MESSAGE,
  );
  assert.equal(calls, 3);
  let lastStatus = 0;
  const last = await requestWithRetry(async () => json({ error: 'nede' }, 503), { path: '/api/game', sleep: noSleep });
  lastStatus = last.status;
  assert.equal(lastStatus, 503);
  assert.equal((await last.json()).error, 'nede');
});

test('login og andre følsomme kald gentages aldrig', async () => {
  for (const path of ['/api/auth/login', '/api/auth/delete', '/api/contact']) {
    let calls = 0;
    await assert.rejects(
      requestWithRetry(async () => { calls++; throw new TypeError('Failed to fetch'); }, { path, method: 'POST', body: actionBody('x'), sleep: noSleep }),
      NetworkError,
    );
    assert.equal(calls, 1, path);
  }
});

test('tidsgrænse afbryder hængende kald og giver en læsbar fejl', async () => {
  let calls = 0;
  const hanging = (signal) =>
    new Promise((_, reject) => {
      calls++;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  const started = Date.now();
  await assert.rejects(
    requestWithRetry(hanging, { path: '/api/game', sleep: noSleep, timeouts: { GET: 30, POST: 30 } }),
    (error) => error instanceof NetworkError && error.message === OFFLINE_MESSAGE,
  );
  assert.equal(calls, 3);
  assert(Date.now() - started < 2000);
});

test('kalderens egen afbrydelse sendes uændret videre og gentages ikke', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = requestWithRetry(
    (signal) => new Promise((_, reject) => { calls++; signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError'))); }),
    { path: '/api/game', signal: controller.signal, sleep: noSleep },
  );
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
  assert.equal(calls, 1);
});

test('fejl markeret som ikke-gentagelig (fx for stor optagelse) sendes straks videre', async () => {
  let calls = 0;
  const tooLarge = Object.assign(new Error('Forespørgslen er for stor.'), { code: 'REQUEST_TOO_LARGE', status: 413, retryable: false });
  await assert.rejects(requestWithRetry(async () => { calls++; throw tooLarge; }, { path: '/api/game', method: 'POST', body: actionBody('big'), sleep: noSleep }), (error) => error === tooLarge);
  assert.equal(calls, 1);
});

test('fejlsider uden JSON bliver til en læsbar JSON-fejl', async () => {
  const html = new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } });
  const normalized = await normalizeResponse(html);
  assert.equal(normalized.status, 502);
  assert.equal((await normalized.json()).error, OFFLINE_MESSAGE);
  const captive = await normalizeResponse(new Response('<html>Log ind på wifi</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  assert.equal(captive.status, 502);
  const ok = json({ state: 1 });
  assert.equal(await normalizeResponse(ok), ok);
  const headerless = new Response('{"user":null}', { status: 200 });
  headerless.headers.delete('Content-Type');
  assert.equal(await normalizeResponse(headerless), headerless, 'gyldig JSON uden header bevares');
});

test('rigtig server: en tabt svarpakke og et genforsøg udfører handlingen og betalingen kun én gang', async () => {
  const env = { DB: database(), AUTH_PEPPER: TEST_PEPPER };
  const headers = { Origin: 'https://network.test', Cookie: '__Host-touchline=' + tokenFor('a'), 'Content-Type': 'application/json' };
  const call = (init) => worker.fetch(new Request('https://network.test/api/game', { headers, ...init }), env);
  const before = (await (await call({ method: 'GET' })).json()).state;
  const body = JSON.stringify({ type: 'upgrade', key: 'sponsor', id: 'lost-response-1' });
  let attempt = 0;
  const response = await requestWithRetry(
    async () => {
      attempt++;
      const real = await call({ method: 'POST', body });
      if (attempt === 1) throw new TypeError('Failed to fetch'); // serveren gemte, men svaret nåede aldrig frem
      return real;
    },
    { path: '/api/game', method: 'POST', body, sleep: noSleep },
  );
  assert.equal(response.status, 200);
  assert.equal(attempt, 2);
  const after = (await response.json()).state;
  assert.equal(after.levels.sponsor, before.levels.sponsor + 1, 'opgraderingen er kun udført én gang');
  const again = (await (await call({ method: 'POST', body })).json()).state;
  assert.equal(again.levels.sponsor, after.levels.sponsor, 'samme handlings-id udføres aldrig igen');
  assert(again.money >= after.money, 'der er ikke betalt to gange');
});
