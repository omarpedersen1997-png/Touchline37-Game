// Version 5 is a deterministic football simulation shared by the pitch and replay validator.
// All time is measured in ticks. Keep previous engines immutable for saved matches.
export const ARCADE_VERSION = 5;
export const STEP_MS = 50, INPUT_MS = 50, DURATION_MS = 60000, INPUT_COUNT = DURATION_MS / INPUT_MS;
export const FIELD = { width: 60, length: 96, goalWidth: 8, goalHeight: 2.4 };
export const SHOOT = 256, PASS = 512, SPRINT = 1024, SHOOT_HELD = 2048, PASS_HELD = 4096, SKILL = 8192, THROUGH = 16384;
export const DIRECTIONS = [[0, 0], ...Array.from({ length: 32 }, (_, i) => [Math.sin(i * Math.PI / 16), -Math.cos(i * Math.PI / 16)])];

const dt = STEP_MS / 1000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const length = (x, y) => Math.hypot(x, y);
const distance = (a, b) => length(a.x - b.x, a.y - b.y);
const q = n => Math.round(n * 10000) / 10000;
const other = team => team === 'home' ? 'away' : 'home';
const forward = team => team === 'home' ? -1 : 1;
function random(s) { let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
function hash(seed) { let n = 2166136261; for (const c of String(seed)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0 || 1; }

const shapes = {
  '4-3-3': [[0, 44], [-23, 28], [-8, 30], [8, 30], [23, 28], [-17, 11], [0, 16], [17, 11], [-22, -3], [22, -3], [0, 2]],
  '4-4-2': [[0, 44], [-23, 28], [-8, 30], [8, 30], [23, 28], [-22, 9], [-7, 13], [7, 13], [22, 9], [-8, 2], [8, 2]],
  '3-5-2': [[0, 44], [-17, 29], [0, 31], [17, 29], [-25, 13], [-13, 11], [0, 17], [13, 11], [25, 13], [-8, 2], [8, 2]],
  '4-5-1': [[0, 44], [-23, 28], [-8, 30], [8, 30], [23, 28], [-24, 9], [-12, 13], [0, 18], [12, 13], [24, 9], [0, 2]]
};

function formation(team, shape) {
  const sign = -forward(team);
  return shape.map(([x, y], i) => ({
    x: x * sign, y: y * sign, vx: 0, vy: 0, facingX: 0, facingY: -sign,
    keeper: i === 0, cooldown: 0, energy: 100, dive: 0, diveX: 0, diveY: 0,
    kick: 0, tackle: 0, touch: 0, gait: 0, action: 'idle', actionTicks: 0, actionDuration: 0,
    possessionTicks: 0, decision: 0, savedShot: -1, receive: 0, role: i === 0 ? 'keeper' : 'shape'
  }));
}

function newBall(team = 'home', index = 10, x = 0, y = 1.2, protection = 16) {
  return {
    x, y, z: .22, vx: 0, vy: 0, vz: 0, curl: 0,
    owner: { team, index }, protected: protection, lastTeam: team,
    lastTouch: { team, index }, lastShooter: null, lastPassFrom: null, assist: null,
    shot: false, shotId: 0, flight: 0, passTarget: null, receivePoint: null, touchPhase: 0
  };
}

export function createArcade(seed, config = {}) {
  const shape = shapes[config.formation] || shapes['4-3-3'];
  const personal = { ANG: 10, MID: 6, FOR: 2, 'MÅL': 0 };
  const personalIndex = Object.hasOwn(personal, config.personalPosition) ? personal[config.personalPosition] : null;
  return {
    version: ARCADE_VERSION, positions: shape, field: FIELD,
    tactic: ['attacking', 'defensive'].includes(config.tactic) ? config.tactic : 'balanced',
    tick: 0, rng: hash(seed), homeRating: clamp(Number(config.homeRating) || 48, 1, 99), awayRating: clamp(Number(config.awayRating) || 48, 1, 99),
    skills: { technique: clamp(Number(config.technique) || 48, 1, 99), physical: clamp(Number(config.physical) || 48, 1, 99), reading: clamp(Number(config.reading) || 48, 1, 99) },
    personalIndex, personalRating: clamp(Number(config.personalRating) || Number(config.homeRating) || 48, 1, 99), startingEnergy: clamp(Number(config.fitness) || 100, 25, 100),
    home: formation('home', shape), away: formation('away', shape), controlled: personalIndex ?? 10,
    homeScore: 0, awayScore: 0, lastMask: 0, freeze: 0, events: [], shotSequence: 0,
    phase: { home: 'possession', away: 'defending' },
    stats: { homeShots: 0, awayShots: 0, homeSaves: 0, awaySaves: 0, passes: 0, completedPasses: 0, tackles: 0, userGoals: 0, userAssists: 0, userSaves: 0, userPasses: 0, userPassAttempts: 0, userTackles: 0, homePossession: 0, awayPossession: 0 },
    ball: newBall()
  };
}

export function directionMask(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude < .18) return 0;
  const direction = ((Math.round(Math.atan2(x, -y) / (Math.PI / 16)) + 32) % 32) + 1;
  return direction | (Math.min(3, Math.max(1, Math.ceil(Math.min(1, magnitude) * 3))) << 6);
}

// Bit 15 remains reserved. V5 adds a through pass at bit 14 without changing the packet size.
export function validateMask(mask) {
  return Number.isInteger(mask) && mask >= 0 && mask < 32768 && (mask & 63) <= 32 && ((mask & 63) === 0 ? ((mask >> 6) & 3) === 0 : ((mask >> 6) & 3) > 0);
}
export function encodeInputs(inputs) {
  if (inputs.length !== INPUT_COUNT || !Array.from(inputs).every(validateMask)) throw Error('Ufuldstændigt kampforløb.');
  const bytes = new Uint8Array(INPUT_COUNT * 2);
  inputs.forEach((mask, i) => { bytes[i * 2] = mask & 255; bytes[i * 2 + 1] = mask >> 8; });
  return btoa(String.fromCharCode(...bytes));
}
export function decodeInputs(value) {
  if (typeof value !== 'string' || value.length !== 3200 || !/^[A-Za-z0-9+/]+$/.test(value)) throw Error('Ugyldigt kampforløb.');
  const raw = atob(value), data = Uint16Array.from({ length: INPUT_COUNT }, (_, i) => raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8));
  if (!data.every(validateMask)) throw Error('Ugyldig kampstyring.');
  return data;
}

