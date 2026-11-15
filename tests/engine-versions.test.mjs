// Versionsstyring og kompatibilitet mellem app og server (M3, trin 1–2).
// Kræver dist/server/index.js (bygges af npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database, TEST_PEPPER, tokenFor } from './database.mjs';
import { createGame, apply } from '../worker/game.js';
import { playerCareerAction } from '../worker/player-career.js';
import { encodeInputs, decodeInputs, replayArcade, getArcadeRules } from '../shared/arcade.js';
import {
  SUPPORTED_MATCH_VERSIONS,
  LATEST_MATCH_VERSION,
  LEGACY_DEFAULT_MATCH_VERSION,
  resolveRequestedMatchVersion,
  configMatchVersion,
  chooseRequestedMatchVersion,
  matchVersionInfo,
} from '../shared/engine-versions.js';
import { rememberServerMatchVersions, requestedMatchVersion, resetServerMatchVersions } from '../src/match-versions.js';

const BASELINE_LIST = [2, 3, 4, 5, 6, 7, 8, 9, 10];
// Baselineadfærd fra worker/game.js og worker/player-career.js før M3.
const baselineRequested = (value) => (BASELINE_LIST.includes(value) ? value : null);
const baselineConfig = (config) => (BASELINE_LIST.includes(config.matchVersion) ? config.matchVersion : 1);

function fixture() {
  const env = { DB: database(), AUTH_PEPPER: TEST_PEPPER };
  const headers = { Origin: 'https://versions.test', Cookie: '__Host-touchline=' + tokenFor('a'), 'Content-Type': 'application/json' };
  return {
    env,
    request(action) {
      return worker.fetch(
        new Request('https://versions.test/api/game', { headers, method: action ? 'POST' : 'GET', body: action ? JSON.stringify(action) : undefined }),
        env,
      );
    },
    save(state) {
      env.DB.sqlite
        .prepare('INSERT INTO clubs (user_id,state,version) VALUES (?,?,0) ON CONFLICT(user_id) DO UPDATE SET state=?,version=version+1')
        .run('a', JSON.stringify(state), JSON.stringify(state));
    },
    read() {
      return JSON.parse(env.DB.sqlite.prepare('SELECT state FROM clubs WHERE user_id=?').get('a').state);
    },
  };
}

function startClubMatch(manualVersion, started) {
  const s = createGame(started);
  apply(s, { id: 'versions-club', type: 'match', control: 'manual', ...(manualVersion === undefined ? {} : { manualVersion }) }, started);
  return s;
}

test('versionsoversigten svarer til de frosne motorer 1–10', () => {
  assert.deepEqual(SUPPORTED_MATCH_VERSIONS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(LATEST_MATCH_VERSION, 10);
  assert.equal(LEGACY_DEFAULT_MATCH_VERSION, 1);
  for (const version of SUPPORTED_MATCH_VERSIONS) assert.equal(getArcadeRules(version).ARCADE_VERSION, version);
  assert.deepEqual(matchVersionInfo(), { supported: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], latest: 10 });
});

test('anmodninger uden eller med kendt version giver præcis samme resultat som baseline', () => {
  const inputs = [undefined, null, 0, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10.5, '10', 'x', NaN, Infinity, {}, []];
  for (const value of inputs) assert.equal(resolveRequestedMatchVersion(value), baselineRequested(value), String(value));
  for (const matchVersion of [undefined, null, 0, 1, 2, 5, 10, '10', 11]) {
    assert.equal(configMatchVersion({ matchVersion }), baselineConfig({ matchVersion }), String(matchVersion));
  }
});

test('en nyere motor, som serveren ikke kender, falder tilbage til motor 10', () => {
  for (const value of [11, 12, 99]) assert.equal(resolveRequestedMatchVersion(value), LATEST_MATCH_VERSION);
});

test('klubkamp: gammel app, APK 37 og fremtidig app får den rigtige motor', () => {
  const now = Date.now();
  const legacy = startClubMatch(undefined, now).active.manual;
  assert.equal(legacy.version, 1);
  assert.equal(legacy.config.matchVersion, undefined, 'gammel app uden version får uændret konfiguration');
  assert.equal(startClubMatch(10, now).active.manual.version, 10);
  assert.equal(startClubMatch(7, now).active.manual.version, 7);
  const future = startClubMatch(11, now).active.manual;
  assert.equal(future.version, 10);
  assert.equal(future.config.matchVersion, 10);
  assert.equal(future.config.formation, '4-3-3', 'tilbagefaldet får samme konfiguration som en motor 10-kamp');
  assert.deepEqual(future.config, { ...startClubMatch(10, now).active.manual.config });
  assert.equal(startClubMatch('10', now).active.manual.version, 1, 'ugyldig værdi beholder baselineadfærd');
});

