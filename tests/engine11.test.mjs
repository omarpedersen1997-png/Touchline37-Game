// Kampmotor 11 (M5, første del): protokol, determinisme, fysik, målmand, AI og balance.
// Motor 11 er registreret, men IKKE aktiveret: nye kampe får fortsat motor 10.
// Alle simulationer bruger faste seeds og er derfor deterministiske (ingen tilfældige testfejl).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as e10 from '../shared/football-goals.js';
import * as e11 from '../shared/football-engine11.js';
import { getArcadeRules, replayArcade, encodeInputs, decodeInputs } from '../shared/arcade.js';
import {
  SUPPORTED_MATCH_VERSIONS, EXPERIMENTAL_MATCH_VERSIONS, LATEST_MATCH_VERSION,
  resolveRequestedMatchVersion, chooseRequestedMatchVersion, matchVersionInfo,
} from '../shared/engine-versions.js';
import { playBotMatch, simulate } from './support/match-bot.mjs';

const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

function aiMatch(seed, homeRating, awayRating) {
  const s = e11.createArcade(seed, { homeRating, awayRating, autopilot: true });
  for (let i = 0; i < e11.INPUT_COUNT; i++) e11.stepArcade(s, 0);
  return s;
}
function aiSeries(homeRating, awayRating, matches) {
  const out = { home: 0, away: 0, homeWins: 0, awayWins: 0, shots: 0, passes: 0, completed: 0 };
  for (let m = 0; m < matches; m++) {
    const s = aiMatch(`e11-ai-${homeRating}-${awayRating}-${m}`, homeRating, awayRating);
    out.home += s.homeScore; out.away += s.awayScore;
    if (s.homeScore > s.awayScore) out.homeWins++; else if (s.awayScore > s.homeScore) out.awayWins++;
    out.shots += s.stats.homeShots + s.stats.awayShots;
    out.passes += s.stats.homePassAttempts + s.stats.awayPassAttempts;
    out.completed += s.stats.homeCompletedPasses + s.stats.awayCompletedPasses;
  }
  return { ...out, matches };
}

// --- Protokol og aktivering ------------------------------------------------------------

test('motor 11 bruger præcis samme inputprotokol, bane og tidsplan som motor 10', () => {
  assert.equal(e11.ARCADE_VERSION, 11);
  for (const key of ['STEP_MS', 'INPUT_MS', 'DURATION_MS', 'INPUT_COUNT', 'HALF_MS', 'HALFTIME_MS', 'PLAY_MS', 'SHOOT', 'PASS', 'SPRINT', 'SHOOT_HELD', 'PASS_HELD', 'SKILL', 'THROUGH']) {
    assert.equal(e11[key], e10[key], key);
  }
  assert.deepEqual(e11.FIELD, e10.FIELD);
  assert.deepEqual(e11.GOAL_TIMING, e10.GOAL_TIMING);
  assert.deepEqual(e11.CONTACT, e10.CONTACT);
  assert.deepEqual(e11.TACTICAL_COMMANDS, e10.TACTICAL_COMMANDS);
  assert.deepEqual(e11.DIRECTIONS, e10.DIRECTIONS);
  const tape = playBotMatch(e10, 'protocol', { homeRating: 60, awayRating: 60 }).tape;
  assert.equal(e11.encodeInputs(tape), e10.encodeInputs(tape), 'samme kodning af en optagelse');
  assert.deepEqual([...e11.decodeInputs(e10.encodeInputs(tape))], [...tape]);
});

test('motor 11 er registreret i dispatcheren, men gives ikke til nye kampe', () => {
  assert.equal(getArcadeRules(11), e11);
  assert.equal(getArcadeRules(10), e10, 'motor 10 er uændret standard');
  assert.deepEqual(EXPERIMENTAL_MATCH_VERSIONS, [11]);
  assert(!SUPPORTED_MATCH_VERSIONS.includes(11), 'serveren genafspiller ikke motor 11 endnu');
  assert.equal(LATEST_MATCH_VERSION, 10);
  assert.equal(resolveRequestedMatchVersion(11), 10, 'en app, der beder om motor 11, får motor 10');
  assert.equal(chooseRequestedMatchVersion(matchVersionInfo()), 10);
  assert.equal(chooseRequestedMatchVersion(undefined), 10);
});

