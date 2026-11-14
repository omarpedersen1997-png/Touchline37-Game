// Spærring mod produktion: testmiljøet må aldrig kunne nå produktionsserveren,
// produktionsdatabasen eller produktionshemmeligheder.
// Kræver web-draft/server.mjs (bygges af npm test før denne fil køres).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN_ENV,
  PRODUCTION_MARKERS,
  IsolationError,
  assertSafeEnvironment,
  installNetworkGuard,
  productionMarkersIn,
} from '../dev/isolation.mjs';
import { startLocalServer } from '../dev/local-server.mjs';
import { seed, TEST_ACCOUNTS } from '../dev/seed.mjs';
import { openLocalDatabase } from '../dev/local-db.mjs';

// Node's oprindelige fetch gemmes før spærringen installeres, så testen kan tale med
// den lokale server; Worker-koden ser kun den spærrede udgave.
const nativeFetch = globalThis.fetch.bind(globalThis);
const fetchLocal = (local, path, init) => nativeFetch(local.url + path, init);
const workerOf = (local) => local.worker;

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

function filesUnder(dir, extensions) {
  const out = [];
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const path = join(dir, name);
    if (statSync(resolve(ROOT, path)).isDirectory()) out.push(...filesUnder(path, extensions));
    else if (extensions.some((ext) => name.endsWith(ext))) out.push(path);
  }
  return out;
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'touchline-isolation-'));
}

// Kør serveren uden at arve eventuelle variabler fra den kørende shell.
const cleanEnv = {};

test('testmiljøets kildekode indeholder ingen produktionsværter, -projekter eller -hemmeligheder', () => {
  const files = [...filesUnder('dev', ['.mjs', '.js', '.json', '.md']), 'tests/production-isolation.test.mjs', 'tests/bundle-budget.test.mjs'];
  assert(files.length >= 5);
  for (const file of files) {
    assert.deepEqual(productionMarkersIn(read(file)), [], `${file} refererer til produktion`);
  }
});

test('markørlisten dækker de produktionsadresser, der faktisk står i projektet', () => {
  const plugin = read('android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java');
  assert(productionMarkersIn(plugin).length >= 2, 'Markørerne skal kunne genkende den produktive API-adresse');
  assert(productionMarkersIn(read('worker/index.js')).length >= 1, 'Markørerne skal kunne genkende hjemmesidens domæne');
  assert(productionMarkersIn(read('.openai/hosting.json')).length >= 1, 'Markørerne skal kunne genkende Sites-projektet');
  assert.equal(new Set(PRODUCTION_MARKERS).size, PRODUCTION_MARKERS.length);
});

test('produktionens API-adresse findes kun i den eksisterende native bro', () => {
  const apiMarkers = PRODUCTION_MARKERS.filter((marker) => marker.includes('site') || marker.includes('conch'));
  const files = [
    ...filesUnder('src', ['.js', '.jsx']),
    ...filesUnder('shared', ['.js']),
    ...filesUnder('worker', ['.js']),
    ...filesUnder('dev', ['.mjs']),
    ...filesUnder('android/app/src', ['.java', '.xml', '.json']),
    'capacitor.config.json',
  ];
  const hits = files.filter((file) => {
    const text = read(file).toLowerCase();
    return apiMarkers.some((marker) => text.includes(marker));
  });
  assert.deepEqual(hits, ['android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java']);
});

test('.openai/hosting.json bruges kun af den eksisterende build.mjs', () => {
  const files = [
    'build.mjs',
    ...filesUnder('src', ['.js', '.jsx']),
    ...filesUnder('shared', ['.js']),
    ...filesUnder('worker', ['.js']),
    ...filesUnder('scripts', ['.mjs', '.js', '.jsx', '.py']),
    ...filesUnder('dev', ['.mjs']),
  ];
  const users = files.filter((file) => read(file).includes('hosting.json'));
  assert.deepEqual(users, ['build.mjs']);
});

test('lokale testdata er udelukket fra Git', () => {
  const ignored = read('.gitignore').split(/\r?\n/).map((line) => line.trim());
  assert(ignored.includes('.dev-data/'));
  assert(ignored.includes('web-draft/'));
});

