// Kampmotor 11 kan vælges og spilles i det LOKALE testmiljø – men aldrig i produktionen.
// Kræver dist/server/index.js og .dev-data/build/local-worker.mjs (bygges af npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import production from '../dist/server/index.js';
import { database, TEST_PEPPER, tokenFor } from './database.mjs';
import { startLocalServer } from '../dev/local-server.mjs';
import { seed, TEST_ACCOUNTS } from '../dev/seed.mjs';
import { replayArcade, encodeInputs, getArcadeRules } from '../shared/arcade.js';
import * as engine11 from '../shared/football-engine11.js';
import { createBot } from './support/match-bot.mjs';

const nativeFetch = globalThis.fetch.bind(globalThis);

test('produktionsbygningen indeholder ikke testadapteren og giver motor 10 for en anmodning om motor 11', async () => {
  const bundle = readFileSync('dist/server/index.js', 'utf8');
  assert(!bundle.includes('touchline-local-engine11-adapter'));
  assert(!bundle.includes('LOCAL_TEST_ENGINE_VERSIONS'));
  assert(!readFileSync('build.mjs', 'utf8').includes('dev/'), 'build.mjs bruger ingen dev-filer');
  const env = { DB: database(), AUTH_PEPPER: TEST_PEPPER };
  const headers = { Origin: 'https://prod.test', Cookie: `__Host-touchline=${tokenFor('a')}; touchline-dev-engine=11`, 'Content-Type': 'application/json' };
  const response = await production.fetch(new Request('https://prod.test/api/game', { method: 'POST', headers, body: JSON.stringify({ id: 'p1', type: 'match', control: 'manual', manualVersion: 11 }) }), env);
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.state.active.manual.version, 10, 'produktionen giver motor 10');
  assert.deepEqual(data.matchVersions.latest, 10);
  const devPage = await production.fetch(new Request('https://prod.test/dev/motor11'), env);
  assert(!(devPage.headers.get('Set-Cookie') || '').includes('touchline-dev-engine'), 'produktionen kender ikke motorvælgeren');
});

test('lokalt testmiljø: motor 11 vælges med /dev/motor11 og en hel kamp valideres identisk af klient og server', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'touchline-engine11-'));
  const local = await startLocalServer({ env: {}, port: 0, dataDir });
  t.after(async () => { await local.close(); rmSync(dataDir, { recursive: true, force: true }); });
  await seed({ db: local.db, worker: local.worker, pepper: local.env.AUTH_PEPPER });
  const origin = local.url, account = TEST_ACCOUNTS[2];
  const login = await nativeFetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) });
  assert.equal(login.status, 200);
  const session = login.headers.get('set-cookie').split(';')[0];
  const post = (body, cookie) => nativeFetch(origin + '/api/game', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });

  // Uden valg: normal motor 10.
  assert.equal((await (await nativeFetch(origin + '/dev/status', { headers: { Cookie: session } })).json()).engine, 10);

  // Vælg motor 11.
  const choose = await nativeFetch(origin + '/dev/motor11', { headers: { Cookie: session } });
  assert.equal(choose.status, 200);
  assert((await choose.text()).includes('kampmotor 11'));
  const engineCookie = choose.headers.get('set-cookie').split(';')[0];
  assert.equal(engineCookie, 'touchline-dev-engine=11');
  const cookie = `${session}; ${engineCookie}`;
  assert.equal((await (await nativeFetch(origin + '/dev/status', { headers: { Cookie: cookie } })).json()).engine, 11);

  // Start en 3D-kamp: appen beder om motor 10, testadapteren giver motor 11.
  const started = await post({ id: 'e11-start', type: 'match', control: 'manual', manualVersion: 10 }, cookie);
  assert.equal(started.headers.get('x-touchline-dev-engine'), '11');
  const startData = await started.json();
  assert.equal(started.status, 200, JSON.stringify(startData));
  const manual = startData.state.active.manual;
  assert.equal(manual.version, 11);
  assert.equal(manual.config.matchVersion, 11);

  // "Klienten" spiller kampen lokalt med motor 11 (samme kode som appen bruger).
  const rules = getArcadeRules(11);
  assert.equal(rules, engine11);
  const live = rules.createArcade(manual.seed, manual.config), bot = createBot(rules, { seed: 11 });
  const tape = new Uint16Array(rules.INPUT_COUNT);
  for (let i = 0; i < rules.INPUT_COUNT; i++) { tape[i] = bot(live); rules.stepArcade(live, tape[i]); }
  const expected = replayArcade(manual.seed, manual.config, tape);
  assert.equal(expected.homeScore, live.homeScore);

  // Kampens tid er gået (i stedet for at vente 250 sekunder flyttes sluttidspunktet i testdatabasen).
  const accountId = local.db.sqlite.prepare('SELECT id FROM accounts WHERE email = ?').get(account.email).id;
  const row = local.db.sqlite.prepare('SELECT state, version FROM clubs WHERE user_id = ?').get(accountId);
  const state = JSON.parse(row.state);
  state.active.ends = Date.now() - 1000; state.active.started = state.active.ends - rules.DURATION_MS;
  local.db.sqlite.prepare('UPDATE clubs SET state = ?, version = version + 1 WHERE user_id = ?').run(JSON.stringify(state), accountId);

  const finish = await post({ id: 'e11-finish', type: 'manual-match-finish', matchId: state.active.id, inputs: encodeInputs(tape, 11) }, cookie);
  const finishData = await finish.json();
  assert.equal(finish.status, 200, JSON.stringify(finishData));
  assert.equal(finishData.result.home, expected.homeScore, 'serverens genafspilning = klientens');
  assert.equal(finishData.result.away, expected.awayScore);
  const saved = JSON.parse(local.db.sqlite.prepare('SELECT state FROM clubs WHERE user_id = ?').get(accountId).state);
  assert.equal(saved.history[0].manual.version, 11, 'kampen gemmes med motor 11');
  assert.deepEqual(local.guard.blocked, [], 'ingen udgående forbindelser');

  // Tilbage til motor 10.
  const back = await nativeFetch(origin + '/dev/motor10', { headers: { Cookie: cookie } });
  assert.equal(back.headers.get('set-cookie').split(';')[0], 'touchline-dev-engine=10');
  const normal = await (await post({ id: 'e10-start', type: 'match', control: 'manual', manualVersion: 10 }, `${session}; touchline-dev-engine=10`)).json();
  assert.equal(normal.state.active.manual.version, 10);
});

test('testadapteren ændrer kun starten af 3D-kampe – andre handlinger sendes uændret', () => {
  const source = readFileSync('dev/local-worker-entry.js', 'utf8');
  assert(source.includes("body.control === 'manual' ? JSON.stringify({ ...body, manualVersion: 11 }) : text"));
  // Kun metoden "async fetch(" og kald til draft.fetch( er tilladt – ingen egne netværkskald.
  assert(!/(?<!async |\.)\bfetch\(/.test(source), 'adapteren laver ingen egne netværkskald (kun draft.fetch)');
});