test('autopilot kan kun slås til eksplicit i konfigurationen', () => {
  assert.equal(e11.createArcade('x', {}).autopilot, undefined);
  assert.equal(e11.createArcade('x', { autopilot: 'true' }).autopilot, undefined);
  assert.equal(e11.createArcade('x', { autopilot: true }).autopilot, true);
});

// --- Determinisme ------------------------------------------------------------------------

test('samme seed og input giver identisk kamp – også via serverens dekodning', () => {
  const config = { homeRating: 63, awayRating: 58, tactic: 'attacking', personalPosition: 'MID', matchVersion: 11 };
  const { tape, state } = playBotMatch(e11, 'determinism-11', config);
  const first = replayArcade('determinism-11', config, tape);
  const second = replayArcade('determinism-11', config, tape);
  const server = replayArcade('determinism-11', config, decodeInputs(encodeInputs(tape, 11), 11));
  assert.equal(sha(first), sha(second));
  assert.equal(sha(first), sha(server), 'klient og server beregner samme kamp');
  assert.equal(sha(first), sha(state), 'genafspilning svarer til den spillede kamp');
  assert.equal(first.version, 11);
  assert(first.homeScore + first.awayScore >= 0 && first.tick === e11.INPUT_COUNT);
});

test('forskellige seeds giver forskellige kampe, og motor 11 er ikke motor 10', () => {
  const config = { homeRating: 60, awayRating: 60 };
  const tape = playBotMatch(e10, 'difference', config).tape;
  const a = e11.replayArcade('seed-a', config, tape), b = e11.replayArcade('seed-b', config, tape);
  assert.notEqual(sha(a), sha(b));
  assert.notEqual(sha(e11.replayArcade('seed-a', config, tape)), sha(e10.replayArcade('seed-a', config, tape)));
});

test('motorfilen bruger ingen ikke-deterministiske kilder', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('shared/football-engine11.js', 'utf8');
  for (const forbidden of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'crypto.']) assert(!source.includes(forbidden), forbidden);
  // Fysikken bruger Math.sqrt (korrekt afrundet efter IEEE-754); Math.hypot kun i inputhjælperen directionMask.
  assert.equal(source.split('Math.hypot(').length - 1, 1);
});

// --- Boldfysik ---------------------------------------------------------------------------

test('rullende bold kommer helt til ro (motor 10 ruller uendeligt langsomt videre)', () => {
  let ball = { x: 0, y: 0, z: .22, vx: 12, vy: 0, vz: 0, curl: 0 }, ticks = 0;
  while (Math.hypot(ball.vx, ball.vy) > 0 && ticks < 200) { ball = e11.stepBallPhysics(ball); ticks++; }
  assert(ticks < 120, `bolden stopper efter ${ticks} ticks`);
  assert(ball.x > 15 && ball.x < 40, `rullelængde ${ball.x.toFixed(1)} m`);
});

test('luftmodstand, mere levende hop og aftagende skru', () => {
  let shot = { x: 0, y: 0, z: 1, vx: 0, vy: 32, vz: 4, curl: 0 };
  for (let i = 0; i < 10; i++) shot = e11.stepBallPhysics(shot);
  assert(shot.z > .22, 'bolden er stadig i luften');
  assert(shot.vy < 31 && shot.vy > 26.5, `skud taber fart i luften: ${shot.vy.toFixed(2)} m/s efter 0,5 s`);
  let drop = { x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0, curl: 0 }, bounced = 0;
  for (let i = 0; i < 40; i++) { drop = e11.stepBallPhysics(drop); bounced = Math.max(bounced, drop.vz); }
  assert(bounced > 2.5, `hop fra 3 m giver ${bounced.toFixed(2)} m/s opad (motor 10 dæmper ca. 73 %)`);
  let curled = { x: 0, y: 0, z: 1, vx: 0, vy: 25, vz: 3, curl: .8 };
  for (let i = 0; i < 40; i++) curled = e11.stepBallPhysics(curled);
  assert(curled.x !== 0, 'skruen bøjer banen');
  assert(Math.abs(curled.curl) < .8 * .5, 'skruen aftager');
});

