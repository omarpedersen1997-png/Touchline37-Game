import { Scene } from 'three';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStadiumBeams, createWoodworkGlint } from '../src/stadium-light-effects.js';
import { pitchFloodlightRows } from '../src/broadcast-pitch.js';

const field = { width: 60, length: 96, goalWidth: 8, goalHeight: 2.4 };

test('Night grade keeps one static beam mesh and bakes symmetrical pitch light into vertex colours', () => {
  const lamps = [ {x: 43, z: 63}, {x: -43, z: 63}, {x: 43, z: -63}, {x: -43, z: -63} ];
  const mesh = createStadiumBeams(lamps);
  assert.equal(mesh.geometry.getAttribute('position').count, 48);
  assert.equal(mesh.geometry.getAttribute('color').itemSize, 4);
  assert.equal(mesh.material.forceSinglePass, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(pitchFloodlightRows(12, 27, field), pitchFloodlightRows(-12, -27, field));
  assert.ok(pitchFloodlightRows(12, 27, field) > pitchFloodlightRows(30, 48, field));
});

test('A real post or crossbar contact briefly lights the correct frame without modifying the replay', () => {
  const scene = new Scene(), update = createWoodworkGlint(scene, field);
  const [sprite] = scene.children;
  const state = { tick: 20, lastAction: { kind: 'woodwork', tick: 20 }, ball: { x: 4.04, y: 47.86, z: 1.2 } };
  const start = structuredClone(state);
  update(state, 0, false);
  assert.equal(sprite.visible, true);
  assert.deepEqual(sprite.position.toArray(), [4, 1.2, 48]);
  const alpha = sprite.material.opacity;
  update(state, 2, false);
  assert.ok(sprite.material.opacity < alpha);
  update(state, 4, false);
  assert.equal(sprite.visible, false);
  update(state, 0, true);
  assert.equal(sprite.visible, false);
  assert.deepEqual(state, start);
  update({ ...state, ball: { x: .8, y: -47.86, z: 2.41 } }, 0, false);
  assert.deepEqual(sprite.position.toArray(), [.8, 2.4, -48]);
});