function animate(p, action, ticks) {
  p.action = action; p.actionTicks = ticks; p.actionDuration = ticks;
  if (action === 'kick') p.kick = ticks;
  if (action === 'tackle') p.tackle = ticks;
  if (action === 'receive') p.receive = ticks;
}

function move(p, tx, ty, speed) {
  const dx = tx - p.x, dy = ty - p.y, d = length(dx, dy);
  const wanted = d > .1 ? Math.min(speed, d / dt) : 0;
  const vx = d ? dx / d * wanted : 0, vy = d ? dy / d * wanted : 0;
  const turn = length(vx - p.vx, vy - p.vy), acceleration = (wanted ? (p.tackle > 0 ? 19 : 25) : 34) * dt;
  const blend = turn > acceleration ? acceleration / turn : 1;
  p.vx += (vx - p.vx) * blend; p.vy += (vy - p.vy) * blend;
  const pace = length(p.vx, p.vy);
  if (pace > .25 && p.kick === 0) { p.facingX = p.vx / pace; p.facingY = p.vy / pace; }
  p.x = q(clamp(p.x + p.vx * dt, -29.5, 29.5)); p.y = q(clamp(p.y + p.vy * dt, -47.4, 47.4));
  p.gait = q((p.gait + pace * dt * .82) % (Math.PI * 2));
  for (const key of ['vx', 'vy', 'facingX', 'facingY']) p[key] = q(p[key]);
}

function projection(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const t = square ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / square, 0, 1) : 0;
  return { t, d: length(p.x - a.x - dx * t, p.y - a.y - dy * t) };
}
function laneDanger(s, team, a, b) {
  return s[other(team)].reduce((risk, p) => {
    const { t, d } = projection(p, a, b);
    // Opponents behind the passer or receiver do not close the passing lane.
    return risk + (t > .05 && t < .95 ? Math.max(0, 2.7 - d) * (p.keeper ? .3 : 1) : 0);
  }, 0);
}
function rating(s, team, index) { return team === 'away' ? s.awayRating : index === s.personalIndex ? s.skills.technique : s.homeRating; }