test('afleveringsfarten vægtes efter afstanden og ankommer kontrollerbart', () => {
  for (const distance of [6, 10, 15, 20, 28, 35]) {
    const speed = e11.passSpeedFor(distance);
    let ball = { x: 0, y: 0, z: .22, vx: speed, vy: 0, vz: 0, curl: 0 };
    while (ball.x < distance && ball.vx > 0) ball = e11.stepBallPhysics(ball);
    assert(ball.x >= distance, `afleveringen på ${distance} m når frem`);
    assert(ball.vx >= 5.5 && ball.vx <= 13, `ankomstfart ${ball.vx.toFixed(1)} m/s på ${distance} m`);
  }
  assert(e11.passSpeedFor(10) < 19, 'kort aflevering er blødere end motor 10 (19 m/s)');
});

// --- Afleveringer og skud ----------------------------------------------------------------

function passFixture(seed, rating, pressure) {
  const s = e11.createArcade(seed, { homeRating: rating, awayRating: 60 });
  for (const team of ['home', 'away']) s[team].forEach((p, i) => Object.assign(p, { x: (i - 5) * 5, y: team === 'home' ? 30 : 40, vx: 0, vy: 0 }));
  const carrier = s.home[10], mate = s.home[8];
  Object.assign(carrier, { x: 0, y: 0, facingX: 0, facingY: -1, cooldown: 0 });
  Object.assign(mate, { x: 0, y: -20 });
  if (pressure) Object.assign(s.away[5], { x: 1.4, y: .4 });
  s.controlled = 10; s.freeze = 0; s.ball = { ...s.ball, owner: { team: 'home', index: 10 }, x: 0, y: -.6, protected: 5 };
  e11.stepArcade(s, e11.PASS | e11.directionMask(0, -1));
  return Math.abs(Math.atan2(s.ball.vx, -s.ball.vy));
}

test('afleveringer har en realistisk fejl, der vokser med pres og lavere rating', () => {
  const err = (rating, pressure) => mean(Array.from({ length: 40 }, (_, k) => passFixture(`pass-${rating}-${pressure}-${k}`, rating, pressure)));
  const good = err(90, false), weak = err(40, false), pressed = err(40, true);
  assert(good > 0, 'selv gode spillere rammer ikke perfekt');
  assert(weak > good * 1.5, `rating 40 (${weak.toFixed(4)}) er mindre præcis end rating 90 (${good.toFixed(4)})`);
  assert(pressed > weak * 1.2, `pres øger fejlen (${pressed.toFixed(4)} mod ${weak.toFixed(4)})`);
  assert(pressed < .12, 'fejlen holder sig realistisk (under ca. 7°)');
});

test('skudkvaliteten afspejler afstand, vinkel og blokerede skudlinjer', () => {
  const s = e11.createArcade('xg', { homeRating: 60, awayRating: 60 });
  s.away.forEach((p, i) => Object.assign(p, { x: i === 0 ? 0 : 25, y: i === 0 ? -45 : 0 }));
  const at = (x, y) => e11.shotQuality(s, 'home', { x, y });
  assert(at(0, -38) > at(0, -28), 'tættere på er bedre');
  assert(at(0, -36) > at(18, -36), 'centralt er bedre end fra en spids vinkel');
  const open = at(0, -30);
  Object.assign(s.away[5], { x: 0, y: -34 }); Object.assign(s.away[6], { x: .5, y: -36 });
  assert(at(0, -30) < open, 'forsvarere i skudlinjen sænker kvaliteten');
});

// --- Målmand -----------------------------------------------------------------------------

function keeperFixture(seed, ballX, ballY, ticks = 24) {
  const s = e11.createArcade(seed, { homeRating: 60, awayRating: 60 });
  for (const team of ['home', 'away']) s[team].forEach((p, i) => { if (i > 0) Object.assign(p, { x: (i - 5) * 4, y: -38, vx: 0, vy: 0 }); });
  Object.assign(s.away[0], { x: 0, y: -44 });
  s.freeze = 0; s.ball = { ...s.ball, owner: null, x: ballX, y: ballY, z: .22, vx: 0, vy: 0, vz: 0, protected: 0, shot: false };
  for (let i = 0; i < ticks; i++) e11.stepArcade(s, 0);
  return s;
}

