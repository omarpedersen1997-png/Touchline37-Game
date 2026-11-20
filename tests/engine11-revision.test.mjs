import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as revision1 from '../shared/football-engine11.js';
import * as revision2 from '../shared/football-engine11-r2.js';
import { createArcade, stepArcade, replayArcade, getArcadeRules, encodeInputs, decodeInputs } from '../shared/arcade.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const ORIGINAL_ENGINE11_SHA256 = '9ba865541483c7aebefa9c4daec312b54148c045348f1cfe810b950969721cf6';
const GOLDENS = [
  { seed: 'engine11-frozen-r1-quiet', variant: 0,
    config: { homeRating: 60, awayRating: 60, matchVersion: 11 }, home: 0, away: 1,
    sha256: '53ed35d294905d8f20c7b8b2918c4d802c973cdf4c0177c7dc112c7639395abd' },
  { seed: 'engine11-frozen-r1-active', variant: 1,
    config: { homeRating: 62, awayRating: 58, tactic: 'attacking', personalPosition: 'MID', matchVersion: 11 }, home: 0, away: 5,
    sha256: '6323d6f223fac3ea08c8830b266c6157e39d4bec3d4c6b670538c91c7bb829a2' },
];

function tape(variant = 1) {
  let x = 0x1234abcd;
  return Uint16Array.from({ length: revision1.INPUT_COUNT }, (_, i) => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    if (variant === 0) return 0;
    const raw = x & 0x7fff;
    return revision1.validateMask(raw) ? raw : revision1.directionMask(Math.sin(i * .017), Math.cos(i * .023))
      | (i % 53 === 0 ? revision1.PASS : 0) | (i % 79 === 0 ? revision1.SHOOT : 0);
  });
}

function duel(rules, seed = 'poke-17', { contact = false, defender = 85, carrier = 50 } = {}) {
  const state = rules.createArcade(seed, { homeRating: defender, awayRating: carrier });
  state.home.forEach((p, i) => { if (i > 0 && i !== 3) Object.assign(p, { x: -26 + i, y: -40, vx: 0, vy: 0 }); });
  state.away.forEach((p, i) => { if (i > 0 && i !== 5) Object.assign(p, { x: 26 - i, y: -40, vx: 0, vy: 0 }); });
  state.controlled = 10; state.freeze = 0;
  Object.assign(state.away[5], { x: 0, y: 10, vx: 0, vy: 1.5, facingX: 0, facingY: 1, decision: 60, cooldown: 60 });
  Object.assign(state.home[3], { x: contact ? 0 : .3, y: contact ? 11.16 : 11.6, vx: 0, vy: 0, cooldown: contact ? 17 : 0,
    ...(contact ? { facingX: 0, facingY: -1, tackle: 7, pendingTackle: { manual: false, started: -1, resolved: false } } : {}) });
  state.ball = { ...state.ball, owner: { team: 'away', index: 5 }, x: 0, y: 10.7, protected: 0 };
  return state;
}

const foot = (p, rules) => ({ x: p.x + p.facingX * rules.CONTACT.autoOffset, y: p.y + p.facingY * rules.CONTACT.autoOffset });
function footGapAtContact(before, after, contact, rules) {
  const a = foot(before, rules), b = foot(after, rules), t = contact.time;
  return Math.hypot(contact.x - (a.x + (b.x - a.x) * t), contact.y - (a.y + (b.y - a.y) * t));
}

test('original motor 11 er byte-frosset før revision 2', () => {
  assert.equal(sha256(readFileSync(new URL('../shared/football-engine11.js', import.meta.url))), ORIGINAL_ENGINE11_SHA256);
});

test('revision vælges eksplicit, og fravær af revisionsmetadata beholder original motor 11', () => {
  assert.equal(getArcadeRules(11), revision1);
  assert.equal(getArcadeRules(11, 1), revision1);
  assert.equal(getArcadeRules(11, 2), revision2);
  const legacy = createArcade('revision-default', { matchVersion: 11 });
  assert.equal(legacy.engineRevision, undefined, 'gammel tilstandsform må ikke få nye felter');
  const fresh = createArcade('revision-default', { matchVersion: 11, engineRevision: 2 });
  assert.equal(fresh.version, 11); assert.equal(fresh.engineRevision, 2);
  assert.equal(revision2.createArcade('direct-module').engineRevision, 2, 'direkte oprettelse skal også være mærket');
  assert.equal(getArcadeRules(10, 2), getArcadeRules(10), 'eksisterende versioner skifter aldrig motor via revisionsfeltet');
});

