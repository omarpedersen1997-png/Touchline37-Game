import { BALL_PROFILES } from './football-motion-r3.js';

export const HIGH_PRESS_COMMAND = 32777;
export const FREE_KICK_SHOT = 32778;
export const FREE_KICK_PASS = 32779;
export const isR5Command = mask => mask === HIGH_PRESS_COMMAND || mask === FREE_KICK_SHOT || mask === FREE_KICK_PASS;

export function surfaceBallProfile(profile, surface) {
  if (surface !== 'wet') return profile;
  return wetProfiles.get(profile) || profile;
}

const wetProfiles = new Map(Object.values(BALL_PROFILES).map(profile => [profile, {
  ...profile,
  roll: profile.roll * .76,
  friction: profile.friction * .73,
  skid: Math.min(.985, profile.skid + .09),
  bounce: profile.bounce * .78,
}]));

// Distance under dv/dt = -roll*v - friction. This planner avoids stepping the
// complete 120 Hz ball solver hundreds of times while choosing a ground pass.
export function estimateGroundFlight(distance, speed, kind, surface) {
  const { roll, friction } = surfaceBallProfile(BALL_PROFILES[kind] || BALL_PROFILES.pass, surface);
  const offset = friction / roll;
  const initial = speed + offset;
  let min = 0, max = Math.min(4, Math.log(initial / offset) / roll);
  const endDistance = initial * -Math.expm1(-roll * max) / roll - offset * max;
  if (endDistance < distance) return {time: Infinity, speed: 0};
  for (let iteration = 0; iteration < 13; iteration++) {
    const guess = (min + max) * .5;
    const travelled = initial * -Math.expm1(-roll * guess) / roll - offset * guess;
    if (travelled < distance) min = guess;
    else max = guess;
  }
  return {time: max, speed: initial * Math.exp(-roll * max) - offset};
}

export function resolveShoulderMomentum(a, b, nx, ny, surface) {
  const approaching = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approaching <= 0) return 0;
  const impulse = Math.min(2.6, approaching * (surface === 'wet' ? .47 : .38));
  a.vx -= nx * impulse;
  a.vy -= ny * impulse;
  b.vx += nx * impulse;
  b.vy += ny * impulse;
  return impulse;
}

export function firstTouchError(player, ball, skill, pressure, surface) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 1) return 0;
  const faceBall = -(ball.vx * player.facingX + ball.vy * player.facingY) / speed;
  const movement = Math.hypot(player.vx, player.vy);
  return Math.max(0, 1 - faceBall) * (1 - skill / 120) * .09
    + Math.max(0, movement - 3) * .013
    + Math.max(0, 2.4 - pressure) * .014
    + (surface === 'wet' ? .035 : 0);
}

export function redirectHeader(ball, player, forward, skill, attacking) {
  const pace = Math.hypot(ball.vx, ball.vy);
  ball.vx = ball.vx * .22 + player.facingX * (3 + skill * .035) + player.vx * .3;
  ball.vy = forward * (attacking ? 9 + Math.min(11, pace * .22) + skill * .055 : 7 + pace * .16);
  ball.vz = attacking ? -Math.min(4.8, 1.5 + pace * .09) : 2.3 + pace * .07;
  ball.curl *= .2;
}