export function passTarget(s, team, index, mask = 0) {
  const p = s[team][index], f = forward(team), hasDirection = !!(mask & 63);
  const [dx, dy] = hasDirection ? DIRECTIONS[mask & 63] : [p.facingX * .45, f];
  const norm = length(dx, dy) || 1, through = !!(mask & THROUGH);
  let best = null, bestScore = -Infinity;
  s[team].forEach((mate, i) => {
    if (i === index) return;
    const d = distance(p, mate);
    if (d < 2 || d > (through ? 43 : 49)) return;
    const direction = ((mate.x - p.x) * dx + (mate.y - p.y) * dy) / (d * norm);
    if (hasDirection && direction < -.2) return;
    const progress = (mate.y - p.y) * f;
    const pressure = Math.min(...s[other(team)].filter(op => !op.keeper).map(op => distance(mate, op)));
    const score = direction * (hasDirection ? 30 : 13) + progress * (through ? .4 : .12) - Math.abs(d - (through ? 22 : 15)) * .22 - laneDanger(s, team, p, mate) * 4.8 + clamp(pressure, 0, 7) * .7 - (mate.keeper ? 12 : 0);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  // A deliberate backward direction is allowed; an empty directional cone falls back to a safe outlet.
  return best === null && hasDirection ? passTarget(s, team, index, mask & ~63 & ~192) : best;
}

// A stable four-pass collision solver keeps every body on the playable pitch.
function separate(s) {
  const all = [...s.home, ...s.away], radius = 1.16;
  for (let pass = 0; pass < 4; pass++) for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = length(dx, dy);
    if (d >= radius) continue;
    const angle = (i * 17 + j * 11) * 2.399963229728653;
    const nx = d > .0001 ? dx / d : Math.cos(angle), ny = d > .0001 ? dy / d : Math.sin(angle), push = (radius - d) / 2;
    for (const [p, sign] of [[a, -1], [b, 1]]) { p.x = q(clamp(p.x + nx * push * sign, -29.5, 29.5)); p.y = q(clamp(p.y + ny * push * sign, -47.4, 47.4)); }
  }
}

function restart(s, team, kind, x, y) {
  const index = kind === 'goal-kick' ? 0 : s[team].map((p, i) => ({ i, d: length(p.x - x, p.y - y) })).filter(p => p.i > 0).sort((a, b) => a.d - b.d || a.i - b.i)[0].i;
  const p = s[team][index]; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.cooldown = 0; p.possessionTicks = 0;
  if (team === 'home' && s.personalIndex === null) s.controlled = index;
  s.ball = newBall(team, index, x, y, 18);
  s.restart = { kind, team, tick: s.tick }; s.freeze = 10; s.shotCharge = 0; s.passCharge = 0;
}

function kick(s, team, index, shoot, mask = 0) {
  const p = s[team][index], b = s.ball;
  if (p.cooldown > 0 || b.owner?.team !== team || b.owner.index !== index) return false;
  const f = forward(team), skill = rating(s, team, index), user = team === 'home' && index === s.controlled;
  let tx, ty, speed, vz, kind, target = null;
  if (shoot) {
    const [dx, dy] = DIRECTIONS[mask & 63], power = user ? clamp((s.shotCharge || 0) / 18, .18, 1) : .5 + random(s) * .22;
    const goalDistance = Math.max(2, 48 - p.y * f), directional = !!(mask & 63);
    const aim = directional && Math.abs(dx) > .12 ? dx * 3.3 : (p.x ? -Math.sign(p.x) : random(s) < .5 ? -1 : 1) * (2.25 + power * .55);
    const error = (random(s) - .5) * (2.4 - skill * .018) * (1 + Math.max(0, goalDistance - 22) / 42);
    tx = aim + error; ty = f * 49.5;
    // A stick held directly backwards can turn and shoot back into the pitch.
    if (directional && dy * f < -.55) { tx = p.x + dx * 35; ty = p.y + dy * 35; }
    speed = 23 + power * 15 + skill * .018;
    const flightTime = length(tx - p.x, ty - p.y) / speed;
    const targetHeight = .35 + power * .65;
    vz = clamp((targetHeight - .24) / Math.max(.15, flightTime) + 4.905 * flightTime, 1.1, 9.2);
    b.lastShooter = { team, index }; b.assist = b.lastPassFrom?.team === team && b.lastPassFrom.index !== index ? { ...b.lastPassFrom } : null;
    b.lastPassFrom = null; b.shot = true; b.shotId = ++s.shotSequence; b.passTarget = null; b.receivePoint = null;
    b.curl = directional ? dx * (1 - power) * .8 : -Math.sign(p.x) * (1 - power) * .45;
    s.lastAction = { kind: 'shot', team, index, power, tick: s.tick };
    s.stats[team === 'home' ? 'homeShots' : 'awayShots']++;
  } else {
    target = passTarget(s, team, index, mask);
    if (target === null) return false;
    if (team === 'home' && s.personalIndex !== null && index !== s.personalIndex && s.callForPass > 0) { target = s.personalIndex; s.callForPass = 0; }
    const mate = s[team][target], through = !!(mask & THROUGH), d = distance(p, mate);
    const loft = user && (s.passCharge || 0) >= 9;
    const lead = through ? clamp(d / 23, .65, 1.3) : clamp(d / 38, .15, .6);
    tx = mate.x + mate.vx * lead; ty = mate.y + mate.vy * lead;
    if (through) { tx += (mask & 63) ? DIRECTIONS[mask & 63][0] * 3 : mate.facingX * 2; ty += f * clamp(4 + d * .13, 5, 9); }
    tx = clamp(tx, -28.2, 28.2); ty = clamp(ty, -44.8, 44.8);
    speed = loft ? clamp(d * .72, 22, 32) : clamp(15 + d * .43 + (through ? 3 : 0), 18, 31);
    const travel = length(tx - b.x, ty - b.y) / speed;
    vz = loft ? clamp(4.905 * travel + .4, 4.3, 9.2) : .15;
    kind = through ? 'through' : loft ? 'loft' : 'pass';
    b.lastPassFrom = { team, index }; b.lastShooter = null; b.assist = null; b.shot = false; b.curl = 0;
    b.passTarget = { team, index: target }; b.receivePoint = { x: tx, y: ty, through };
    s.lastAction = { kind, team, index, target, tick: s.tick };
    if (team === 'home') { s.stats.passes++; if (index === s.personalIndex) s.stats.userPassAttempts++; }
  }
  const dx = tx - p.x, dy = ty - p.y, d = length(dx, dy) || 1;
  p.facingX = dx / d; p.facingY = dy / d;
  // The visible foot makes contact before the ball starts its independent flight.
  b.x = p.x + p.facingX * .8; b.y = p.y + p.facingY * .8;
  b.owner = null; b.vx = dx / d * speed + p.vx * .12; b.vy = dy / d * speed + p.vy * .12;
  b.vz = vz; b.z = .24; b.lastTeam = team; b.lastTouch = { team, index }; b.protected = 2; b.flight = 0;
  p.cooldown = shoot ? 15 : 8; p.possessionTicks = 0; animate(p, 'kick', shoot ? 10 : 7);
  if (user) { s.shotCharge = 0; s.passCharge = 0; }
  return true;
}

function kickoff(s, team) {
  const energy = s.personalIndex !== null ? s.home[s.personalIndex].energy : null;
  s.home = formation('home', s.positions); s.away = formation('away', s.positions);
  if (energy !== null) s.home[s.personalIndex].energy = energy;
  s.controlled = s.personalIndex ?? 10; s.ball = newBall(team, 10, 0, team === 'home' ? 1.2 : -1.2, 22);
  s.freeze = 20; s.skillTicks = 0; s.shotCharge = 0; s.passCharge = 0;
}

function startDive(p, dx, dy) {
  const d = length(dx, dy) || 1;
  p.dive = 10; p.diveX = dx / d; p.diveY = dy / d; p.cooldown = 24; animate(p, 'dive', 10);
}

function keeperAI(s, team, p) {
  const b = s.ball, f = forward(team), skill = team === 'home' ? s.homeRating : s.awayRating;
  p.role = 'keeper';
  if (b.owner?.team === team && b.owner.index === 0) {
    move(p, clamp(p.x, -9, 9), -f * 40, 4.2);
    if (p.possessionTicks > 11 && p.cooldown === 0) kick(s, team, 0, false);
    return;
  }
  const towardGoal = !b.owner && b.vy * -f > 2;
  const timeToLine = towardGoal ? (-f * 45.2 - b.y) / b.vy : -1;
  const incomingX = timeToLine > 0 ? b.x + b.vx * timeToLine : b.x;
  const shotThreat = b.shot && towardGoal && timeToLine > -.1 && timeToLine < 1.1 && Math.abs(incomingX) < 6;
  let tx = clamp(b.x * .24, -3.1, 3.1), ty = -f * (44.2 - clamp((48 - Math.abs(b.y)) * .035, 0, 1.8));
  if (shotThreat) {
    tx = clamp(incomingX, -4.5, 4.5); ty = -f * 44.7;
    if (timeToLine < .48 + skill * .0018 && p.cooldown === 0 && (Math.abs(tx - p.x) > .55 || b.z > 1.2)) startDive(p, tx - p.x, (b.y - p.y) * .08);
  } else if (!b.owner && Math.abs(b.y) > 31 && b.y * -f > 0 && Math.abs(b.x) < 17 && length(b.vx, b.vy) < 18) {
    const opponent = Math.min(...s[other(team)].filter(p => !p.keeper).map(p => distance(p, b)));
    if (distance(p, b) < opponent + 1.6) { tx = b.x + b.vx * .18; ty = clamp(b.y + b.vy * .18, -46, 46); p.role = 'sweeper'; }
  } else if (b.owner?.team === other(team) && Math.abs(b.y) > 36 && Math.abs(b.x) < 12 && distance(p, b) < 10) {
    tx = b.x * .7; ty = clamp(b.y - f * 1.5, -45, 45);
  }
  move(p, tx, ty, p.dive > 0 ? 10.2 : 4.6 + skill * .012);
}

function defensiveAssignments(s, team, presser) {
  const f = forward(team), candidates = s[team].map((p, i) => ({ p, i })).filter(({ i, p }) => i !== 0 && i !== presser && !(team === 'home' && i === s.controlled));
  const threats = s[other(team)].map((p, i) => ({ p, i })).filter(({ i }) => i !== 0 && !(s.ball.owner?.team === other(team) && s.ball.owner.index === i)).sort((a, b) => b.p.y * -f - a.p.y * -f || a.i - b.i);
  const marks = new Map();
  for (const { p: attacker, i: opponent } of threats) {
    if (!candidates.length) break;
    let best = 0, score = Infinity;
    candidates.forEach(({ p, i }, n) => { const anchor = s.positions[i], sign = -f, fit = distance(p, attacker) + Math.abs(anchor[0] * sign - attacker.x) * .18; if (fit < score) { score = fit; best = n; } });
    const [{ i }] = candidates.splice(best, 1); marks.set(i, opponent);
  }
  return marks;
}

function ai(s, team) {
  const players = s[team], opponents = s[other(team)], b = s.ball, f = forward(team), sign = -f;
  const skill = team === 'home' ? s.homeRating : s.awayRating;
  const intent = team === 'home' ? s.tactic === 'attacking' ? 1 : s.tactic === 'defensive' ? -1 : 0 : 0;
  const own = b.owner?.team === team, defend = !!b.owner && !own;
  const carrier = own ? players[b.owner.index] : null;
  s.phase[team] = own ? 'possession' : defend ? 'defending' : 'transition';
  const intercept = { x: clamp(b.x + b.vx * .25, -29, 29), y: clamp(b.y + b.vy * .25, -46, 46) };
  const ranked = players.map((p, i) => ({ i, d: distance(p, b.owner ? b : intercept) })).filter(({ i }) => i > 0).sort((a, b) => a.d - b.d || a.i - b.i);
  const presser = ranked[0].i, marks = defend ? defensiveAssignments(s, team, presser) : new Map();
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (team === 'home' && i === s.controlled) { p.role = 'controlled'; continue; }
    if (p.keeper) { keeperAI(s, team, p); continue; }
    const pace = (6.25 + skill * .021) * (p.tackle > 0 ? .42 : p.kick > 4 ? .65 : 1);
    if (own && b.owner?.team === team && b.owner.index === i) {
      p.role = 'carrier';
      const nearest = opponents.filter(op => !op.keeper).reduce((best, op) => !best || distance(p, op) < distance(p, best) ? op : best, null);
      const pressure = distance(p, nearest), goalDistance = 48 - p.y * f;
      if (p.decision === 0 && p.cooldown === 0) {
        p.decision = 5;
        const goal = { x: 0, y: f * 48 }, goalLane = laneDanger(s, team, p, goal);
        if (goalDistance < 23 + intent * 2 && Math.abs(p.x) < 16 && (goalLane < 2.5 || goalDistance < 12)) { kick(s, team, i, true); continue; }
        const target = passTarget(s, team, i), mate = target === null ? null : players[target];
        if (mate && p.possessionTicks > 8 && (pressure < 3.8 || p.possessionTicks > 30 || (mate.y - p.y) * f > 8) && laneDanger(s, team, p, mate) < 3.8) {
          const through = (mate.y - p.y) * f > 3 && length(mate.vx, mate.vy) > 4 && goalDistance < 55 && pressure > 2;
          kick(s, team, i, false, through ? THROUGH : 0); continue;
        }
      }
      const evade = pressure < 5 ? (p.x >= nearest.x ? 1 : -1) * (5 - pressure) * 1.6 : 0;
      move(p, clamp(p.x * .96 + evade, -25, 25), clamp(p.y + f * 13, -45.5, 45.5), pace * .91);
    } else if (own) {
      // Support occupies separate lanes, offers a backwards outlet and makes timed forward runs.
      p.role = i >= 8 ? 'run' : 'support';
      const anchor = s.positions[i];
      const band = anchor[1] >= 25 ? 'back' : anchor[1] > 3 ? 'mid' : 'front';
      let ty = band === 'back' ? carrier.y - f * (15 - intent * 2) : band === 'mid' ? carrier.y + f * (i % 2 ? 4 : -4) : carrier.y + f * (13 + intent * 3);
      let tx = anchor[0] * sign * (band === 'back' ? .88 : 1) + carrier.x * .12;
      if (Math.abs(tx - carrier.x) < 5 && Math.abs(ty - carrier.y) < 9) tx += (i % 2 ? -1 : 1) * 7;
      if (band === 'front' && Math.abs(ty) > 34) tx *= .68;
      move(p, clamp(tx, -27, 27), clamp(ty, -43.5, 43.5), pace * (band === 'front' ? .96 : .8));
    } else if (defend) {
      if (i === presser) {
        p.role = 'press';
        move(p, b.x + b.vx * .13, b.y + b.vy * .13 - f * .3, pace);
      } else {
        p.role = 'mark';
        const mark = marks.has(i) ? opponents[marks.get(i)] : null, anchor = s.positions[i];
        const line = clamp(b.y - f * (9 + intent * -2), -35, 35);
        let tx = anchor[0] * sign * .8 + b.x * .15, ty = anchor[1] * sign * .42 + line * .58;
        if (mark) { tx = mark.x * .8 + b.x * .2; ty = mark.y - f * (2.6 + Math.min(3, Math.abs(mark.x - b.x) * .08)); }
        move(p, clamp(tx, -27.5, 27.5), clamp(ty, -43.5, 43.5), pace * .87);
      }
    } else if (b.passTarget?.team === team && b.passTarget.index === i) {
      p.role = 'receive'; const target = b.receivePoint || intercept;
      move(p, target.x, target.y, pace * 1.08);
    } else if (i === presser && (b.z < 2 || distance(p, intercept) < 8)) {
      p.role = 'recover'; move(p, intercept.x, intercept.y, pace);
    } else {
      p.role = 'cover'; const anchor = s.positions[i];
      move(p, clamp(anchor[0] * sign + b.x * .16, -27, 27), clamp(anchor[1] * sign + b.y * .3, -41, 41), pace * .77);
    }
  }
}

