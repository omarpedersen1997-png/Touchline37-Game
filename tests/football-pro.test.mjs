import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../shared/football-pro.js';
import * as previous from '../shared/football-spaced.js';

const { createArcade, stepArcade, directionMask, SHOOT, PASS, THROUGH, SPRINT, SHOOT_HELD, PASS_HELD, SKILL, INPUT_COUNT } = game;
const recording = () => Uint16Array.from({ length: INPUT_COUNT }, (_, i) => directionMask(Math.sin(i * .04), -Math.cos(i * .04)) | (i % 31 === 0 ? SHOOT : 0) | (i % 27 === 0 ? PASS : 0) | (i % 137 === 0 ? THROUGH : 0) | (i % 17 < 5 ? SPRINT : 0));
function quiet(s) {
  for (const team of ['home', 'away']) s[team].forEach((p, i) => { Object.assign(p, { x: 24 + i % 3, y: 20 + i, vx: 0, vy: 0, cooldown: 200 }); });
}
function shootingSetup() {
  const s = createArcade('shot', { personalPosition: 'ANG', technique: 85 }); quiet(s);
  Object.assign(s.home[10], { x: -10, y: -25, cooldown: 0, facingX: 0, facingY: -1 });
  Object.assign(s.ball, { x: -10, y: -25.7 });
  return s;
}
function passSetup() {
  const s = createArcade('pass', { personalPosition: 'ANG' }); quiet(s);
  Object.assign(s.home[10], { x: 0, y: 0, cooldown: 0, facingX: 0, facingY: -1 });
  Object.assign(s.home[8], { x: 0, y: -17, vx: 0, vy: -4, cooldown: 0 });
  Object.assign(s.home[9], { x: 15, y: -10, cooldown: 0 });
  Object.assign(s.ball, { x: 0, y: -.7 });
  return s;
}

test('v5 keeps the 60-second 20Hz packet, adds through passes, and reserves the high bit', () => {
  assert.equal(game.ARCADE_VERSION, 5); assert.equal(game.STEP_MS, 50); assert.equal(INPUT_COUNT, 1200);
  const inputs = recording(); inputs[0] = directionMask(1, 1) | SHOOT | PASS | SPRINT | SHOOT_HELD | PASS_HELD | SKILL | THROUGH;
  const encoded = game.encodeInputs(inputs);
  assert.equal(encoded.length, 3200); assert.deepEqual(game.decodeInputs(encoded), inputs);
  for (const direction of Array.from({ length: 32 }, (_, i) => i + 1)) for (const magnitude of [1, 2, 3]) assert(game.validateMask(direction | magnitude << 6 | THROUGH));
  assert(game.validateMask(THROUGH)); assert(!previous.validateMask(THROUGH));
  for (const mask of [-1, 32768, 65535, 33, 1, 64, 1.5, NaN]) assert(!game.validateMask(mask), String(mask));
  const reserved = new Uint8Array(2400); reserved[1] = 128;
  assert.throws(() => game.decodeInputs(btoa(String.fromCharCode(...reserved))));
  for (const packet of [encoded + 'A', encoded.slice(1), '!'.repeat(3200)]) assert.throws(() => game.decodeInputs(packet));
  assert.throws(() => game.encodeInputs([0]));
});

test('full v5 replay reproduces every state field without changing the previous engine', () => {
  const inputs = recording(), config = { formation: '4-4-2', personalPosition: 'MID', tactic: 'attacking' }, live = createArcade('replay-v5', config);
  for (const mask of inputs) stepArcade(live, mask);
  assert.deepEqual(game.replayArcade('replay-v5', config, game.decodeInputs(game.encodeInputs(inputs))), live);
  assert.equal(live.tick, 1200); assert.equal(live.version, 5); assert.equal(previous.createArcade('old').version, 4);
  const finished = structuredClone(live); stepArcade(live, 0); assert.deepEqual(live, finished);
});

