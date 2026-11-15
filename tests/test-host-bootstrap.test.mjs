// Isoleret, lokal prøve af testhostingens engangs-klargøring og native adgang.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLocalDatabase } from '../dev/local-db.mjs';
import { installNetworkGuard } from '../dev/isolation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://touchline37-engine11-test.glowingconch1.chatgpt.site';
const PROJECT_ID = 'appgprj_6af9bc223af88191b6d68d7616afcc25';
const ENVIRONMENT = 'touchline37-engine11-test';
const NATIVE = { Origin: 'https://localhost', 'X-Touchline-Test-Engine': '11' };
const versions = resolve(ROOT, 'shared/engine-versions.js');
const localVersions = resolve(ROOT, 'dev/engine-versions-local.js');
const compiled = await build({
  entryPoints: [resolve(ROOT, 'dev/test-host/entry.js')], bundle: true, minify: true,
  format: 'esm', platform: 'browser', write: false, logLevel: 'error',
  plugins: [{ name: 'isolated-host-test', setup(b) {
    b.onResolve({ filter: /engine-versions\.js$/ }, (args) => {
      if (args.importer !== localVersions && resolve(args.resolveDir, args.path) === versions) return { path: localVersions };
    });
    b.onResolve({ filter: /generated-[^/]+\.js$/ }, (args) => ({ path: args.path, namespace: 'unused-resource' }));
    b.onLoad({ filter: /.*/, namespace: 'unused-resource' }, () => ({ contents: 'export default {}', loader: 'js' }));
  } }],
});
const output = resolve(ROOT, '.dev-data/build/test-host-wrapper-test.mjs');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, compiled.outputFiles[0].contents);
const worker = (await import(pathToFileURL(output))).default;

function fixture(t, { markerTable = true } = {}) {
  const db = openLocalDatabase(':memory:');
  if (markerTable) db.sqlite.exec('CREATE TABLE touchline_test_environment (environment TEXT PRIMARY KEY NOT NULL)');
  const env = {
    DB: db, AUTH_PEPPER: 'engine11-test-only-' + randomBytes(32).toString('hex'),
    TOUCHLINE_TEST_ENVIRONMENT: ENVIRONMENT,
    TOUCHLINE_TEST_PROJECT_ID: PROJECT_ID, TOUCHLINE_TEST_ORIGIN: ORIGIN,
    TOUCHLINE_TEST_SETUP_ENABLED: 'true',
    TOUCHLINE_TEST_SETUP_TOKEN: randomBytes(32).toString('hex'),
    TOUCHLINE_TEST_LOGIN_PASSWORD: 'Synthetic-host-password-123',
    MAIL_API_KEY: 'deliberately-not-a-real-key', MAIL_FROM: 'blocked@touchline.invalid', SUPPORT_TO: 'blocked@touchline.invalid',
  };
  const guard = installNetworkGuard();
  t.after(() => { guard.restore(); db.close(); });
  function request(path, { bindings = env, method = 'GET', headers = {}, body, origin = ORIGIN } = {}) {
    return worker.fetch(new Request(origin + path, {
      method, headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }), bindings, {});
  }
  const init = (options = {}) => request('/internal/test-initialize', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.TOUCHLINE_TEST_SETUP_TOKEN }, ...options,
  });
  const changes = () => db.sqlite.prepare('SELECT total_changes() AS n').get().n;
  return { db, env, guard, request, init, changes };
}

test('forkert testidentitet, token og opsætningsflag giver ingen databasewrites', async (t) => {
  const f = fixture(t);
  const before = f.changes();
  for (const bindings of [
    { ...f.env, TOUCHLINE_TEST_SETUP_ENABLED: undefined },
    { ...f.env, TOUCHLINE_TEST_SETUP_TOKEN: 'too-short' },
    { ...f.env, TOUCHLINE_TEST_LOGIN_PASSWORD: 'too-short' },
    { ...f.env, TOUCHLINE_TEST_PROJECT_ID: 'other-project' },
    { ...f.env, TOUCHLINE_TEST_ORIGIN: 'https://other.invalid' },
    { ...f.env, TOUCHLINE_TEST_ENVIRONMENT: 'other-environment' },
    { ...f.env, AUTH_PEPPER: 'not-the-test-pepper-' + 'x'.repeat(64) },
    { ...f.env, DB: undefined },
  ]) {
    const response = await f.init({ bindings });
    assert([404, 503].includes(response.status));
    assert.equal(f.changes(), before);
  }
  for (const headers of [{}, { Authorization: 'Bearer wrong-token' }, { Authorization: 'Basic not-allowed' }]) {
    assert.equal((await f.init({ headers })).status, 403);
    assert.equal(f.changes(), before);
  }
  assert.equal((await f.init({ origin: 'https://other.invalid' })).status, 503);
  assert.equal((await f.init({ method: 'GET' })).status, 405);
  assert.equal(f.changes(), before);
  assert.deepEqual(f.guard.blocked, []);
});