function attemptTackle(s, team, index, manual = false) {
  const p = s[team][index], b = s.ball;
  if (p.cooldown > 0 || b.owner?.team !== other(team)) return false;
  const owner = s[b.owner.team][b.owner.index], d = distance(p, b);
  if (!manual && (d > 1.75 || b.protected > 0)) return false;
  animate(p, 'tackle', manual ? 9 : 6); p.cooldown = manual ? 18 : 17;
  const reach = manual ? 2.65 : 1.8;
  if (d > reach || b.protected > (manual ? 6 : 0)) return false;
  const dx = b.x - p.x, dy = b.y - p.y, facing = d ? (dx * p.facingX + dy * p.facingY) / d : 1;
  const reading = team === 'home' && index === s.personalIndex ? s.skills.reading : team === 'home' ? s.homeRating : s.awayRating;
  const chance = clamp(.45 + reading * .003 + facing * .13 - length(owner.vx, owner.vy) * .018 + (manual ? .12 : 0), .2, .94);
  if (random(s) >= chance) return false;
  b.owner = { team, index }; b.lastTeam = team; b.lastTouch = { team, index }; b.protected = 10;
  b.lastPassFrom = null; b.lastShooter = null; b.assist = null; b.shot = false; b.passTarget = null; b.receivePoint = null; p.possessionTicks = 0;
  if (team === 'home') { s.stats.tackles++; if (s.personalIndex === null) s.controlled = index; if (index === s.personalIndex) s.stats.userTackles++; }
  s.lastAction = { kind: 'tackle', team, index, tick: s.tick };
  return true;
}