test('analog movement accelerates, brakes, and turns with momentum; sprint uses fitness', () => {
  const slow = createArcade('move', { personalPosition: 'ANG', fitness: 70 }), fast = createArcade('move', { personalPosition: 'ANG', fitness: 70 });
  for (let tick = 0; tick < 20; tick++) { stepArcade(slow, directionMask(.2, 0)); stepArcade(fast, directionMask(1, 0) | SPRINT); }
  assert(fast.home[10].x > slow.home[10].x + 3); assert(fast.home[10].energy < slow.home[10].energy);
  const p = fast.home[10], before = p.vx; stepArcade(fast, directionMask(-1, 0));
  assert(p.vx > 0 && p.vx < before);
  for (let tick = 0; tick < 10; tick++) stepArcade(fast, 0);
  assert(Math.abs(p.vx) < .01);
});

test('teammates offer separate support lanes and defenders assign one presser', () => {
  const support = createArcade('support'); support.ball.protected = 200;
  for (let tick = 0; tick < 20; tick++) stepArcade(support, 0);
  assert.equal(support.phase.home, 'possession');
  assert.equal(support.home.filter(p => p.role === 'run').length, 2);
  assert(support.home.filter(p => p.role === 'support').length >= 6);
  assert(support.home.filter(p => !p.keeper && Math.hypot(p.x - support.ball.x, p.y - support.ball.y) > 8).length >= 7);
  const defending = createArcade('marking');
  Object.assign(defending.home[10],{x:20,y:30});
  Object.assign(defending.away[10], { x: 0, y: 0, cooldown: 200 });
  Object.assign(defending.ball, { owner: { team: 'away', index: 10 }, x: 0, y: 0, protected: 200 });
  stepArcade(defending, 0);
  assert.equal(defending.home.filter(p => p.role === 'press').length, 1);
  assert.equal(defending.home.filter(p => p.role === 'mark').length, 8);
  assert(defending.home.filter(p => p.role === 'mark' && Math.hypot(p.x - defending.ball.x, p.y - defending.ball.y) > 6).length >= 6);
});

test('directional pass assistance chooses the open lane instead of the obstructed runner', () => {
  const s = passSetup(); Object.assign(s.home[9], { x: 7, y: -17 }); Object.assign(s.away[2], { x: 0, y: -8 });
  assert.equal(game.passTarget(s, 'home', 10, directionMask(0, -1)), 9);
  assert.equal(game.passTarget(s, 'home', 10, directionMask(1, 0)), 9);
});

test('ground, lofted, and through passes release toward different receiving spaces', () => {
  const ground = passSetup(), loft = passSetup(), through = passSetup();
  stepArcade(ground, PASS | directionMask(0, -1));
  for (let tick = 0; tick < 10; tick++) stepArcade(loft, PASS_HELD);
  stepArcade(loft, PASS | directionMask(0, -1));
  stepArcade(through, THROUGH | directionMask(0, -1));
  assert.equal(ground.lastAction.kind, 'pass'); assert.equal(loft.lastAction.kind, 'loft'); assert.equal(through.lastAction.kind, 'through');
  assert(loft.ball.z > ground.ball.z + .15);
  assert(through.ball.receivePoint.y < ground.ball.receivePoint.y - 4);
  assert.equal(through.ball.passTarget.index, 8); assert.equal(through.home[8].role, 'receive');
  assert.equal(ground.home[10].action, 'kick'); assert(ground.home[10].kick > 0);
});

test('completed personal passes count once and first touches keep the ball at a moving foot', () => {
  const s = passSetup(); stepArcade(s, PASS | directionMask(0, -1));
  for (let tick = 0; tick < 50 && !s.ball.owner; tick++) stepArcade(s, 0);
  assert.deepEqual(s.ball.owner, { team: 'home', index: 8 }); assert.equal(s.controlled, 10);
  assert.equal(s.stats.userPassAttempts, 1); assert.equal(s.stats.userPasses, 1); assert.equal(s.stats.completedPasses, 1);
  assert.equal(s.home[8].action, 'receive'); assert(s.home[8].touch > 0);
  assert(Math.hypot(s.ball.x - s.home[8].x, s.ball.y - s.home[8].y) < 1.6);
  for (let tick = 0; tick < 3; tick++) stepArcade(s, 0);
  assert.equal(s.stats.userPasses, 1);
});

