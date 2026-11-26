import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as engine from '../shared/football-engine11-r7.js';
import { getArcadeRules } from '../shared/arcade.js';
import { cushionR7Ball, planSupportTriangle, receptionLoad, redirectR7Save, resolveR7Duel } from '../shared/football-r7-dynamics.js';
import { HIGH_PRESS_COMMAND } from '../shared/football-r5-dynamics.js';
import { createR4Practice } from '../src/r4-practice.js';
import { createManualSession } from '../src/manual-session.js';
import { createPlayerStride, JOINT, samplePlayerStride } from '../src/player-stride-pose.js';
import { createR4CameraPlan } from '../src/broadcast-r4.js';
import { deformGoalNet, goalCameraPlan } from '../src/goal-presentation.js';
import { PerspectiveCamera, Vector3 } from 'three';

test('R7 uses the same fixed clock and uploads the same tape at 60 and 120 Hz in the local sandbox', () => {
  assert.throws(() => getArcadeRules(11, 7), /revisionen understøttes ikke/);
  const outcomes = [];
  for (const hz of [60, 120]) {
    const exercise = createR4Practice(4000, { revision: 7, surface: 'wet' });
    const config = exercise.match.manual.config;
    const session = createManualSession(exercise.match, {
      storage: exercise.storage, practiceRules: exercise.rules, now: 4000,
    });
    const duration = exercise.match.manual.duration;
    for (let frame = 1; frame <= Math.ceil(duration * hz / 1000); frame++) {
      const now = 4000 + Math.min(duration, frame * 1000 / hz);
      const mask = session.state.tick === 72 ? HIGH_PRESS_COMMAND : 0;
      session.advance(now, mask, { maxInputs: 4 });
    }
    assert.equal(exercise.rules.ENGINE_REVISION, 7);
    assert.equal(session.state.tick, engine.INPUT_COUNT);
    assert.equal(session.state.period, 'finished');
    const packet = session.packet();
    assert.ok(engine.decodeInputs(packet).includes(HIGH_PRESS_COMMAND));
    assert.deepEqual(engine.replayArcade(exercise.match.manual.seed, config, engine.decodeInputs(packet)), session.state);
    outcomes.push([packet, session.state]);
  }
  assert.deepEqual(outcomes[0], outcomes[1]);
});

test('Hard, lateral receptions on wet turf keep more speed and allow a quicker challenge', () => {
  const player = { x: 0, y: 0, vx: 1, vy: 0, facingX: 0, facingY: -1 };
  const gentle = { x: .04, y: -.5, z: .22, vx: 0, vy: 5, vz: 0 };
  const driven = { x: .04, y: -.5, z: .43, vx: -16, vy: 13, vz: -1.5 };
  const load = receptionLoad(driven, player, 55, 1.2, 'wet');
  assert.ok(load > receptionLoad(gentle, player, 55, 4, 'dry'));
  assert.ok(load > receptionLoad(driven, player, 88, 4, 'dry'));
  const first = { ...gentle }, second = { ...driven };
  cushionR7Ball(first, player, 55, 4, 'dry');
  cushionR7Ball(second, player, 55, 1.2, 'wet');
  assert.ok(second.touchCountdown > first.touchCountdown && second.protected < first.protected);
  assert.ok(second.vz > first.vz && second.vx < first.vx);
  for (const axis of ['x', 'y']) assert.equal(second[axis], driven[axis]);
});

test('Duel impulses preserve combined momentum and save deflections remain on the keeper’s chosen side', () => {
  const home = { vx: 7, vy: 4 }, away = { vx: -1, vy: -2 };
  resolveR7Duel(home, away, 1, 0, 'wet');
  assert.equal(home.vx + away.vx, 6);
  assert.equal(home.vy + away.vy, 2);
  assert.ok(home.vx < 7 && away.vx > -1);
  assert.equal(home.duelTicks, 5);
  const before = structuredClone([home, away]);
  resolveR7Duel(home, away, -1, 0, 'wet');
  assert.deepEqual([home, away], before);
  const ball = { vx: -4, vy: -37, vz: -3, z: 1.2, curl: 2 };
  redirectR7Save(ball, { diveX: 1 }, 1, 1, .7);
  assert.ok(ball.vx > 0 && ball.vy > 0 && ball.vz > 0);
  assert.ok(Math.hypot(ball.vx, ball.vy) < 19);
});

test('The support triangle spreads two teammates and reacts to the selected tactic without crossing offside', () => {
  const state = engine.createArcade('outlets');
  const carrier = state.home[10];
  Object.assign(carrier, { x: 4, y: -5 });
  Object.assign(state.home[6], { x: -7, y: 0 });
  Object.assign(state.home[7], { x: 15, y: -12 });
  const attack = planSupportTriangle(state.home, state.away, carrier, -1, 18, 'attacking', 10);
  const defense = planSupportTriangle(state.home, state.away, carrier, -1, 18, 'defensive', 10);
  assert.ok(attack.short.index >= 1 && attack.far.index >= 1);
  assert.notEqual(attack.short.index, attack.far.index);
  assert.ok(attack.short.x < carrier.x && attack.far.x > carrier.x);
  assert.ok(attack.far.y < defense.far.y && -attack.far.y <= 17);
});