test('revision 2 beholder varighed, inputprotokol og alle AI-/kontaktkonstanter', () => {
  for (const name of ['ARCADE_VERSION', 'STEP_MS', 'INPUT_MS', 'INPUT_COUNT', 'DURATION_MS', 'HALF_MS', 'HALFTIME_MS', 'PLAY_MS',
    'SHOOT', 'PASS', 'SPRINT', 'SHOOT_HELD', 'PASS_HELD', 'SKILL', 'THROUGH']) assert.equal(revision2[name], revision1[name], name);
  for (const name of ['FIELD', 'CONTACT', 'ENGINE', 'GOAL_TIMING', 'DIRECTIONS', 'TACTICS', 'FORMATIONS', 'TACTICAL_COMMANDS'])
    assert.deepEqual(revision2[name], revision1[name], name);
  const recorded = tape();
  assert.deepEqual(revision2.decodeInputs(revision1.encodeInputs(recorded)), recorded);
  assert.deepEqual(decodeInputs(encodeInputs(recorded, 11), 11), recorded);
});

test('gemte motor 11-replays bevarer hele den oprindelige tilstand og stilling', () => {
  for (const fixture of GOLDENS) {
    const inputs = tape(fixture.variant);
    for (const config of [fixture.config, { ...fixture.config, engineRevision: 1 }]) {
      const result = replayArcade(fixture.seed, config, inputs);
      assert.equal(result.homeScore, fixture.home); assert.equal(result.awayScore, fixture.away);
      assert.equal(sha256(JSON.stringify(result)), fixture.sha256, fixture.seed);
    }
  }
});

test('revision 2 kan genafspilles og genoptages deterministisk via dispatcher og direkte modul', () => {
  const config = { ...GOLDENS[1].config, engineRevision: 2 }, inputs = tape();
  const direct = revision2.replayArcade('revision2-replay', config, inputs);
  const replay = replayArcade('revision2-replay', config, inputs);
  let incremental = createArcade('revision2-replay', config);
  for (let i = 0; i < inputs.length; i++) {
    if (i === 2500) incremental = JSON.parse(JSON.stringify(incremental));
    stepArcade(incremental, inputs[i]);
  }
  assert.equal(direct.engineRevision, 2); assert.equal(direct.tick, revision2.INPUT_COUNT);
  assert.deepEqual(replay, direct); assert.deepEqual(incremental, direct);
  assert.deepEqual(replayArcade('revision2-replay', config, inputs), direct);
});

test('ukendte motor 11-revisioner afvises før tilstanden kan ændres', () => {
  for (const revision of [0, 3, -1, '2', null, NaN, 1.5]) {
    assert.throws(() => getArcadeRules(11, revision), /revisionen understøttes ikke/);
    assert.throws(() => createArcade('invalid', { matchVersion: 11, engineRevision: revision }), /revisionen understøttes ikke/);
    assert.throws(() => replayArcade('invalid', { matchVersion: 11, engineRevision: revision }, []), /revisionen understøttes ikke/);
    const state = revision1.createArcade('invalid'); state.engineRevision = revision;
    assert.throws(() => stepArcade(state, 0), /revisionen understøttes ikke/);
    assert.equal(state.tick, 0);
  }
});

test('poke-17 giver stadig den oprindelige R1-fejl, mens R2 ikke tilskriver fjernkontakt', () => {
  const old = duel(revision1), fresh = duel(revision2);
  let originalGap = null, originalSweep;
  for (let i = 0; i < 24; i++) {
    const previousOld = { ...old.home[3] }, previousFresh = { ...fresh.home[3] }, previousBall = { ...old.ball };
    revision1.stepArcade(old, 0); revision2.stepArcade(fresh, 0);
    if (old.lastContact?.tick === old.tick && old.lastContact.kind === 'tackle') {
      const end = foot(old.home[3], revision1);
      originalGap = Math.hypot(old.lastContact.x - end.x, old.lastContact.y - end.y);
      originalSweep = revision1.sweptContact(previousBall, old.lastContact, foot(previousOld, revision1), end, revision1.CONTACT.autoRadius, revision1.CONTACT.footHeight);
    }
    if (fresh.lastContact?.tick === fresh.tick && fresh.lastContact.kind === 'tackle') {
      assert(footGapAtContact(previousFresh, fresh.home[3], fresh.lastContact, revision2) <= revision2.CONTACT.autoRadius + .0002);
    }
    if (fresh.tick === 20) assert.notEqual(fresh.lastContact?.tick, 20, 'det dokumenterede fjerne ben må ikke tage bolden');
  }
  assert(originalGap > 1.3, 'den gamle replayadfærd skal bevares, også når den indeholder den kendte fejl');
  assert.equal(originalSweep, null);
  assert.equal(fresh.stats.homeTackles, 0);
});

