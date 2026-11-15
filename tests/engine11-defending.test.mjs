// Kampmotor 11, M5 del 2: taklinger, boldkontrol, pres, målmandens greb i fødderne og
// rettelsen af "dribl bolden i mål"-svagheden. Alle forsøg bruger faste seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as e10 from '../shared/football-goals.js';
import * as e11 from '../shared/football-engine11.js';
import { createBot } from './support/match-bot.mjs';

function clearPitch(s, keepHome = [], keepAway = []) {
  s.home.forEach((p, i) => { if (i > 0 && !keepHome.includes(i)) Object.assign(p, { x: -26 + i, y: -40, vx: 0, vy: 0 }); });
  s.away.forEach((p, i) => { if (i > 0 && !keepAway.includes(i)) Object.assign(p, { x: 26 - i, y: -40, vx: 0, vy: 0 }); });
  s.controlled = 10; s.freeze = 0;
}

function duel(seed, defenderRating, carrierRating) {
  const s = e11.createArcade(seed, { homeRating: defenderRating, awayRating: carrierRating });
  clearPitch(s, [3], [5]);
  Object.assign(s.away[5], { x: 0, y: 10, vx: 0, vy: 1.5, facingX: 0, facingY: 1, decision: 60, cooldown: 60 });
  Object.assign(s.home[3], { x: .3, y: 11.6, vx: 0, vy: 0, cooldown: 0 });
  s.ball = { ...s.ball, owner: { team: 'away', index: 5 }, x: 0, y: 10.7, protected: 0 };
  for (let i = 0; i < 24; i++) {
    e11.stepArcade(s, 0);
    if (s.stats.homeTackles > 0) {
      const tackler = s.home[3];
      return { won: true, distance: Math.hypot(s.ball.x - tackler.x, s.ball.y - tackler.y) };
    }
  }
  return { won: false };
}

test('computerens takling er en deterministisk duel, som rating påvirker', () => {
  const rate = (d, c) => Array.from({ length: 40 }, (_, k) => duel(`duel-${d}-${c}-${k}`, d, c)).filter((r) => r.won).length;
  const strong = rate(85, 50), weak = rate(45, 80);
  assert(strong > weak, `stærk forsvarer vinder ${strong}/40, svag forsvarer ${weak}/40`);
  assert(strong < 40, 'selv en stærk forsvarer vinder ikke altid');
  assert(weak > 0, 'selv en svag forsvarer vinder nogle gange');
  assert.deepEqual(duel('same', 60, 60), duel('same', 60, 60), 'samme seed giver samme duel');
});

test('en vundet takling efterlader bolden nær forsvareren (naturlig erobring)', () => {
  const wins = Array.from({ length: 40 }, (_, k) => duel(`poke-${k}`, 85, 50)).filter((r) => r.won);
  assert(wins.length > 0);
  for (const r of wins) assert(r.distance < 2.5, `bolden ligger ${r.distance.toFixed(2)} m fra forsvareren`);
});

test('boldholderen skærmer bolden væk fra en nærgående modstander', () => {
  const s = e11.createArcade('shield', { homeRating: 60, awayRating: 80 });
  clearPitch(s, [3], [5]);
  Object.assign(s.away[5], { x: 0, y: 0, vx: 0, vy: 4, facingX: 0, facingY: 1, decision: 60, cooldown: 60 });
  Object.assign(s.home[3], { x: 1.6, y: .8, vx: 0, vy: 0, cooldown: 60 });
  s.ball = { ...s.ball, owner: { team: 'away', index: 5 }, x: 0, y: .6, protected: 30 };
  for (let i = 0; i < 6; i++) e11.stepArcade(s, 0);
  const carrier = s.away[5];
  assert(s.ball.x < carrier.x, `bolden (${s.ball.x.toFixed(2)}) ligger på den side, der vender væk fra forsvareren (${carrier.x.toFixed(2)})`);
});