test('testmiljøet nægter at starte med produktionslignende hemmeligheder i miljøet', async () => {
  for (const name of FORBIDDEN_ENV) {
    assert.throws(() => assertSafeEnvironment({ [name]: 'noget' }), IsolationError, name);
  }
  assert.doesNotThrow(() => assertSafeEnvironment({ PATH: '/usr/bin', [FORBIDDEN_ENV[0]]: '' }));
  await assert.rejects(startLocalServer({ env: { AUTH_PEPPER: 'x' }, port: 0, dataDir: tempDir() }), IsolationError);
});

test('testserveren kan kun lytte lokalt', async () => {
  await assert.rejects(startLocalServer({ env: cleanEnv, host: '0.0.0.0', port: 0, dataDir: tempDir() }), /kun lokalt/);
});

test('netværksspærringen blokerer og registrerer alle udgående forsøg', async () => {
  const target = { fetch: async () => new Response('ok') };
  const guard = installNetworkGuard(target);
  for (const marker of PRODUCTION_MARKERS) {
    await assert.rejects(target.fetch('https://' + marker + '/api/game'), IsolationError);
  }
  await assert.rejects(target.fetch(new Request('https://example.com/')), IsolationError);
  assert.equal(guard.blocked.length, PRODUCTION_MARKERS.length + 1);
  guard.restore();
  assert.equal(await (await target.fetch()).text(), 'ok');
});

test('fuldt forløb i testmiljøet bruger kun lokal database og laver ingen udgående forbindelser', async (t) => {
  const dataDir = tempDir();
  const local = await startLocalServer({ env: cleanEnv, port: 0, dataDir });
  t.after(async () => {
    await local.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  assert.match(local.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert(local.db.file.startsWith(dataDir), 'Databasen skal ligge i testmappen');
  assert(local.env.AUTH_PEPPER.startsWith('local-test-only-'));
  assert.equal(local.env.MAIL_API_KEY, undefined);

  // Spillet og hjemmesiden svarer lokalt.
  const play = await fetchLocal(local, '/play');
  assert.equal(play.status, 200);
  assert.equal(play.headers.get('x-touchline-environment'), 'local-test');
  assert((await play.text()).includes('/api/game'));

  // Seed testkonti via den rigtige API-kode.
  const result = await seed({ db: local.db, worker: workerOf(local), pepper: local.env.AUTH_PEPPER });
  assert.deepEqual(result.created, TEST_ACCOUNTS.map((account) => account.email));
  const again = await seed({ db: local.db, worker: workerOf(local), pepper: local.env.AUTH_PEPPER });
  assert.equal(again.created.length, 0);

  // Login, indlæsning og en gemt handling over HTTP.
  const origin = local.url;
  const login = await fetchLocal(local, '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_ACCOUNTS[2].email, password: TEST_ACCOUNTS[2].password }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const game = await (await fetchLocal(local, '/api/game', { headers: { Cookie: cookie } })).json();
  assert.equal(game.state.name, TEST_ACCOUNTS[2].clubName);
  const before = game.state.levels.stadium;
  const upgrade = await fetchLocal(local, '/api/game', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'upgrade', key: 'stadium', id: 'isolation-upgrade-1' }),
  });
  const upgraded = await upgrade.json();
  assert.equal(upgrade.status, 200, JSON.stringify(upgraded));
  assert.equal(upgraded.state.levels.stadium, before + 1);

  // POST fra en fremmed oprindelse afvises stadig.
  const foreign = await fetchLocal(local, '/api/game', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'upgrade', key: 'stadium', id: 'isolation-upgrade-2' }),
  });
  assert.equal(foreign.status, 403);

  // Kontaktformularen gemmes lokalt og forsøger ikke at sende mail.
  const contact = await fetchLocal(local, '/api/contact', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'kontakt@touchline.invalid', topic: 'support', message: 'Lokal testbesked fra isolationstesten.' }),
  });
  assert(contact.status < 500, `kontakt gav ${contact.status}`);

  // Ingen udgående forbindelser er forsøgt, og eventuelle forsøg ville blive blokeret.
  assert.deepEqual(local.guard.blocked, []);
  await assert.rejects(globalThis.fetch('https://' + PRODUCTION_MARKERS[0] + '/'), IsolationError);
  assert.equal(local.guard.blocked.length, 1);
  local.guard.blocked.length = 0;

  // Data overlever genstart af databasen.
  const reopened = openLocalDatabase(local.db.file);
  assert.equal(reopened.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n, TEST_ACCOUNTS.length);
  reopened.close();
});