test('charging alone retains possession and shot release changes power and visible follow-through', () => {
  const quick = shootingSetup(), charged = shootingSetup();
  stepArcade(quick, SHOOT | directionMask(0, -1));
  for (let tick = 0; tick < 18; tick++) stepArcade(charged, SHOOT_HELD);
  assert.equal(charged.stats.homeShots, 0); assert.equal(charged.shotCharge, 18); assert(charged.ball.owner);
  stepArcade(charged, SHOOT | directionMask(0, -1));
  assert(charged.lastAction.power > quick.lastAction.power);
  assert(Math.hypot(charged.ball.vx, charged.ball.vy) > Math.hypot(quick.ball.vx, quick.ball.vy) + 8);
  assert.equal(charged.home[10].action, 'kick'); assert.equal(charged.home[10].kick, 10); assert.equal(charged.stats.homeShots, 1);
  for (let tick = 0; tick < 35 && !charged.homeScore; tick++) stepArcade(charged, 0);
  assert.equal(charged.homeScore, 1); assert.equal(charged.stats.userGoals, 1);
});

test('goalkeepers anticipate an incoming trajectory, dive, and parry a driven shot into live play', () => {
  const s = createArcade('keeper'); quiet(s);
  Object.assign(s.away[0], { x: 0, y: -44.2, cooldown: 0 });
  Object.assign(s.ball, { owner: null, x: -5, y: -30, z: 1, vx: 7, vy: -31, vz: 2, protected: 0, shot: true, shotId: 1, lastShooter: { team: 'home', index: 10 } });
  stepArcade(s, 0); assert(s.away[0].dive > 0); assert(s.away[0].x < 0);
  for (let tick = 0; tick < 11; tick++) stepArcade(s, 0);
  assert.equal(s.stats.awaySaves, 1); assert.equal(s.homeScore, 0); assert.equal(s.ball.owner, null);
  assert.equal(s.ball.lastTeam, 'away'); assert(s.ball.vy > 0); assert.equal(s.freeze, 0);
  for (let tick = 0; tick < 5; tick++) stepArcade(s, 0);
  assert.equal(s.stats.awaySaves, 1);
});

test('a personal goalkeeper catches a low shot, earns one save, and stays position-locked', () => {
  const s = createArcade('personal-save', { personalPosition: 'MÅL' }); quiet(s);
  Object.assign(s.home[0], { x: 0, y: 44, cooldown: 0 });
  Object.assign(s.ball, { owner: null, x: 0, y: 37, z: .5, vx: 0, vy: 18, vz: 1, protected: 0, shot: true, shotId: 3, lastShooter: { team: 'away', index: 10 } });
  for (let tick = 0; tick < 12; tick++) stepArcade(s, 0);
  assert.deepEqual(s.ball.owner, { team: 'home', index: 0 }); assert.equal(s.stats.userSaves, 1); assert.equal(s.controlled, 0);
  stepArcade(s, PASS); assert.equal(s.controlled, 0); assert.equal(s.stats.userSaves, 1);
});

test('manual goalkeeper dives have a direction and a short movement animation', () => {
  const s = createArcade('manual-dive', { personalPosition: 'MÅL' });
  s.ball.owner = { team: 'away', index: 10 }; const p = s.home[0], start = p.x;
  stepArcade(s, SHOOT | directionMask(1, 0)); assert.equal(p.action, 'dive'); assert(p.diveX > .9);
  for (let tick = 0; tick < 4; tick++) stepArcade(s, 0);
  assert(p.x > start + .5); assert(p.dive > 0); assert(p.energy < 100);
});

