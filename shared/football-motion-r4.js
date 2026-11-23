import { BALL_PROFILES, receiveLivingBall } from './football-motion-r3.js';

export const BALL_RADIUS = .22;
export const BALL_SUBSTEP = 1 / 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function ground(ball, dt, profile) {
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const next = Math.max(0, speed * Math.exp(-profile.roll * dt) - profile.friction * dt);
  const factor = speed ? next / speed : 0;
  ball.x += ball.vx * (1 + factor) * .5 * dt;
  ball.y += ball.vy * (1 + factor) * .5 * dt;
  ball.vx *= factor;
  ball.vy *= factor;
  ball.z = BALL_RADIUS;
  ball.vz = 0;
}

function air(ball, dt, profile) {
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2 + ball.vz ** 2);
  const drag = 1 / (1 + profile.air * speed * dt);
  const angle = (ball.curl || 0) * .053 * dt;
  const cos = Math.cos(angle), sin = Math.sin(angle), vx = ball.vx, vy = ball.vy;
  ball.vx = (vx * cos - vy * sin) * drag;
  ball.vy = (vx * sin + vy * cos) * drag;
  ball.x += (vx + ball.vx) * .5 * dt;
  ball.y += (vy + ball.vy) * .5 * dt;
  const vertical = (ball.vz - 9.81 * dt) * drag;
  ball.z += (ball.vz + vertical) * .5 * dt;
  ball.vz = vertical;
}

export function integrateMatchBall(ball, seconds = .05) {
  let remaining = clamp(Number.isFinite(seconds) ? seconds : 0, 0, .05);
  const profile = BALL_PROFILES[ball.flightKind] || BALL_PROFILES.loose;
  while (remaining > 1e-8) {
    const dt = Math.min(BALL_SUBSTEP, remaining);
    remaining -= dt;
    const airborne = ball.z > BALL_RADIUS + .0005 || ball.vz > .065;
    ball.curl = (ball.curl || 0) * Math.exp(-(airborne ? .98 : 4.2) * dt);
    if (!airborne) { ground(ball, dt, profile); continue; }
    const height = ball.z - BALL_RADIUS;
    const flight = (ball.vz + Math.sqrt(ball.vz ** 2 + 19.62 * Math.max(0,height))) / 9.81;
    if (flight > dt || (flight <= 0 && ball.vz > 0)) { air(ball,dt,profile); continue; }
    const impactTime = clamp(flight,0,dt);
    air(ball,impactTime,profile);
    ball.z = BALL_RADIUS;
    const speed = Math.abs(ball.vz);
    ball.vz = speed >= .9 ? speed * profile.bounce : 0;
    ball.vx *= profile.skid;
    ball.vy *= profile.skid;
    const left = dt - impactTime;
    if (left > 0) {
      if (ball.vz > .065) air(ball,left,profile);
      else ground(ball,left,profile);
    }
  }
  return ball;
}

export function receiveMatchBall(ball, player, options) {
  ball.touchCountdown = 0;
  return receiveLivingBall(ball,player,options);
}

// A stride makes contact, then the free ball rolls ahead. No positional servo is
// applied between touches. A sharp cut can leave the ball reachable but loose.
export function dribbleStep(ball, player, targetX, targetY, speed, skill) {
  const dx = targetX - ball.x, dy = targetY - ball.y;
  const distance = Math.hypot(dx, dy);
  const reach = Math.hypot(ball.x-player.x,ball.y-player.y);
  const facing = (ball.x-player.x)*player.facingX+(ball.y-player.y)*player.facingY;
  const controlled = ball.protected > 0 || reach < 1.45 + skill * .007;
  ball.touchCountdown = Math.max(0,(ball.touchCountdown || 0)-1);
  ball.flightKind = 'pass';
  if (controlled && (ball.touchCountdown === 0 || (distance > 1 && reach < .85)) &&
      (ball.protected > 0 || facing > -.62)) {
    const assistance = clamp(3.7 + skill * .017, 4, 5.5);
    ball.vx = player.vx * (.9 + skill * .001) + dx * assistance;
    ball.vy = player.vy * (.9 + skill * .001) + dy * assistance;
    const cap = speed + 4.2;
    const velocity = Math.hypot(ball.vx,ball.vy);
    if (velocity > cap) { ball.vx *= cap / velocity; ball.vy *= cap / velocity; }
    ball.vz = speed > 5 ? .23 + speed * .024 : 0;
    ball.curl = 0;
    ball.touchCountdown = speed > 5.5 ? 4 : speed > 2 ? 3 : 2;
  }
  integrateMatchBall(ball);
  const after = Math.hypot(ball.x-player.x,ball.y-player.y);
  return ball.protected > 0 || after < 1.72 + skill*.006;
}