function receiveBall(s, team, index) {
  const b = s.ball, p = s[team][index], incoming = length(b.vx, b.vy);
  if (team === 'home' && b.lastPassFrom?.team === 'home' && b.lastPassFrom.index !== index) {
    s.stats.completedPasses++; if (b.lastPassFrom.index === s.personalIndex) s.stats.userPasses++;
  }
  if (b.lastPassFrom?.team !== team) b.lastPassFrom = null;
  b.owner = { team, index }; b.lastTeam = team; b.lastTouch = { team, index }; b.protected = p.keeper ? 16 : 7;
  b.vx = p.vx; b.vy = p.vy; b.vz = 0; b.z = .22; b.curl = 0; b.passTarget = null; b.receivePoint = null;
  // A receiving touch carries momentum into the next stride instead of teleporting to the chest.
  p.touch = clamp(incoming / (20 + rating(s, team, index) * .22), .2, .95);
  p.cooldown = p.keeper ? 12 : 3; p.possessionTicks = 0; animate(p, 'receive', p.keeper ? 9 : 6);
  if (team === 'home' && !p.keeper && s.personalIndex === null) s.controlled = index;
}

function saveShot(s, team, p) {
  const b = s.ball;
  if (!b.shot || b.lastShooter?.team === team || p.savedShot === b.shotId) return;
  p.savedShot = b.shotId; s.stats[team === 'home' ? 'homeSaves' : 'awaySaves']++;
  if (team === 'home' && s.personalIndex === 0) s.stats.userSaves++;
  s.lastAction = { kind: 'save', team, index: 0, tick: s.tick };
}

