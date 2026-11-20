// Kun isoleret in-memory SQLite og testpepper. Ingen hosting eller produktionsdata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openLocalDatabase, memoryBucket } from '../dev/local-db.mjs';
import { installNetworkGuard } from '../dev/isolation.mjs';
import { authRoute } from '../worker/auth.js';
import { replayArcade, encodeInputs, getArcadeRules } from '../shared/arcade.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENVIRONMENT = 'touchline37-engine11-test';
const SERVER_ORIGIN = 'https://android-api.touchline.invalid';
const NATIVE_HEADERS = { Origin: 'https://localhost', 'X-Touchline-Test-Engine': '11' };
const ACCOUNT = { email: 'test3@touchline.invalid', password: 'Touchline-test-3' };
const context = { waitUntil() {}, passThroughOnException() {} };

// Byg alene denne særskilte indgang. Store web-/APK-ressourcer stubs, fordi
// adapteren nægter alle deres ruter. Produktionens build ændres ikke.
async function buildAdapter(localVersions) {
  const versions = resolve(ROOT, 'shared/engine-versions.js');
  const local = resolve(ROOT, 'dev/engine-versions-local.js');
  const result = await build({
    entryPoints: [resolve(ROOT, 'dev/android-test-worker.js')],
    bundle: true, format: 'esm', platform: 'browser', minify: true, write: false,
    plugins: [{ name: 'isolated-android-test-build', setup(b) {
      b.onResolve({ filter: /engine-versions\.js$/ }, (args) => {
        if (!localVersions || args.importer === local || resolve(args.resolveDir, args.path) !== versions) return;
        return { path: local };
      });
      b.onResolve({ filter: /generated-[^/]+\.js$/ }, (args) => ({ path: args.path, namespace: 'unused-test-resource' }));
      b.onLoad({ filter: /.*/, namespace: 'unused-test-resource' }, () => ({ contents: 'export default {}', loader: 'js' }));
    } }],
    logLevel: 'error',
  });
  const file = resolve(ROOT, '.dev-data/build/android-test-worker-test-' + (localVersions ? '11' : 'production-rules') + '.mjs');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, result.outputFiles[0].contents);
  return (await import(pathToFileURL(file))).default;
}
const worker = await buildAdapter(true);
const unconfiguredWorker = await buildAdapter(false);