test('spillerkarriere: en ukendt nyere motor falder tilbage til motor 10', () => {
  const now = Date.now();
  for (const [requested, expected] of [[undefined, 1], [10, 10], [11, 10]]) {
    const s = createGame(now);
    playerCareerAction(s, { id: 'versions-player', type: 'player-career-create', name: 'Oliver', position: 'MID', journeyVersion: 1 }, now);
    playerCareerAction(s, { id: 'versions-personal', type: 'player-career-match', control: 'manual', journeyVersion: 1, ...(requested === undefined ? {} : { manualVersion: requested }) }, now);
    assert.equal(s.playerCareer.active.manual.version, expected, String(requested));
  }
});

test('gemte kampe genafspilles med deres oprindelige motor og omskrives aldrig', async () => {
  for (const version of [6, 7, 9, 10]) {
    const f = fixture();
    const rules = getArcadeRules(version);
    const started = Date.now() - rules.DURATION_MS - 1000;
    const s = startClubMatch(version, started);
    s.last = Date.now();
    f.save(s);
    const tape = new Uint16Array(rules.INPUT_COUNT);
    const move = [65, 67, 1, 2].find((mask) => rules.validateMask(mask));
    for (let i = 5; i < 60; i++) tape[i] = move;
    const inputs = encodeInputs(tape, version);
    const expected = replayArcade(s.active.manual.seed, s.active.manual.config, decodeInputs(inputs, version));
    const response = await f.request({ id: 'finish-' + version, type: 'manual-match-finish', matchId: s.active.id, inputs });
    assert.equal(response.status, 200, await response.clone().text());
    const data = await response.json();
    assert.equal(data.result.home, expected.homeScore, `motor ${version}`);
    assert.equal(data.result.away, expected.awayScore, `motor ${version}`);
    assert.equal(f.read().history[0].manual.version, version, 'historikken beholder den oprindelige motor');
  }
});

test('en gemt kamp med ukendt version afvises i stedet for at blive omskrevet', async () => {
  const f = fixture();
  const started = Date.now() - 260000;
  const s = startClubMatch(10, started);
  s.active.manual.version = 11;
  s.active.manual.config.matchVersion = 11;
  s.last = Date.now();
  f.save(s);
  const response = await f.request({ id: 'finish-unknown', type: 'manual-match-finish', matchId: s.active.id, inputs: encodeInputs(new Uint16Array(5000), 10) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /understøttes ikke/);
  assert.equal(f.read().active.manual.version, 11, 'kampen er hverken omskrevet eller afsluttet');
});

test('API-svaret indeholder versionsoversigten ved hentning og gemning', async () => {
  const f = fixture();
  const get = await (await f.request()).json();
  assert.deepEqual(get.matchVersions, { supported: SUPPORTED_MATCH_VERSIONS, latest: LATEST_MATCH_VERSION });
  const post = await (await f.request({ id: 'versions-upgrade', type: 'upgrade', key: 'sponsor' })).json();
  assert.deepEqual(post.matchVersions, get.matchVersions);
  const started = await (await f.request({ id: 'versions-start', type: 'match', control: 'manual', manualVersion: 11 })).json();
  assert.equal(started.state.active.manual.version, 10, 'en ny app, der beder om motor 11, får motor 10 af denne server');
});

test('appen vælger den nyeste version, som både app og server kender', () => {
  resetServerMatchVersions();
  assert.equal(requestedMatchVersion(), 10, 'ældre server uden oversigt: motor 10 antages');
  rememberServerMatchVersions({ state: {} });
  assert.equal(requestedMatchVersion(), 10);
  rememberServerMatchVersions({ matchVersions: matchVersionInfo() });
  assert.equal(requestedMatchVersion(), 10);
  assert.equal(requestedMatchVersion(11), 10, 'fremtidig app (motor 11) mod denne server: motor 10');
  rememberServerMatchVersions({ matchVersions: { supported: [...SUPPORTED_MATCH_VERSIONS, 11], latest: 11 } });
  assert.equal(requestedMatchVersion(), 10, 'denne app mod fremtidig server: appens egen nyeste');
  assert.equal(requestedMatchVersion(11), 11);
  rememberServerMatchVersions({ matchVersions: 'ugyldig' });
  assert.equal(requestedMatchVersion(11), 11, 'ugyldig oversigt ignoreres');
  resetServerMatchVersions();
  assert.equal(chooseRequestedMatchVersion({ latest: 9, supported: [1, 2, 3, 4, 5, 6, 7, 8, 9] }), 9);
  assert.equal(chooseRequestedMatchVersion(undefined, 11), 10);
});