function ballContacts(s, previous, endpoint, endT = 1) {
  const b = s.ball, contacts = [];
  if (b.protected > 0) return false;
  for (const team of ['home', 'away']) for (let i = 0; i < s[team].length; i++) {
    const p = s[team][i], hands = p.keeper && p.y * -forward(team) > 30 && Math.abs(p.x) < 20;
    const radius = hands ? p.dive > 0 ? 1.72 : .98 : (team === 'home' && i === s.personalIndex ? .68 + s.skills.reading * .002 : .77);
    const { t, d } = projection(p, previous, endpoint), height = previous.z + (endpoint.z - previous.z) * t;
    const reach = hands ? p.dive > 0 ? 2.55 : 1.92 : 1.12;
    if (t <= endT && d < radius && height <= reach && !(b.lastTouch?.team === team && b.lastTouch.index === i && b.flight < 5)) contacts.push({ team, i, t, d, hands, height });
  }
  contacts.sort((a, c) => a.t - c.t || a.d - c.d || a.i - c.i || (a.team === 'home' ? -1 : 1));
  const contact = contacts[0];
  if (!contact) return false;
  const { team, i, t, hands, d, height } = contact, p = s[team][i], speed = length(b.vx, b.vy);
  b.x = previous.x + (endpoint.x - previous.x) * t; b.y = previous.y + (endpoint.y - previous.y) * t; b.z = Math.max(.22, height);
  if (hands) {
    saveShot(s, team, p);
    if (b.shot && (speed > 25 || height > 1.5 || d > .85)) {
      // Hard or stretching saves are pushed wide. The ball stays live for rebounds and corners.
      const side = b.x - p.x ? Math.sign(b.x - p.x) : b.vx ? Math.sign(b.vx) : (random(s) < .5 ? -1 : 1);
      b.vx = side * (8 + speed * .15); b.vy = forward(team) * (6 + speed * .22); b.vz = 2.5 + Math.max(0, height - 1);
      b.lastTeam = team; b.lastTouch = { team, index: i }; b.lastPassFrom = null; b.passTarget = null; b.receivePoint = null; b.curl = 0; b.protected = 5;
      b.x += side * .22; b.y += forward(team) * .18;
      if (p.dive === 0) startDive(p, side, -.2);
      return true;
    }
    receiveBall(s, team, i); return true;
  }
  if (b.shot && speed > 24) {
    // Outfield blocks deflect a driven shot rather than granting instant possession.
    const side = p.x > b.x ? -1 : 1;
    b.vx = b.vx * .22 + side * 5; b.vy *= -.26; b.vz = 1.2; b.lastTeam = team; b.lastTouch = { team, index: i }; b.lastPassFrom = null; b.passTarget = null; b.receivePoint = null; b.curl = 0; b.protected = 4;
    animate(p, 'receive', 5); return true;
  }
  receiveBall(s, team, i); return true;
}

function boundary(previous, b) {
  let result = null;
  for (const [axis, edge] of [['x', 30], ['y', 48]]) {
    if (Math.abs(b[axis]) <= edge) continue;
    const line = Math.sign(b[axis]) * edge, delta = b[axis] - previous[axis];
    const t = delta ? clamp((line - previous[axis]) / delta, 0, 1) : 0;
    if (!result || t < result.t) result = { axis, line, t, x: previous.x + (b.x - previous.x) * t, y: previous.y + (b.y - previous.y) * t, z: previous.z + (b.z - previous.z) * t };
  }
  return result;
}