test('målmanden står på halveringslinjen mellem bolden og målets midte', () => {
  for (const [x, y] of [[-14, 30], [14, 30], [-6, 22], [9, 26]]) {
    const s = keeperFixture(`bisector-${x}-${y}`, x, y), k = s.home[0];
    const ballAngle = Math.atan2(x, 48 - y), keeperAngle = Math.atan2(k.x, 48 - k.y);
    assert(Math.abs(ballAngle - keeperAngle) < .2, `bold (${x},${y}): målmand (${k.x.toFixed(2)},${k.y.toFixed(2)})`);
    assert(k.y > 42 && k.y < 46.7, 'målmanden står foran sin linje');
  }
});

function shotAtKeeper(seed, keeperRating, target, { speed = 30, start = { x: 0, y: 30 }, vz = 2.2 } = {}) {
  const s = e11.createArcade(seed, { homeRating: keeperRating, awayRating: 60 });
  for (const team of ['home', 'away']) s[team].forEach((p, i) => { if (i > 0) Object.assign(p, { x: (i - 5) * 4, y: -20, vx: 0, vy: 0 }); });
  const dx = target - start.x, dy = 48 - start.y, d = Math.hypot(dx, dy);
  s.home[0].x = 0; s.home[0].y = 44.6;
  s.freeze = 0; s.ball = { ...s.ball, owner: null, x: start.x, y: start.y, z: .4, vx: dx / d * speed, vy: dy / d * speed, vz, curl: 0, protected: 0, flight: 0,
    shot: true, shotId: 99, lastShooter: { team: 'away', index: 10 }, lastTeam: 'away', lastTouch: { team: 'away', index: 10 }, lastTouchTick: -50 };
  const trace = [];
  for (let i = 0; i < 30 && !s.goalSequence; i++) { e11.stepArcade(s, 0); trace.push({ x: s.home[0].x, dive: s.home[0].dive }); }
  return { goal: s.awayScore > 0, saved: s.stats.homeSaves > 0, trace };
}

test('målmanden reagerer først efter sin reaktionstid og dykker mod skuddet', () => {
  const { trace } = shotAtKeeper('reaction', 60, 3.2);
  assert.equal(trace[0].dive, 0, 'ingen reaktion i første tick');
  assert(Math.abs(trace[0].x) < .05, 'står stille, mens skuddet læses');
  const dive = trace.findIndex((t) => t.dive > 0);
  assert(dive >= 1 && dive <= 4, `dykker efter ${dive + 1} ticks`);
  assert(trace[dive + 3].x > .5, 'dykker mod skuddets side');
});

test('en bedre målmand redder flere skud', () => {
  // Net af 72 skud: 8 sigtepunkter × 3 skudhastigheder × 3 skudpositioner.
  const goals = (rating) => {
    let conceded = 0;
    for (const target of [-3.4, -2.8, -2.2, -1.6, 1.6, 2.2, 2.8, 3.4]) for (const speed of [26, 31, 36]) for (const x of [-8, 0, 8]) {
      if (shotAtKeeper(`grid-${rating}-${target}-${speed}-${x}`, rating, target, { speed, start: { x, y: 30 }, vz: 1.6 }).goal) conceded++;
    }
    return conceded;
  };
  const strong = goals(90), average = goals(60), weak = goals(35);
  assert(strong < average && average <= weak, `indkasserede mål af 72: rating 90 ${strong}, 60 ${average}, 35 ${weak}`);
  assert(strong > 0, 'ingen målmand er uovervindelig');
  assert(weak < 48, 'selv en svag målmand redder en del');
});

test('målmanden går ud mod en fri angriber', () => {
  const s = e11.createArcade('one-on-one', { homeRating: 60, awayRating: 60 });
  for (const team of ['home', 'away']) s[team].forEach((p, i) => { if (i > 0) Object.assign(p, { x: (i - 5) * 4, y: -20, vx: 0, vy: 0 }); });
  Object.assign(s.away[9], { x: 1, y: 34, facingX: 0, facingY: 1, decision: 40, cooldown: 40 });
  s.home[0].y = 45;
  s.freeze = 0; s.ball = { ...s.ball, owner: { team: 'away', index: 9 }, x: 1, y: 34.8, protected: 20 };
  let rushed = false;
  for (let i = 0; i < 10; i++) { e11.stepArcade(s, 0); rushed ||= s.home[0].role === 'rush'; }
  assert(rushed, 'målmanden skifter til at gå ud');
  assert(s.home[0].y < 44, `målmanden er kommet ud til y=${s.home[0].y.toFixed(2)} (startede på 45)`);
});