test('manglende sentinel-skema bliver aldrig oprettet fra en request', async (t) => {
  const f = fixture(t, { markerTable: false });
  const before = f.changes();
  assert.equal((await f.init()).status, 503);
  assert.equal(f.changes(), before);
  assert.equal(f.db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'touchline_test_environment'").get(), undefined);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n, 0);
});

test('anden miljømarkør, uvedkommende konti og forældreløse klubber afvises før writes', async (t) => {
  for (const contamination of ['marker', 'account', 'club']) {
    const f = fixture(t);
    if (contamination === 'marker') f.db.sqlite.prepare('INSERT INTO touchline_test_environment(environment) VALUES (?)').run('other-environment');
    if (contamination === 'account') f.db.sqlite.prepare('INSERT INTO accounts(id,email,password_hash,password_salt,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').run('unrelated', 'outside@example.test', 'hash', 'salt', '', 0);
    if (contamination === 'club') f.db.sqlite.prepare('INSERT INTO clubs(user_id,state,version) VALUES (?,?,0)').run('orphan', '{}');
    const before = f.changes();
    assert.equal((await f.init()).status, 503, contamination);
    assert.equal(f.changes(), before, contamination);
  }
});

test('normal API og statusside skriver ingen konti eller sentinel før klargøring', async (t) => {
  const f = fixture(t);
  const before = f.changes();
  const status = await f.request('/');
  assert.equal(status.status, 200);
  assert.match(await status.text(), /afventer klargøring/);
  assert.equal((await f.request('/api/test-environment')).status, 503);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', headers: NATIVE, body: { email: 'test3@touchline.invalid', password: f.env.TOUCHLINE_TEST_LOGIN_PASSWORD } })).status, 503);
  assert.equal(f.changes(), before);
});

test('engangsklargøring skaber kun tre fiktive konti og klubber og kan genkøres uden writes', async (t) => {
  const f = fixture(t);
  const response = await f.init();
  assert.equal(response.status, 200, await response.clone().text());
  const text = await response.text();
  assert(!text.includes(f.env.TOUCHLINE_TEST_LOGIN_PASSWORD));
  assert(!text.includes(f.env.TOUCHLINE_TEST_SETUP_TOKEN));
  assert(!response.headers.has('set-cookie'));
  assert.deepEqual(JSON.parse(text), { initialized: true, environment: ENVIRONMENT, created: 3, existing: 0 });
  assert.deepEqual(f.db.sqlite.prepare('SELECT email FROM accounts ORDER BY email').all().map((r) => r.email), [
    'test1@touchline.invalid', 'test2@touchline.invalid', 'test3@touchline.invalid',
  ]);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM clubs').get().n, 3);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM touchline_test_environment').get().n, 1);
  const rich = JSON.parse(f.db.sqlite.prepare("SELECT c.state FROM clubs c JOIN accounts a ON a.id = c.user_id WHERE a.email = 'test3@touchline.invalid'").get().state);
  assert.equal(rich.name, 'Prøvelund BK');
  assert.equal(rich.money, 250000);
  assert.deepEqual(rich.levels, { stadium: 8, training: 7, sponsor: 7 });
  const before = f.changes();
  assert.deepEqual(await (await f.init()).json(), { initialized: true, environment: ENVIRONMENT, created: 0, existing: 3 });
  assert.equal(f.changes(), before);
  assert.deepEqual(f.guard.blocked, []);
});

test('klargøringsruten kan lukkes mens native login og kampstart bruger motor 11', async (t) => {
  const f = fixture(t);
  assert.equal((await f.init()).status, 200);
  const env = { ...f.env, TOUCHLINE_TEST_SETUP_ENABLED: undefined, TOUCHLINE_TEST_SETUP_TOKEN: undefined, TOUCHLINE_TEST_LOGIN_PASSWORD: undefined };
  assert.equal((await f.init({ bindings: env })).status, 404);
  const attestation = await f.request('/api/test-environment', { bindings: env });
  assert.deepEqual(await attestation.json(), { isolated: true, engine: 11, environment: ENVIRONMENT });
  const login = await f.request('/api/auth/login', {
    bindings: env, method: 'POST', headers: NATIVE,
    body: { email: 'test3@touchline.invalid', password: f.env.TOUCHLINE_TEST_LOGIN_PASSWORD },
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const started = await f.request('/api/game', {
    bindings: env, method: 'POST', headers: { ...NATIVE, Cookie: cookie },
    body: { id: 'host-m11-start', type: 'match', control: 'manual', manualVersion: 10 },
  });
  assert.equal(started.status, 200, await started.clone().text());
  const game = await started.json();
  assert.equal(game.state.active.manual.version, 11);
  assert.equal(game.state.active.manual.config.matchVersion, 11);
  assert.equal((await f.request('/api/auth/capabilities', { bindings: env, headers: { ...NATIVE, Cookie: cookie } })).status, 200);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM support_messages').get().n, 0);
  assert.deepEqual(f.guard.blocked, []);
});

test('normal drift afviser efterfølgende uvedkommende data og alternative værter uden writes', async (t) => {
  const f = fixture(t);
  assert.equal((await f.init()).status, 200);
  const before = f.changes();
  assert.equal((await f.request('/api/test-environment', { origin: 'https://other.invalid' })).status, 503);
  assert.equal(f.changes(), before);
  f.db.sqlite.prepare('INSERT INTO accounts(id,email,password_hash,password_salt,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').run('unrelated', 'outside@example.test', 'hash', 'salt', '', 0);
  const contaminated = f.changes();
  assert.equal((await f.request('/api/test-environment')).status, 503);
  assert.equal((await f.request('/api/game', { headers: NATIVE })).status, 503);
  assert.equal(f.changes(), contaminated);
});
