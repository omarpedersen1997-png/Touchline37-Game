import { receiveMatchBall } from './football-motion-r4.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const squareDistance = (player, x, y) => (player.x - x) ** 2 + (player.y - y) ** 2;

export function receptionLoad(ball, player, skill, pressure, surface) {
  const dx = ball.vx - player.vx;
  const dy = ball.vy - player.vy;
  const speed = Math.sqrt(dx * dx + dy * dy);
  const lateral = Math.abs(dx * player.facingY - dy * player.facingX);
  const back = speed ? Math.max(0, (dx * player.facingX + dy * player.facingY) / speed) : 0;
  return clamp((speed - 6) * .025 + lateral * .023 + back * .18
    + Math.max(0, ball.z - .32) * .32 + Math.max(0, 2.6 - pressure) * .14
    + (surface === 'wet' ? .09 : 0) - (skill - 50) * .003, 0, 1);
}

export function cushionR7Ball(ball, player, skill, pressure, surface) {
  const load = receptionLoad(ball, player, skill, pressure, surface);
  const vx = ball.vx;
  const vy = ball.vy;
  const touch = receiveMatchBall(ball, player, { skill, pressure, keeper: false });
  // Let the real first contact travel for several substeps before the next
  // controlling stride. Hard balls retain more of their original bearing.
  const carry = .09 + load * .17;
  ball.vx = ball.vx * (1 - carry) + vx * carry;
  ball.vy = ball.vy * (1 - carry) + vy * carry;
  ball.vz = Math.max(ball.vz, load * .58);
  ball.touchCountdown = 2 + Math.round(load * 2);
  ball.protected = load > .65 ? 1 : 3;
  return Math.max(touch, load);
}

export function resolveR7Duel(a, b, nx, ny, surface) {
  const x = a.vx - b.vx;
  const y = a.vy - b.vy;
  const closing = x * nx + y * ny;
  if (closing <= 0) return;
  const side = x * -ny + y * nx;
  const impulse = Math.min(3, closing * (surface === 'wet' ? .46 : .39));
  const scrape = clamp(side * impulse * .055, -.6, .6);
  const ix = nx * impulse - ny * scrape;
  const iy = ny * impulse + nx * scrape;
  a.vx -= ix;
  a.vy -= iy;
  b.vx += ix;
  b.vy += iy;
  if (impulse >= .65) {
    a.duelX = -ix; a.duelY = -iy; a.duelTicks = 5;
    b.duelX = ix; b.duelY = iy; b.duelTicks = 5;
  }
}

export function redirectR7Save(ball, keeper, forward, side, reach) {
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const stretch = clamp(reach / .78, 0, 1);
  const outward = Math.max(.3, side * ball.vx) + Math.max(0, side * (keeper.diveX || 0)) * 2;
  ball.vx = side * Math.min(16, 4 + outward * .32 + speed * (.12 + stretch * .07));
  ball.vy = forward * Math.min(12, 4 + speed * (.24 - stretch * .08));
  ball.vz = .9 + Math.max(0, ball.z - .45) * .65 + stretch * .85;
  ball.curl *= .25;
}

export const createSupportTriangle = () => ({short:{x:0,y:0,index:-1},far:{x:0,y:0,index:-1}});

export function planSupportTriangle(players, opponents, carrier, forward, line, tactic, controlled, plan=createSupportTriangle()) {
  const width = Math.abs(carrier.x) > 16 ? 9 : 11;
  const side = carrier.x >= 0 ? 1 : -1;
  const forwardDepth = tactic === 'attacking' ? 11 : tactic === 'defensive' ? 4 : 8;
  const {short,far}=plan;
  short.x=clamp(carrier.x-side*width,-25,25);
  short.y=clamp(carrier.y*forward-(tactic==='defensive'?8:5),-39,Math.min(41,line-1))*forward;
  short.index=-1;
  far.x=clamp(carrier.x+side*width,-26,26);
  far.y=clamp(carrier.y*forward+forwardDepth,-39,Math.min(43,line-1))*forward;
  far.index=-1;
  // Small fixed candidate sets. Nudge occupied outlets apart before choosing
  // roles, keeping the back line intact and never exceeding the offside line.
  for (let outlet=0;outlet<2;outlet++) {
    const point=outlet===0?short:far;
    let nearest = 12;
    for (const rival of opponents) {
      if (rival.sentOff) continue;
      const distance = squareDistance(rival, point.x, point.y);
      if (distance < nearest) nearest = distance;
    }
    if (nearest < 10) point.x = clamp(point.x - Math.sign(point.x || 1) * 2, -26, 26);
    let best = 18 ** 2;
    for (let i = 1; i < players.length; i++) {
      const player = players[i];
      if (player === carrier || player.sentOff || i === controlled || -player.homeY * forward >= 25
          || (point === far && i === short.index)) continue;
      const score = squareDistance(player, point.x, point.y) + (player.role === 'support' ? -7 : 0);
      if (score < best) { best = score; point.index = i; }
    }
  }
  return plan;
}