function leavePitch(s, crossing) {
  const b = s.ball;
  if (crossing.axis === 'x') {
    restart(s, other(b.lastTeam), 'throw-in', Math.sign(crossing.x) * 29, clamp(crossing.y, -45.5, 45.5)); return;
  }
  // Posts and crossbar have volume; trajectory is checked at the line, not after the tick.
  const post = Math.abs(Math.abs(crossing.x) - 4) < .14 && crossing.z < 2.55;
  const bar = Math.abs(crossing.z - 2.4) < .12 && Math.abs(crossing.x) < 4.14;
  if (post || bar) {
    b.owner = null; b.x = clamp(crossing.x, -29.8, 29.8); b.y = Math.sign(crossing.y) * 47.86; b.z = Math.max(.22, crossing.z);
    b.vy *= -.55; if (post) b.vx = (crossing.x > 0 ? -1 : 1) * Math.max(3, Math.abs(b.vx) * .6); if (bar) b.vz = -Math.abs(b.vz) * .6;
    b.protected = 2; s.lastAction = { kind: 'woodwork', tick: s.tick }; return;
  }
  if (Math.abs(crossing.x) < 3.86 && crossing.z < 2.28) {
    const team = crossing.y < 0 ? 'home' : 'away';
    const scorer = b.lastShooter?.team === team ? b.lastShooter : b.lastTouch?.team === team ? b.lastTouch : null;
    if (team === 'home') {
      if (scorer?.index === s.personalIndex) s.stats.userGoals++;
      if (b.assist?.team === 'home' && b.assist.index === s.personalIndex && scorer?.index !== s.personalIndex) s.stats.userAssists++;
    }
    s[team === 'home' ? 'homeScore' : 'awayScore']++;
    s.events.push({ minute: clamp(Math.ceil(s.tick / INPUT_COUNT * 90), 1, 90), kind: 'goal', side: team, text: team === 'home' ? 'Du spiller bolden i nettet!' : 'Modstanderen scorer i den spillede kamp.' });
    kickoff(s, other(team));
  } else {
    const defending = crossing.y < 0 ? 'away' : 'home', corner = b.lastTeam === defending;
    restart(s, corner ? other(defending) : defending, corner ? 'corner' : 'goal-kick', corner ? (crossing.x >= 0 ? 29 : -29) : 0, Math.sign(crossing.y) * (corner ? 46 : 43));
  }
}

function carryBall(s) {
  const b = s.ball, { team, index } = b.owner, p = s[team][index], speed = length(p.vx, p.vy);
  const f = forward(team), skill = rating(s, team, index);
  p.possessionTicks++;
  b.touchPhase = (b.touchPhase + dt * (2.8 + speed * .35)) % 1;
  p.touch = Math.max(0, p.touch - .075);
  const stride = .55 + speed * .052 + Math.max(0, Math.sin(b.touchPhase * Math.PI * 2)) * (speed * .027) + p.touch * .35;
  let fx = p.facingX, fy = p.facingY || f;
  if (s.skillTicks > 0 && team === 'home' && index === s.controlled) {
    const angle = (1 - s.skillTicks / 12) * Math.PI * 2, x = fx;
    fx = x * Math.cos(angle) - fy * Math.sin(angle); fy = x * Math.sin(angle) + fy * Math.cos(angle);
  }
  const tx = p.x + fx * stride, ty = p.y + fy * stride, blend = .38 + skill * .003;
  b.x += (tx - b.x) * blend; b.y += (ty - b.y) * blend;
  b.z = .22 + Math.max(0, Math.sin(b.touchPhase * Math.PI * 2)) * speed * .006;
  b.vx = p.vx; b.vy = p.vy; b.vz = 0; b.lastTeam = team; b.lastTouch = { team, index };
  s.stats[team === 'home' ? 'homePossession' : 'awayPossession']++;
}

function flightBall(s) {
  const b = s.ball, previous = { x: b.x, y: b.y, z: b.z };
  const speed = length(b.vx, b.vy);
  if (speed > .1 && b.curl) { const vx = b.vx; b.vx += -b.vy / speed * b.curl * dt; b.vy += vx / speed * b.curl * dt; }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt - 4.905 * dt * dt; b.vz -= 9.81 * dt; b.flight++;
  if (b.z < .22) {
    b.z = .22; b.vz = Math.abs(b.vz) > 1.25 ? -b.vz * .27 : 0;
    const rolling = b.vz === 0 ? .979 : .96; b.vx *= rolling; b.vy *= rolling;
  } else { b.vx *= .9985; b.vy *= .9985; }
  const endpoint = { x: b.x, y: b.y, z: b.z }, crossing = boundary(previous, b);
  const contact = ballContacts(s, previous, endpoint, crossing?.t ?? 1);
  if (!contact && crossing) leavePitch(s, crossing);
}