async function fixture(t, { outsider = false } = {}) {
  const db = openLocalDatabase(':memory:');
  db.sqlite.exec('CREATE TABLE touchline_test_environment (environment TEXT PRIMARY KEY NOT NULL)');
  db.sqlite.prepare('INSERT INTO touchline_test_environment(environment) VALUES (?)').run(ENVIRONMENT);
  const env = {
    DB: db, BUCKET: memoryBucket(), AUTH_PEPPER: 'engine11-test-only-' + randomBytes(32).toString('hex'),
    TOUCHLINE_TEST_ENVIRONMENT: ENVIRONMENT,
    // Med vilje til stede: adapteren må aldrig videresende disse bindings.
    MAIL_API_KEY: 'not-a-real-mail-key-for-test-only', MAIL_FROM: 'sender@touchline.invalid', SUPPORT_TO: 'support@touchline.invalid',
  };
  const guard = installNetworkGuard();
  t.after(() => { guard.restore(); db.close(); });
  async function register(account) {
    const result = await authRoute(new Request(SERVER_ORIGIN + '/api/auth/register', {
      method: 'POST', headers: { Origin: SERVER_ORIGIN }, body: JSON.stringify(account),
    }), { DB: db, AUTH_PEPPER: env.AUTH_PEPPER });
    assert.equal(result.status, 201, await result.clone().text());
    return result.headers.get('set-cookie').split(';')[0];
  }
  const cookie = await register(ACCOUNT);
  const outsiderCookie = outsider ? await register({ email: 'outside@example.test', password: 'Outside-account-123' }) : null;
  const request = (path, { body, method = body === undefined ? 'GET' : 'POST', headers = {}, cookie: session = cookie, bindings = env } = {}) => worker.fetch(new Request(SERVER_ORIGIN + path, {
    method, headers: { ...NATIVE_HEADERS, ...(session ? { Cookie: session } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), bindings, context);
  const game = (body, options) => request('/api/game', { body, ...options });
  const accountId = db.sqlite.prepare('SELECT id FROM accounts WHERE email = ?').get(ACCOUNT.email).id;
  function savedState() { return JSON.parse(db.sqlite.prepare('SELECT state FROM clubs WHERE user_id = ?').get(accountId).state); }
  function updateState(change) {
    const state = savedState(); change(state);
    db.sqlite.prepare('UPDATE clubs SET state = ?, version = version + 1 WHERE user_id = ?').run(JSON.stringify(state), accountId);
    return state;
  }
  return { db, env, guard, request, game, cookie, outsiderCookie, savedState, updateState };
}

test('miljøattest kræver særskilt flag, egen pepper, DB-sentinel og kompileret motor 11', async (t) => {
  const f = await fixture(t);
  const response = await f.request('/api/test-environment');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { isolated: true, engine: 11, engineRevision: 2, environment: ENVIRONMENT });
  for (const bindings of [
    { ...f.env, TOUCHLINE_TEST_ENVIRONMENT: undefined },
    { ...f.env, AUTH_PEPPER: 'x'.repeat(80) },
    { ...f.env, DB: undefined },
  ]) {
    const fail = await f.request('/api/test-environment', { bindings });
    assert.equal(fail.status, 503); assert.equal((await fail.json()).isolated, false);
  }
  const wrongBuild = await unconfiguredWorker.fetch(new Request(SERVER_ORIGIN + '/api/test-environment'), f.env, context);
  assert.equal(wrongBuild.status, 503, 'produktionsversionsregler kan aldrig attestere motor 11');
  f.db.sqlite.exec('DELETE FROM touchline_test_environment');
  assert.equal((await f.request('/api/test-environment')).status, 503);
  f.db.sqlite.exec('DROP TABLE touchline_test_environment');
  assert.equal((await f.request('/api/test-environment')).status, 503, 'en ukendt DB ændres aldrig automatisk');
  assert.deepEqual(f.guard.blocked, []);
});

test('native kontrakt kræves, mail og registrering er spærret, og uvedkommende konti kan ikke åbnes', async (t) => {
  const f = await fixture(t, { outsider: true });
  for (const headers of [{ Origin: 'https://other.invalid' }, { 'X-Touchline-Test-Engine': '' }, { 'X-Touchline-Test-Engine': '10' }]) {
    assert.equal((await f.game(undefined, { headers })).status, 403);
  }
  for (const path of ['/api/auth/register', '/api/auth/request-reset', '/api/auth/reset-password', '/api/auth/change-email', '/api/auth/request-verification', '/api/auth/delete', '/api/contact', '/downloads/touchline.apk', '/owner-builds/test', '/dev/motor11', '/play', '/']) {
    assert.equal((await f.request(path, { body: { email: 'new@touchline.invalid', password: 'Password123' } })).status, 403, path);
  }
  const capabilities = await f.request('/api/auth/capabilities');
  assert.deepEqual(await capabilities.json(), { emailDelivery: false, testEnvironment: true, registration: false, accountChanges: false }, 'mailbindings videresendes aldrig');
  assert.equal((await f.request('/api/auth/login', { body: { email: 'outside@example.test', password: 'Outside-account-123' }, cookie: null })).status, 403);
  assert.equal((await f.request('/api/auth/me', { cookie: f.outsiderCookie })).status, 403);
  assert.equal((await f.game(undefined, { cookie: f.outsiderCookie })).status, 403);
  assert.equal((await f.game(undefined, { cookie: null })).status, 401);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n, 2);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM support_messages').get().n, 0);
  assert.deepEqual(f.guard.blocked, []);
});

test('testkonto logger ind via normal passwordvalidering og logger ud igen', async (t) => {
  const f = await fixture(t);
  const wrong = await f.request('/api/auth/login', { cookie: null, body: { ...ACCOUNT, password: 'Wrong-password-123' } });
  assert.equal(wrong.status, 401);
  const login = await f.request('/api/auth/login', { cookie: null, body: ACCOUNT });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await f.request('/api/auth/me', { cookie })).json()).user.email, ACCOUNT.email);
  assert.equal((await f.request('/api/auth/logout', { cookie, body: {} })).status, 200);
  assert.equal((await (await f.request('/api/auth/me', { cookie })).json()).user, null);
  assert.deepEqual(f.guard.blocked, []);
});