test('a tackle shows its lunge even on a miss and held buttons cannot repeat it', () => {
  const s = createArcade('miss', { personalPosition: 'ANG' });
  s.ball.owner = { team: 'away', index: 10 }; s.ball.x = 20; s.ball.y = 20;
  stepArcade(s, SHOOT); assert.equal(s.home[10].action, 'tackle'); assert.equal(s.home[10].tackle, 9);
  const energy = s.home[10].energy;
  for (let tick = 0; tick < 3; tick++) stepArcade(s, SHOOT);
  assert.equal(s.home[10].tackle, 6); assert(s.home[10].energy > energy); assert.equal(s.stats.userTackles, 0);
});

test('touchlines and the last touch award throw-ins, corners and goal kicks with dead-ball pauses', () => {
  const thrown = createArcade('throw'); Object.assign(thrown.ball, { owner: null, x: 29.9, y: 0, vx: 12, vy: 0, protected: 20, lastTeam: 'home' });
  stepArcade(thrown, 0); assert.equal(thrown.restart.kind, 'throw-in'); assert.equal(thrown.ball.owner.team, 'away'); assert.equal(thrown.freeze, 10);
  for (const [lastTeam, kind, team] of [['away', 'corner', 'home'], ['home', 'goal-kick', 'away']]) {
    const s = createArcade(kind); Object.assign(s.ball, { owner: null, x: 15, y: -47.9, z: 3, vx: 0, vy: -20, protected: 20, lastTeam });
    stepArcade(s, 0); assert.equal(s.restart.kind, kind); assert.equal(s.ball.owner.team, team);
  }
});

test('goals use height at the goal line and shots rebound from the frame', () => {
  const over = createArcade('over'); Object.assign(over.ball, { owner: null, x: 0, y: -47.9, z: 2.8, vx: 0, vy: -20, vz: -20, protected: 20 });
  stepArcade(over, 0); assert.equal(over.homeScore, 0); assert.equal(over.restart.kind, 'goal-kick');
  const post = createArcade('post'); Object.assign(post.ball, { owner: null, x: 3.95, y: -47.7, z: 1, vx: 0, vy: -20, vz: 0, protected: 20 });
  stepArcade(post, 0); assert.equal(post.homeScore, 0); assert.equal(post.lastAction.kind, 'woodwork'); assert(post.ball.vy > 0); assert.equal(post.freeze, 0);
  const goal = createArcade('goal', { personalPosition: 'MID' });
  Object.assign(goal.ball, { owner: null, x: 0, y: -47.9, z: .4, vx: 0, vy: -20, protected: 20, lastShooter: { team: 'home', index: 10 }, assist: { team: 'home', index: 6 } });
  stepArcade(goal, 0); assert.equal(goal.homeScore, 1); assert.equal(goal.stats.userAssists, 1);
  for (let tick = 0; tick < 10; tick++) stepArcade(goal, SHOOT);
  assert.equal(goal.homeScore, 1); assert.equal(goal.events.length, 1);
});

test('all formations and personal positions finish full matches finite, bounded, and position-locked', () => {
  for (const [formation, personalPosition] of [['4-3-3', 'ANG'], ['4-4-2', 'MID'], ['3-5-2', 'FOR'], ['4-5-1', 'MÅL']]) {
    const s = createArcade(formation, { formation, personalPosition });
    for (const mask of recording()) {
      stepArcade(s, mask); assert.equal(s.controlled, s.personalIndex);
      for (const p of [...s.home, ...s.away]) {
        for (const key of ['x', 'y', 'vx', 'vy', 'energy', 'gait', 'touch']) assert(Number.isFinite(p[key]), `${formation}:${key}`);
        assert(Math.abs(p.x) <= 29.5 && Math.abs(p.y) <= 47.4); assert(p.energy >= 0 && p.energy <= 100);
      }
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert(Number.isFinite(s.ball[key]));
      assert(Math.abs(s.ball.x) <= 30 && Math.abs(s.ball.y) <= 48 && s.ball.z >= .22);
    }
    assert.equal(s.tick, INPUT_COUNT); assert.equal(s.home.length, 11); assert.equal(s.away.length, 11);
  }
});