test('en automatisk duel med rigtig fodkontakt kan stadig poke bolden fri', () => {
  const state = duel(revision2, 'contact-2', { contact: true });
  const before = { ...state.home[3] };
  revision2.stepArcade(state, 0);
  assert.equal(state.stats.homeTackles, 1); assert.equal(state.lastContact.kind, 'tackle');
  assert.equal(state.lastContact.manual, false); assert.equal(state.lastAction.contact, true);
  assert(footGapAtContact(before, state.home[3], state.lastContact, revision2) <= revision2.CONTACT.autoRadius + .0002);
  assert.equal(state.ball.owner, null, 'en takling må ikke give fjern-ejerskab');
});

test('duelchancen bevares inden for kontaktområdet og er hverken automatisk eller umulig', () => {
  const wins = (defender, carrier) => {
    let won = 0;
    for (let k = 0; k < 40; k++) {
      const state = duel(revision2, 'contact-duel-' + k, { contact: true, defender, carrier });
      const before = { ...state.home[3] };
      revision2.stepArcade(state, 0);
      if (state.stats.homeTackles) {
        won++;
        assert(footGapAtContact(before, state.home[3], state.lastContact, revision2) <= revision2.CONTACT.autoRadius + .0002);
      }
    }
    return won;
  };
  const strong = wins(85, 50), weak = wins(45, 80);
  assert(strong > weak); assert(strong < 40); assert(weak > 0);
});

test('målmandens smother kræver fysisk håndkontakt og virker stadig ved reel kontakt', () => {
  const fixture = (rules, x) => {
    const state = rules.createArcade('keeper-contact-2', { homeRating: 85, awayRating: 50 });
    state.home.forEach((p, i) => { if (i > 0) Object.assign(p, { x: -26 + i, y: -40, vx: 0, vy: 0 }); });
    state.away.forEach((p, i) => { if (i > 0 && i !== 9) Object.assign(p, { x: 26 - i, y: -40, vx: 0, vy: 0 }); });
    state.freeze = 0; state.controlled = 10;
    Object.assign(state.away[9], { x, y: 42.5, vx: 0, vy: 1.5, facingX: 0, facingY: 1, decision: 60, cooldown: 60 });
    Object.assign(state.home[0], { x: 0, y: 44, vx: 0, vy: 0, facingX: 0, facingY: -1, cooldown: 8, tackle: 7,
      pendingTackle: { manual: false, started: -1, resolved: false } });
    state.ball = { ...state.ball, owner: { team: 'away', index: 9 }, x, y: x ? 43 : 43.2, protected: 0 };
    return state;
  };
  const oldFar = fixture(revision1, 1.2), far = fixture(revision2, 1.2), touching = fixture(revision2, 0);
  const previous = { ...touching.home[0] };
  revision1.stepArcade(oldFar, 0); revision2.stepArcade(far, 0); revision2.stepArcade(touching, 0);
  assert.equal(oldFar.lastContact.kind, 'save', 'den gamle fjern-redning forbliver tilgængelig for gamle replays');
  assert.equal(far.lastContact, undefined); assert.equal(far.ball.owner.team, 'away');
  assert.equal(touching.lastContact.kind, 'save'); assert.deepEqual(touching.ball.owner, { team: 'home', index: 0 });
  const current = touching.home[0], t = touching.lastContact.time;
  const handX = previous.x + previous.facingX * .18 + ((current.x + current.facingX * .18) - (previous.x + previous.facingX * .18)) * t;
  const handY = previous.y + previous.facingY * .18 + ((current.y + current.facingY * .18) - (previous.y + previous.facingY * .18)) * t;
  assert(Math.hypot(touching.lastContact.x - handX, touching.lastContact.y - handY) <= .6502);
});