for (const career of [false, true]) for (const revision of [1, 2]) {
  test((career ? 'spillerkarriere' : 'klubkamp') + `: motor 11 revision ${revision} uden browsercookie, fuld validering og idempotent gemning`, async (t) => {
    const f = await fixture(t);
    assert.equal((await f.game()).status, 200);
    if (career) {
      const create = await f.game({ id: 'create-test-player', type: 'player-career-create', name: 'Testspiller', position: 'ANG', journeyVersion: 1 });
      assert.equal(create.status, 200, await create.clone().text());
    }
    const started = await f.game({ id: 'start-test-match', type: career ? 'player-career-match' : 'match', control: 'manual', manualVersion: 1, ...(career ? { journeyVersion: 1 } : {}) }, { headers: revision === 2 ? { 'X-Touchline-Test-Engine-Revision': '2' } : {} });
    assert.equal(started.status, 200, await started.clone().text());
    const start = await started.json();
    const active = career ? start.state.playerCareer.active : start.state.active;
    assert.equal(active.manual.version, 11); assert.equal(active.manual.config.matchVersion, 11);
    assert.equal(active.manual.config.engineRevision, revision === 2 ? 2 : undefined);
    assert.equal(started.headers.get('x-touchline-test-engine'), '11');
    const rules = getArcadeRules(11);
    const tape = new Uint16Array(rules.INPUT_COUNT);
    const expected = replayArcade(active.manual.seed, active.manual.config, tape);
    const action = { id: 'save-test-match', type: career ? 'player-career-manual-finish' : 'manual-match-finish', matchId: active.id, inputs: encodeInputs(tape, 11) };
    const early = await f.game(action);
    assert.equal(early.status, 400); assert.match((await early.json()).error, /ikke færdigspillet/);
    f.updateState((s) => { const a = career ? s.playerCareer.active : s.active; a.ends = Date.now() - 1000; a.started = a.ends - rules.DURATION_MS; });
    const invalid = await f.game({ ...action, id: 'invalid-tape', inputs: 'invalid' });
    assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /ugyldig styring/);
    const finished = await f.game(action);
    assert.equal(finished.status, 200, await finished.clone().text());
    const saved = await finished.json();
    const history = career ? saved.state.playerCareer.history : saved.state.history;
    assert.equal(history[0].home, expected.homeScore); assert.equal(history[0].away, expected.awayScore);
    const before = f.savedState();
    const count = career ? before.playerCareer.stats.matches : before.played;
    const repeat = await f.game({ ...action, id: 'save-test-match-retry' });
    assert.equal(repeat.status, 200, await repeat.clone().text());
    const after = f.savedState();
    assert.equal(career ? after.playerCareer.stats.matches : after.played, count);
    assert.equal((career ? after.playerCareer.history : after.history).filter((m) => m.id === active.id).length, 1);
    assert.deepEqual(f.guard.blocked, []);
  });
}

test('nye klienter bevarer aktive originalkampe, og en ukendt revision skaber ingen kamp', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.game()).status, 200);
  const unknown = await f.game({ id: 'unsupported-revision', type: 'match', control: 'manual' }, { headers: { 'X-Touchline-Test-Engine-Revision': '99' } });
  assert.equal(unknown.status, 400);
  assert.equal(f.savedState().active, null);
  const legacy = await f.game({ id: 'legacy-start', type: 'match', control: 'manual', engineRevision: 2 });
  assert.equal(legacy.status, 200);
  const before = (await legacy.json()).state.active;
  assert.equal(before.manual.config.engineRevision, undefined, 'uden ny nativeheader er dette stadig original motor 11');
  const resumed = await f.game(undefined, { headers: { 'X-Touchline-Test-Engine-Revision': '2' } });
  const active = (await resumed.json()).state.active;
  assert.equal(active.id, before.id);
  assert.deepEqual(active.manual, before.manual);
  f.updateState(s => { s.active.manual.config.engineRevision = 99; });
  const invalid = await f.game({ id: 'invalid-revision-save', type: 'manual-match-finish', matchId: active.id, inputs: encodeInputs(new Uint16Array(getArcadeRules(11).INPUT_COUNT), 11) });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /revisionen understøttes ikke/);
});

test('testadapteren indgår ikke i produktionsbygningen eller motor 1–10', () => {
  assert(!readFileSync(resolve(ROOT, 'build.mjs'), 'utf8').includes('android-test-worker'));
  const adapter = readFileSync(resolve(ROOT, 'dev/android-test-worker.js'), 'utf8');
  assert(!/(?<!async |\.)\bfetch\(/.test(adapter), 'adapteren laver ingen egne netværkskald');
  assert(!adapter.includes('CREATE TABLE') && !adapter.includes('INSERT INTO'), 'requesthandlers opretter intet skema eller testkonti');
});

for(const career of [false,true])test(`kickoff lead preserves full duration through the actual ${career?'career':'club'} adapter`,async t=>{
 const f=await fixture(t);await f.game();
 if(career)assert.equal((await f.game({id:'kickoff-player',type:'player-career-create',name:'Testspiller',position:'ANG',journeyVersion:1})).status,200);
 const before=Date.now();const response=await f.game({id:'kickoff-start',type:career?'player-career-match':'match',control:'manual',manualVersion:11,kickoffLeadMs:8000},{headers:{'X-Touchline-Test-Engine-Revision':'2'}});assert.equal(response.status,200);const data=await response.json(),active=career?data.state.playerCareer.active:data.state.active;
 assert(active.started>=before+8000);assert.equal(active.ends-active.started,250000);assert.equal(active.manual.kickoffLeadMs,8000);assert.equal(active.manual.expiresAt,active.ends+86400000);
});
