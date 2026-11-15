// Read-only regression investigation for Claude M5 del 2 at 492af99.
// Run from any directory: node /absolute/path/to/this/file.mjs
// This script uses only engine 11 in memory, writes this directory's JSON report,
// makes no network calls, and never edits tracked source, tests or production data.
//
// Fixture copied from tests/engine11-defending.test.mjs (duel / poke fixture).
// Automatic tackle duels currently award a tackle before the swept-foot contact
// branch. Reconstruct that branch's exact ball segment and foot volumes to show
// the difference between a successful duel and an actual physical contact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as rules from '../../shared/football-engine11.js';

const seed = 'poke-17';
const config = { homeRating: 85, awayRating: 50 };
const state = rules.createArcade(seed, config);

// Move every outfielder except the intended defender/carrier clear of this duel.
state.home.forEach((p, i) => {
  if (i > 0 && i !== 3) Object.assign(p, { x: -26 + i, y: -40, vx: 0, vy: 0 });
});
state.away.forEach((p, i) => {
  if (i > 0 && i !== 5) Object.assign(p, { x: 26 - i, y: -40, vx: 0, vy: 0 });
});
state.controlled = 10;
state.freeze = 0;
Object.assign(state.away[5], {
  x: 0, y: 10, vx: 0, vy: 1.5, facingX: 0, facingY: 1,
  decision: 60, cooldown: 60,
});
Object.assign(state.home[3], { x: .3, y: 11.6, vx: 0, vy: 0, cooldown: 0 });
state.ball = {
  ...state.ball, owner: { team: 'away', index: 5 }, x: 0, y: 10.7, protected: 0,
};

const initialFixture = JSON.parse(JSON.stringify(state));
const footPosition = (p) => ({
  x: p.x + p.facingX * rules.CONTACT.autoOffset,
  y: p.y + p.facingY * rules.CONTACT.autoOffset,
});
let report;
for (let i = 0; i < 24; i++) {
  // stepPlayingArcade captures carriedFrom and contactMotion before moving anyone.
  const previousBall = { x: state.ball.x, y: state.ball.y, z: state.ball.z };
  const previousDefender = { ...state.home[3] };
  rules.stepArcade(state, 0);
  const contact = state.lastContact;
  if (contact?.tick !== state.tick || contact.kind !== 'tackle'
    || contact.team !== 'home' || contact.index !== 3) continue;

  const defender = state.home[3];
  const footStart = footPosition(previousDefender);
  const footEnd = footPosition(defender);
  // The successful duel puts the ball at hit.x/y/z. No position integration runs
  // after pokeBall in this tick, only rounding to four decimals.
  const ballEndpoint = { x: contact.x, y: contact.y, z: contact.z };
  const swept = rules.sweptContact(
    previousBall, ballEndpoint, footStart, footEnd,
    rules.CONTACT.autoRadius, rules.CONTACT.footHeight,
  );

  report = {
    branchHeadReviewed: '492af990e04e0c3cf7ae466e34b6e4fb5112e052',
    engineFile: 'shared/football-engine11.js',
    engineFileSha256: createHash('sha256')
      .update(readFileSync(new URL('../../shared/football-engine11.js', import.meta.url)))
      .digest('hex'),
    seed, config, inputMaskEveryTick: 0, tick: state.tick,
    initialFixture,
    recordedContact: contact,
    pendingTackle: defender.pendingTackle,
    defender: { x: defender.x, y: defender.y, facingX: defender.facingX, facingY: defender.facingY },
    contactCalculation: {
      previousBall, ballEndpoint, footStart, footEnd,
      autoFootOffsetMeters: rules.CONTACT.autoOffset,
      autoFootRadiusMeters: rules.CONTACT.autoRadius,
      footHeightMeters: rules.CONTACT.footHeight,
      sweptContact: swept,
      ballToPlayerCentreMeters: Math.hypot(ballEndpoint.x - defender.x, ballEndpoint.y - defender.y),
      ballToExtendedFootMeters: Math.hypot(ballEndpoint.x - footEnd.x, ballEndpoint.y - footEnd.y),
    },
    conclusion: 'The engine awards an automatic tackle although its own swept-foot contact test returns null.',
  };
  break;
}

assert(report, 'Expected this seed to produce the reviewed tackle within 24 ticks.');
assert.equal(report.tick, 20, 'The reviewed deterministic tackle must occur on tick 20.');
assert.equal(report.recordedContact.manual, false);
assert.equal(report.contactCalculation.sweptContact, null,
  'If this assertion fails after an approved engine 11 fix, reassess the reproduction.');
assert(report.contactCalculation.ballToExtendedFootMeters > 1.3);
const output = new URL('../../.dev-data/review/reproduce-tackle-contact.json', import.meta.url);
mkdirSync(new URL('./', output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({
  seed, tick: report.tick,
  awardedTackle: report.recordedContact.kind,
  sweptContact: report.contactCalculation.sweptContact,
  footGapMeters: report.contactCalculation.ballToExtendedFootMeters,
  allowedRadiusMeters: report.contactCalculation.autoFootRadiusMeters,
  output: output.pathname,
}, null, 2));
