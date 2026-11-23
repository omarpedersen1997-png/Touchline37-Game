// R4 competition rules use fixed ticks and the authoritative pitch coordinate system.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const forward = team => team === 'home' ? -1 : 1;
export const opponent = team => team === 'home' ? 'away' : 'home';
export const SUBSTITUTION_COMMAND = 32776;
export const isActive = player => !player.sentOff;

export function secondLastOpponent(state, team) {
  const direction = forward(team);
  let first = -48, second = -48;
  for (const player of state[opponent(team)]) {
    if (!isActive(player)) continue;
    const depth = player.y * direction;
    if (depth > first) { second = first; first = depth; }
    else if (depth > second) second = depth;
  }
  return second;
}

export function identifyOffside(state, team, kicker, restartKind) {
  if (restartKind === 'throw-in' || restartKind === 'corner' || restartKind === 'goal-kick' || restartKind === 'kickoff') return 0;
  const direction = forward(team);
  const limit = Math.max(0, state.ball.y * direction, secondLastOpponent(state, team)) + .04;
  let mask = 0;
  for (const [index, player] of state[team].entries()) {
    if (index !== kicker && isActive(player) && player.y * direction > limit) mask |= 1 << index;
  }
  return mask;
}

export function inPenaltyArea(team, x, y) {
  return Math.abs(x) <= 16.5 && (48 - y * -forward(team)) <= 16.5;
}

export function foulSeverity(tackler, victim, ball, manual) {
  if (!isActive(tackler) || tackler.keeper) return 0;
  const dx = tackler.x - victim.x, dy = tackler.y - victim.y;
  const gap = Math.hypot(dx, dy);
  if (gap > (manual ? 1.28 : 1.04) || gap < .01 ||
      Math.hypot(tackler.x - ball.x, tackler.y - ball.y) < .32) return 0;
  const behind = (dx * victim.facingX + dy * victim.facingY) / gap < -.40;
  const closing = -(dx * (tackler.vx - victim.vx) + dy * (tackler.vy - victim.vy)) / gap;
  const intensity = Math.hypot(tackler.vx - victim.vx, tackler.vy - victim.vy);
  if (closing < (manual ? .65 : 1.2) && !behind) return 0;
  if (!behind && intensity < (manual ? 4.8 : 5.6)) return 0;
  return behind && intensity > 7.8 ? 3 : behind || intensity > 5.4 ? 2 : 1;
}

export function setPieceLayout(state, team, kind, spot, taker) {
  const direction = forward(team);
  const defending = opponent(team);
  const radius = kind === 'throw-in' ? 2 : 9.15;
  const place = (p, x, y) => {
    p.x = clamp(x, -29.6, 29.6); p.y = clamp(y, -47.8, 47.8);
    p.vx = 0; p.vy = 0; p.ax = 0; p.ay = 0;
  };
  const rival = state[defending];
  const player = state[team][taker];
  const box = kind === 'penalty';
  let wall = 0;
  const direct = kind === 'free-kick' && !state.restart.indirect && 48 - spot.y * direction < 29 && Math.abs(spot.x) < 20;
  const gx = -spot.x, gy = 48 * direction - spot.y, distance = Math.hypot(gx, gy) || 1;
  const ux = gx / distance, uy = gy / distance;
  for (const side of [team, defending]) {
    for (const [index, p] of state[side].entries()) {
      if (!isActive(p) || (side === team && index === taker)) continue;
      if (box) {
        if (side === defending && p.keeper) place(p, 0, 47.78 * direction);
        else {
          const slot = index + (side === defending ? 11 : 0);
          place(p, (slot % 9 - 4) * 3.5, direction * (27.4 - Math.floor(slot / 9) * 3));
        }
        continue;
      }
      if (side === defending && direct && !p.keeper && wall < 4) {
        const offset = (wall++ - 1.5) * .83;
        place(p, spot.x + ux * 9.25 - uy * offset, spot.y + uy * 9.25 + ux * offset);
        p.role = 'wall';
        continue;
      }
      if (side !== defending) continue;
      const x = p.x - spot.x, y = p.y - spot.y;
      const gap = Math.hypot(x,y);
      if (gap < radius) {
        const n = gap || 1;
        place(p, spot.x + (gap ? x/n : 0) * (radius+.15), spot.y + (gap ? y/n : -direction) * (radius+.15));
        if (Math.hypot(p.x-spot.x,p.y-spot.y) < radius) {
          const inwards = spot.x >= 0 ? -1 : 1;
          place(p, spot.x + inwards*(radius+.15), p.y);
        }
      }
    }
  }
  if (box) {
    player.facingX = 0;
    player.facingY = direction;
  }
  state.restart.wall = wall;
}