test('A planted R7 ankle stays in pitch coordinates when the player turns', () => {
  const stride = createPlayerStride();
  const player = { vx: 4, vy: 0, ax: 0, ay: 0 };
  stride.phase = .12;
  const initial = samplePlayerStride(stride, player, 0, 0, 0, .016, 0, true, 0, true)[JOINT.ankleL];
  const heading = .29, x = .07;
  const joints = samplePlayerStride(stride, player, x, 0, heading, .016, 0, false, 0, true);
  const plantedX = x + Math.cos(heading) * joints[JOINT.ankleL] + Math.sin(heading) * joints[JOINT.ankleL + 2];
  assert.equal(stride.contactHeld[0], 1);
  assert.ok(Math.abs(initial - plantedX) < 1e-6);
  assert.ok(Math.abs(joints[JOINT.ankleL + 1] - .102) < 1e-6);
});

test('Broadcast leads toward a cross while overview stays fixed and only the struck net ripples', () => {
  const state = engine.createArcade('cross');
  delete state.openingKickoff;
  Object.assign(state.ball, { owner: null, flightKind: 'loft', flight: 5, x: 14, y: -23, z: 2.1, vx: -12, vy: -15, receivePoint: {x: 3,y: -35} });
  const plan = createR4CameraPlan();
  const focus = state.home[state.controlled];
  const follow = structuredClone(plan(state, 'broadcast', 2, state.ball, focus, false));
  const calm = structuredClone(plan(state, 'broadcast', 2, state.ball, focus, true));
  assert.ok(follow.target[2] < calm.target[2] - 2 && follow.eye[1] > calm.eye[1]);
  assert.deepEqual(plan(state, 'tactical', 2, state.ball, focus, false).target, [0, 0, 0]);

  state.goalSequence = { stage: 'net', netSide: -1,
    point: { x: 0, y: -48 }, impact: { tick: 2, x: 0, y: -49.2, z: 1.1, surface: 'back', strength: .8 } };
  state.tick = 7;
  const rest = Float32Array.of(0, 1, 0, 0, 1, -1.2, 2, 1, -1.2);
  const destination = new Float32Array(rest.length);
  assert.equal(deformGoalNet(destination, rest, state, 1, state.field), false);
  assert.equal(deformGoalNet(destination, rest, state, -1, state.field), true);
  assert.equal(destination[2], 0);
  assert.notEqual(destination[5], rest[5]);
  const shell = { eye: [0, 0, 0], target: [0, 0, 0] };
  assert.equal(goalCameraPlan(follow, state, 'broadcast', shell), shell);
});

test('R7 Broadcast fits a long flat pass and its receiving zone without changing the camera heading', () => {
  const state = engine.createArcade('wide-through');
  delete state.openingKickoff;
  const receive = { x: 24, y: -20 };
  Object.assign(state.ball, { x: 12, y: 0, z: .22, owner: null, flightKind: 'through', vx: 7.2, vy: -12 });
  const aspect = 16/9, plan = createR4CameraPlan(), player = state.home[state.controlled];
  const at = (revision, calm = false) => {
    state.engineRevision = revision;
    return structuredClone(plan(state, 'broadcast', aspect, state.ball, player, calm));
  };
  const project = (pose, point, height) => {
    const camera = new PerspectiveCamera(pose.fov, aspect, .5, 800);
    camera.position.set(...pose.eye);
    camera.lookAt(new Vector3(...pose.target));
    camera.updateMatrixWorld();
    return new Vector3(point.x, height, point.y).project(camera);
  };
  const baseline = at(7), calmBaseline = at(7, true);
  assert.ok(project(baseline, receive, .65).x > 1, 'receiver outside the previous frame');
  state.ball.receivePoint = receive;
  const fitted = at(7);
  const receiver = project(fitted, receive, .65), ball = project(fitted, state.ball, state.ball.z);
  assert.ok(Math.abs(receiver.x) <= .8 && Math.abs(receiver.y) <= .7);
  assert.ok(Math.abs(ball.x) <= .8 && Math.abs(ball.y) <= .7);
  const heading = (fitted.eye[2] - fitted.target[2]) / (fitted.eye[0] - fitted.target[0]);
  assert.ok(Math.abs(heading - .3) < 1e-12);
  assert.deepEqual(at(6), baseline);
  assert.deepEqual(at(7, true), calmBaseline);
  state.ball.receivePoint = { x: 80, y: 0 };
  assert.deepEqual(at(7), baseline, 'a distant target does not affect the active frame');
});