export function stepArcade(s, mask) {
  if (!validateMask(mask)) throw Error('Ugyldig kampstyring.');
  if (s.tick >= INPUT_COUNT) return s;
  if (s.tick === 0 && s.personalIndex !== null) s.home[s.personalIndex].energy = s.startingEnergy;
  s.tick++;
  for (const key of ['skillCooldown', 'skillTicks', 'callForPass']) s[key] = Math.max(0, (s[key] || 0) - 1);
  for (const team of ['home', 'away']) for (const p of s[team]) {
    for (const key of ['cooldown', 'dive', 'kick', 'tackle', 'receive', 'actionTicks', 'decision']) p[key] = Math.max(0, p[key] - 1);
    if (p.actionTicks === 0) p.action = 'idle';
  }
  s.ball.protected = Math.max(0, s.ball.protected - 1);
  if (s.freeze > 0) { s.freeze--; s.lastMask = mask; return s; }
  let b = s.ball;
  const controlled = s.home[s.controlled], direction = DIRECTIONS[mask & 63], magnitude = ((mask >> 6) & 3) / 3;
  const owns = b.owner?.team === 'home' && b.owner.index === s.controlled;
  const sprinting = !!(mask & SPRINT) && controlled.energy > 0 && magnitude > 0;
  s.shotCharge = owns && (mask & SHOOT_HELD) ? Math.min(18, (s.shotCharge || 0) + 1) : owns ? s.shotCharge || 0 : 0;
  s.passCharge = owns && (mask & PASS_HELD) ? Math.min(18, (s.passCharge || 0) + 1) : owns ? s.passCharge || 0 : 0;
  const physical = s.personalIndex !== null ? s.skills.physical : s.homeRating;
  controlled.energy = clamp(controlled.energy + (sprinting ? -(24 - physical * .075) : 10 + physical * .035) * dt, 0, 100);
  if (owns && (mask & SKILL) && !(s.lastMask & SKILL) && !s.skillCooldown && controlled.energy >= 14) {
    s.skillCooldown = 85; s.skillTicks = 12; controlled.energy -= 14; b.protected = Math.max(b.protected, 11);
    animate(controlled, 'skill', 12); s.lastAction = { kind: 'skill', team: 'home', index: s.controlled, tick: s.tick };
  }
  const pace = (7.15 + (s.personalIndex !== null ? s.personalRating : s.homeRating) * .012) * (sprinting ? 1.34 : 1) * (owns ? .94 : 1) * (controlled.tackle > 0 ? .38 : controlled.kick > 4 ? .58 : 1);
  if (controlled.keeper && controlled.dive > 0) move(controlled, controlled.x + controlled.diveX * 10, controlled.y + controlled.diveY * 10, 8.8);
  else move(controlled, controlled.x + direction[0] * 10, controlled.y + direction[1] * 10, pace * magnitude * (s.skillTicks > 0 ? 1.1 : 1));
  const throughPressed = !!(mask & THROUGH) && !(s.lastMask & THROUGH), passPressed = !!(mask & PASS) && !(s.lastMask & PASS);
  if (passPressed || throughPressed) {
    if (owns) kick(s, 'home', s.controlled, false, mask);
    else if (s.personalIndex !== null) {
      s.callForPass = 24; const owner = b.owner;
      if (owner?.team === 'home') kick(s, 'home', owner.index, false, mask);
    } else {
      const candidates = s.home.map((p, i) => ({ i, d: distance(p, b) })).filter(({ i }) => i > 0).sort((a, c) => a.d - c.d || a.i - c.i);
      s.controlled = candidates[0].i;
    }
  }
  if ((mask & SHOOT) && !(s.lastMask & SHOOT)) {
    if (b.owner?.team === 'home' && b.owner.index === s.controlled) kick(s, 'home', s.controlled, true, mask);
    else if (controlled.keeper && controlled.energy >= 10 && controlled.cooldown === 0) {
      const dx = magnitude ? direction[0] : b.x - controlled.x, dy = magnitude ? direction[1] : (b.y - controlled.y) * .15;
      startDive(controlled, dx, dy); controlled.energy -= 10;
    } else if (controlled.cooldown === 0 && controlled.energy >= 10) {
      controlled.energy -= 10;
      if (!attemptTackle(s, 'home', s.controlled, true)) { animate(controlled, 'tackle', 9); controlled.cooldown = 18; s.lastAction = { kind: 'tackle', team: 'home', index: s.controlled, tick: s.tick }; }
    }
  }
  ai(s, 'home'); ai(s, 'away'); separate(s);
  b = s.ball;
  if (b.owner && b.protected === 0) {
    const team = other(b.owner.team), candidates = s[team].map((p, i) => ({ p, i, d: distance(p, b) })).filter(({ p, i }) => !p.keeper && !(team === 'home' && i === s.controlled)).sort((a, c) => a.d - c.d || a.i - c.i);
    if (candidates.length) attemptTackle(s, team, candidates[0].i);
  }
  if (!(mask & SHOOT_HELD) && !(mask & SHOOT)) s.shotCharge = 0;
  if (!(mask & PASS_HELD) && !(mask & PASS) && !(mask & THROUGH)) s.passCharge = 0;
  const previous = { x: b.x, y: b.y, z: b.z };
  if (b.owner) { carryBall(s); const crossing = boundary(previous, b); if (crossing) leavePitch(s, crossing); }
  else flightBall(s);
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'touchPhase', 'curl']) s.ball[key] = q(s.ball[key]);
  s.lastMask = mask;
  return s;
}

export function replayArcade(seed, config, inputs) {
  if (inputs.length !== INPUT_COUNT) throw Error('Ufuldstændigt kampforløb.');
  const s = createArcade(seed, config);
  for (const mask of inputs) stepArcade(s, mask);
  return s;
}