// --- Holdspil og balance -----------------------------------------------------------------

test('forsvaret står mere kompakt og i en mere lige kæde end i motor 10', () => {
  // Mål udeholdets (ren AI) form, mens hjemmeholdet har bolden, i en kamp styret af testspilleren.
  const compactness = (rules) => {
    const spreads = [], lines = [];
    const { tape } = playBotMatch(rules, 'shape', { homeRating: 60, awayRating: 60 });
    const s = rules.createArcade('shape', { homeRating: 60, awayRating: 60 });
    for (let i = 0; i < rules.INPUT_COUNT; i++) {
      rules.stepArcade(s, tape[i]);
      if (i % 5 || s.ball.owner?.team !== 'home' || s.goalSequence || s.freeze) continue;
      const ys = s.away.slice(1).map((p) => p.y);
      spreads.push(Math.max(...ys) - Math.min(...ys));
      const back = s.away.slice(1, 5).map((p) => p.y), avg = mean(back);
      lines.push(Math.sqrt(mean(back.map((y) => (y - avg) ** 2))));
    }
    return { spread: mean(spreads), line: mean(lines) };
  };
  const old = compactness(e10), now = compactness(e11);
  assert(now.spread < old.spread, `afstand bageste–forreste spiller: motor 11 ${now.spread.toFixed(1)} m, motor 10 ${old.spread.toFixed(1)} m`);
  assert(now.line < old.line, `forsvarskædens spredning: motor 11 ${now.line.toFixed(2)} m, motor 10 ${old.line.toFixed(2)} m`);
});

test('balance (computer mod computer): lige hold er lige, og det stærkere hold vinder oftere', () => {
  const even = aiSeries(60, 60, 40), strongHome = aiSeries(75, 50, 24), strongAway = aiSeries(50, 75, 24);
  const goals = (r) => (r.home + r.away) / r.matches;
  for (const r of [even, strongHome, strongAway]) {
    assert(goals(r) > .8 && goals(r) < 4.5, `mål pr. kamp ${goals(r).toFixed(2)}`);
    assert(r.shots / r.matches > 8, `skud pr. kamp ${(r.shots / r.matches).toFixed(1)}`);
    const pct = r.completed / r.passes;
    assert(pct > .65 && pct < .9, `afleveringsprocent ${(pct * 100).toFixed(1)}`);
  }
  assert(Math.abs(even.home - even.away) / even.matches < .45, `lige hold: ${even.home}–${even.away}`);
  assert(strongHome.homeWins > strongHome.awayWins && strongHome.home > strongHome.away, `75 mod 50: sejre ${strongHome.homeWins}–${strongHome.awayWins}`);
  assert(strongAway.awayWins > strongAway.homeWins && strongAway.away > strongAway.home, `50 mod 75: sejre ${strongAway.homeWins}–${strongAway.awayWins}`);
});

test('balance (testspiller mod computer): realistiske afslutninger og flere skud end motor 10', () => {
  const now = simulate(e11, { matches: 16, prefix: 'balance-11' });
  const old = simulate(e10, { matches: 16, prefix: 'balance-11' });
  assert(now.goalsPerMatch > 1 && now.goalsPerMatch < 5, `mål pr. kamp ${now.goalsPerMatch}`);
  assert(now.conversionPct > 6 && now.conversionPct < 30, `scoringsprocent ${now.conversionPct}`);
  assert(now.savePct > 55 && now.savePct < 90, `redningsprocent ${now.savePct}`);
  assert(now.shotsPerMatch > old.shotsPerMatch, `skud pr. kamp: motor 11 ${now.shotsPerMatch}, motor 10 ${old.shotsPerMatch}`);
  assert(now.passesPerMatch < old.passesPerMatch, `færre sidelæns afleveringer: ${now.passesPerMatch} mod ${old.passesPerMatch}`);
});

test('motor 11 kan genafspilles inden for serverens tidsramme', () => {
  const config = { homeRating: 60, awayRating: 60, matchVersion: 11 };
  const { tape } = playBotMatch(e11, 'speed', config);
  const started = performance.now();
  replayArcade('speed', config, tape);
  const ms = performance.now() - started;
  assert(ms < 2500, `genafspilning tog ${Math.round(ms)} ms`);
});