test('computerspillere kan sprinte efter en løs bold (motor 10: aldrig)', () => {
  const top = (rules) => {
    const s = rules.createArcade('sprint', { homeRating: 60, awayRating: 60 });
    clearPitch(s, [6], []);
    Object.assign(s.home[6], { x: 0, y: 20, vx: 0, vy: 0 });
    s.ball = { ...s.ball, owner: null, x: 0, y: -10, z: .22, vx: 0, vy: 0, vz: 0, protected: 0, lastTeam: 'away', lastTouch: { team: 'away', index: 9 } };
    let best = 0;
    for (let i = 0; i < 40; i++) { rules.stepArcade(s, 0); best = Math.max(best, Math.hypot(s.home[6].vx, s.home[6].vy)); }
    return best;
  };
  const base = 6.25 + 60 * .021;
  assert(top(e10) <= base + .05, `motor 10 løber højst ${top(e10).toFixed(2)} m/s`);
  assert(top(e11) > base * 1.1, `motor 11 sprinter ${top(e11).toFixed(2)} m/s (grundfart ${base.toFixed(2)})`);
});

function blockFixture(rules) {
  const s = rules.createArcade('block', { homeRating: 60, awayRating: 60 });
  clearPitch(s, [4], [9]);
  Object.assign(s.away[9], { x: 0, y: 30, vx: 0, vy: 0 });
  Object.assign(s.home[4], { x: .55, y: 33, vx: 0, vy: 0, cooldown: 60 });
  s.home[0].x = 4; s.home[0].y = 46;
  s.ball = { ...s.ball, owner: null, x: 0, y: 30.8, z: .5, vx: 0, vy: 30, vz: 1.2, curl: 0, protected: 0, flight: 0, shot: true, shotId: 7,
    lastShooter: { team: 'away', index: 9 }, lastTeam: 'away', lastTouch: { team: 'away', index: 9 }, lastTouchTick: -50 };
  for (let i = 0; i < 6; i++) { rules.stepArcade(s, 0); if (s.lastContact?.kind === 'block') return true; }
  return false;
}

test('en forsvarer tæt på skytten blokerer bredere med ben og krop', () => {
  assert.equal(blockFixture(e10), false, 'motor 10: skuddet går forbi 0,55 m fra forsvarerens midte');
  assert.equal(blockFixture(e11), true, 'motor 11: skuddet blokeres');
});

test('målmanden tager bolden fra en dribler i feltet', () => {
  let saved = 0;
  for (let k = 0; k < 30; k++) {
    const s = e11.createArcade(`smother-${k}`, { homeRating: 60, awayRating: 60 });
    clearPitch(s, [], [9]);
    Object.assign(s.away[9], { x: (k % 5) - 2, y: 39, vx: 0, vy: 5, facingX: 0, facingY: 1, decision: 80, cooldown: 80 });
    s.home[0].x = 0; s.home[0].y = 45;
    s.ball = { ...s.ball, owner: { team: 'away', index: 9 }, x: s.away[9].x, y: 39.7, protected: 0 };
    for (let i = 0; i < 40 && !s.goalSequence; i++) e11.stepArcade(s, 0);
    if (s.awayScore === 0) saved++;
  }
  assert(saved >= 18, `målmanden forhindrer ${saved}/30 driblinger i mål`);
});

test('"dribl bolden i mål" er markant sværere end i motor 10', () => {
  const goalsWithoutShooting = (rules) => {
    let goals = 0;
    for (let k = 0; k < 8; k++) {
      const s = rules.createArcade(`noshoot-${k}`, { homeRating: 60, awayRating: 60 });
      const bot = createBot(rules, { seed: k + 1 });
      for (let i = 0; i < rules.INPUT_COUNT; i++) {
        let mask = bot(s);
        if (s.ball.owner?.team === 'home' && s.ball.owner.index === s.controlled) mask &= ~(rules.SHOOT | rules.SHOOT_HELD);
        rules.stepArcade(s, mask);
      }
      goals += s.homeScore;
    }
    return goals / 8;
  };
  const old = goalsWithoutShooting(e10), now = goalsWithoutShooting(e11);
  assert(now < old * .6, `mål pr. kamp uden et eneste skud: motor 11 ${now.toFixed(2)}, motor 10 ${old.toFixed(2)}`);
});
