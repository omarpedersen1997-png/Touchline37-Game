import {applyStrikeMechanics,reboundFromWoodwork} from './football-r6-contact.js';
import {createSupportTriangle,cushionR7Ball,planSupportTriangle,receptionLoad,redirectR7Save,resolveR7Duel} from './football-r7-dynamics.js';
import { R5_ADDED_TICKS, clockWithAddedTime } from './football-r5-clock.js';
import { HIGH_PRESS_COMMAND, FREE_KICK_SHOT, FREE_KICK_PASS, isR5Command, estimateGroundFlight, resolveShoulderMomentum, firstTouchError, redirectHeader } from './football-r5-dynamics.js';
import {moveLivingPlayer,turnFacing} from './football-motion-r3.js';
import {dribbleStep,integrateMatchBall,receiveMatchBall} from './football-motion-r4.js';
import {SUBSTITUTION_COMMAND,isActive,identifyOffside,secondLastOpponent,inPenaltyArea,foulSeverity,setPieceLayout} from './football-rules-r4.js';
import {captureR4Pose} from './football-pose-r4.js';

// R4 keeps the 20 Hz input protocol and uses six 120 Hz subdivisions for the ball.
// Existing revisions and recordings still use their own frozen implementations.
export const ARCADE_VERSION = 11;
export const ENGINE_REVISION = 4;
export const FIXED_DELTA_TIME = 1 / 20;
export const STEP_MS = 50, INPUT_MS = 50, DURATION_MS = 250000, INPUT_COUNT = DURATION_MS / INPUT_MS;
export const HALF_MS=120000,HALFTIME_MS=10000,PLAY_MS=240000;
export const R5_INPUT_COUNT=INPUT_COUNT+2*R5_ADDED_TICKS;
const maxTicks=state=>state.engineRevision>=5?R5_INPUT_COUNT:INPUT_COUNT;
function eventMinute(state){
 const elapsed=state.tick*STEP_MS;
 const minute=state.engineRevision>=5?clockWithAddedTime(elapsed,{stepMs:STEP_MS,halfMs:HALF_MS,halftimeMs:HALFTIME_MS}).regular/60:playingTime(elapsed)/PLAY_MS*90;
 return clamp(Math.ceil(minute),1,90);
}
export function playingTime(ms){return Math.min(HALF_MS,Math.max(0,ms))+Math.max(0,Math.min(HALF_MS,ms-HALF_MS-HALFTIME_MS));}
export const FIELD = { width: 60, length: 96, goalWidth: 8, goalHeight: 2.4 };
export const GOAL_TIMING = Object.freeze({netTicks:18,celebrationTicks:42,kickoffTicks:24});
export const SHOOT = 256, PASS = 512, SPRINT = 1024, SHOOT_HELD = 2048, PASS_HELD = 4096, SKILL = 8192, THROUGH = 16384;
export const DIRECTIONS = [[0, 0], ...Array.from({ length: 32 }, (_, i) => [Math.sin(i * Math.PI / 16), -Math.cos(i * Math.PI / 16)])];

const dt = FIXED_DELTA_TIME;
const SIDES = ['home','away'];
const supportPlans = new WeakMap();
const ballFields = ['x','y','z','vx','vy','vz','touchPhase','curl'];
const down = value => value > 1 ? value - 1 : 0;
/** Motor 11's justerbare fysik- og AI-parametre (alle deterministiske). */
export const ENGINE = Object.freeze({
  airDrag: .006,            // luftmodstand (pr. meter) – længe skud taber fart
  rollDamping: .986,        // rullemodstand pr. tick …
  rollFriction: 1.15,       // … plus konstant friktion (m/s²), så bolden kommer til ro
  bounce: .5, bounceThreshold: 1, bounceFriction: .88,
  curlDecay: .97,
  arrivalDecel: 8,          // spillere bremser blødt op mod deres mål (m/s²)
  passArrivalSpeed: [6.5, 11.5],
  supportInterval: 6,       // ticks mellem støttespilleres valg af position
  decisionTicks: [4, 7],    // boldholderens beslutningsrytme
  keeperReaction: [4.5, .04],// reaktion i ticks: 4,5 − rating·0,04 (rating 35: 3, 60: 2, 90: 1)
  fatigue: { sprintDrain: 1.4, recovery: 1.0, floor: .88 },
  // M5 del 2: taklinger og boldkontrol.
  receiveProtection: 4,     // ticks efter en modtagelse, hvor bolden ikke kan tackles (motor 10: 7)
  tackleReach: 1.3,         // computerens automatiske takling (motor 10: 1,15 m)
  pokeSpeed: 1.6,
  tackleBase: .34,
  keeperSmother: .72,
  keeperReach: 1.8,         // målmanden når længere ud med hænderne, når han kaster sig       // målmandens chance for at tage bolden fra en dribler i feltet          // grundchance i en takling-duel (justeres af rating, fart, målside og afstand)           // bolden bliver nær forsvareren efter en vellykket takling
  shield: .4,               // skærmning: hvor langt bolden lægges væk fra en nærgående modstander
  blockRange: 5,            // forsvarere inden for 5 m af skytten blokerer bredere …
  blockRadius: .62,         // … med ben og krop (motor 10: 0,43 m)
  aiSprint: 1.22,           // computerspillere kan sprinte (motor 10: aldrig), når de har energi til det
  sprintEnergy: 35
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Motor 11: Math.sqrt er korrekt afrundet efter IEEE-754 (samme resultat i alle JS-motorer) og langt hurtigere end Math.hypot.
const length = (x, y) => Math.sqrt(x * x + y * y);
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
    x: x * sign, y: y * sign, homeX: x * sign, homeY: y * sign, vx: 0, vy: 0, facingX: 0, facingY: -sign,
    keeper: i === 0, shirt:i+1, booking:0, sentOff:false, refresh:0, cooldown: 0, energy: 100, dive: 0, diveX: 0, diveY: 0,
    kick: 0, tackle: 0, touch: 0, gait: 0, action: 'idle', actionTicks: 0, actionDuration: 0,
    possessionTicks: 0, decision: 0, savedShot: -1, receive: 0, role: i === 0 ? 'keeper' : 'shape'
  }));
}

function newBall(team = 'home', index = 10, x = 0, y = 1.2, protection = 16) {
  return {
    x, y, z: .22, vx: 0, vy: 0, vz: 0, curl: 0,
    owner: { team, index }, protected: protection, lastTeam: team,
    lastTouch: { team, index }, lastShooter: null, lastPassFrom: null, assist: null,
    shot: false, shotId: 0, flight: 0, lastTouchTick:0, passTarget: null, receivePoint: null, touchPhase: 0
  };
}

export function createArcade(seed, config = {}) { return createVersionedArcade(seed, config); }

export function createVersionedArcade(seed, config = {}, revision = ENGINE_REVISION) {
  const shapeName = Object.hasOwn(shapes,config.formation) ? config.formation : '4-3-3',shape = shapes[shapeName];
  const personal = { ANG: 10, MID: 6, FOR: 2, 'MÅL': 0 };
  const personalIndex = Object.hasOwn(personal, config.personalPosition) ? personal[config.personalPosition] : null;
  const state = {
    version: ARCADE_VERSION, engineRevision: revision, ...(revision>=5?{surface:config.surface==='wet'?'wet':'dry'}:{}), formation:shapeName, positions:shape.map(p=>[...p]), awayPositions:shape.map(p=>[...p]), field: FIELD,
    tactic: (config.tactic==='attacking'||config.tactic==='defensive'||revision>=5&&config.tactic==='pressing') ? config.tactic : 'balanced',
    tick: 0, rng: hash(seed), homeRating: clamp(Number(config.homeRating) || 48, 1, 99), awayRating: clamp(Number(config.awayRating) || 48, 1, 99),
    skills: { technique: clamp(Number(config.technique) || 48, 1, 99), physical: clamp(Number(config.physical) || 48, 1, 99), reading: clamp(Number(config.reading) || 48, 1, 99) },
    personalIndex, personalRating: clamp(Number(config.personalRating) || Number(config.homeRating) || 48, 1, 99), startingEnergy: clamp(Number(config.fitness) || 100, 25, 100),
    home: formation('home', shape), away: formation('away', shape), controlled: personalIndex ?? 10,
    // Kun til simulationer/tests: computeren styrer også den kontrollerede spiller. Serveren sætter den aldrig.
    ...(config.autopilot === true ? { autopilot: true } : {}),
    homeScore: 0, awayScore: 0, lastMask: 0, freeze: 0, events: [], shotSequence: 0, goalSequence: null,
    substitutions:{home:0,away:0}, refereeEvents:[], advantage:null, possessionTeam:null, turnoverTick:-100, restart:null,
    phase: { home: 'possession', away: 'defending' },
    stats: { ...(revision>=5?{homeXg:0,awayXg:0}:{}), homeShots: 0, awayShots: 0, homeSaves: 0, awaySaves: 0, passes: 0, completedPasses: 0, tackles: 0, userGoals: 0, userAssists: 0, userSaves: 0, userPasses: 0, userPassAttempts: 0, userTackles: 0, homePossession: 0, awayPossession: 0, tacticalChanges:0, homePassAttempts:0, awayPassAttempts:0, homeCompletedPasses:0, awayCompletedPasses:0, homeTackles:0, awayTackles:0 },
    ball: newBall()
  };kickoff(state,'home');captureR4Pose(state);return state;
}

export function directionMask(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude < .18) return 0;
  const direction = ((Math.round(Math.atan2(x, -y) / (Math.PI / 16)) + 32) % 32) + 1;
  return direction | (Math.min(3, Math.max(1, Math.ceil(Math.min(1, magnitude) * 3))) << 6);
}

// The seven exact high-bit commands occupy samples on their own. They may not
// be mixed with movement/actions; the remaining high-bit values stay invalid.
export const TACTICS=Object.freeze(['balanced','attacking','defensive']);
export const FORMATIONS=Object.freeze(['4-3-3','4-4-2','3-5-2','4-5-1']);
export const TACTICAL_COMMANDS=Object.freeze({balanced:32769,attacking:32770,defensive:32771,'4-3-3':32772,'4-4-2':32773,'3-5-2':32774,'4-5-1':32775});
export const commandForTactic=key=>TACTICS.includes(key)?TACTICAL_COMMANDS[key]:null;
export const commandForFormation=key=>FORMATIONS.includes(key)?TACTICAL_COMMANDS[key]:null;
export const isTacticalCommand=mask=>Number.isInteger(mask)&&mask>=32769&&mask<=32775;
export {SUBSTITUTION_COMMAND};
export function validateMask(mask) {
  return mask===SUBSTITUTION_COMMAND||isTacticalCommand(mask)||Number.isInteger(mask) && mask >= 0 && mask < 32768 && (mask & 63) <= 32 && ((mask & 63) === 0 ? ((mask >> 6) & 3) === 0 : ((mask >> 6) & 3) > 0);
}
function applyTacticalCommand(s,mask){
 const key=Object.keys(TACTICAL_COMMANDS).find(key=>TACTICAL_COMMANDS[key]===mask);
 const tactic=TACTICS.includes(key),changed=tactic?s.tactic!==key:s.formation!==key;
 if(!changed)return;
 if(tactic)s.tactic=key;
 else{
  s.formation=key;s.positions=shapes[key].map(p=>[...p]);
  s.home.forEach((p,i)=>{p.homeX=s.positions[i][0];p.homeY=s.positions[i][1];});
 }
 s.stats.tacticalChanges++;
 s.lastTacticalChange={tick:s.tick+1,command:mask,tactic:s.tactic,formation:s.formation};
}

export function encodeInputs(inputs,validate=validateMask,count=INPUT_COUNT) {
  if (inputs.length !== count || !Array.from(inputs).every(validate)) throw Error('Ufuldstændigt kampforløb.');
  const bytes = new Uint8Array(count * 2);
  inputs.forEach((mask, i) => { bytes[i * 2] = mask & 255; bytes[i * 2 + 1] = mask >> 8; });
  return btoa(String.fromCharCode(...bytes));
}
export function decodeInputs(value,validate=validateMask,count=INPUT_COUNT) {
  if (typeof value !== 'string' || value.length !== Math.ceil(count*2/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Ugyldigt kampforløb.');
  const raw = atob(value);if(raw.length!==count*2)throw Error('Ugyldigt kampforløb.');const data = Uint16Array.from({ length: count }, (_, i) => raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8));
  if (!data.every(validate)) throw Error('Ugyldig kampstyring.');
  return data;
}

function animate(p, action, ticks) {
  p.action = action; p.actionTicks = ticks; p.actionDuration = ticks;
  if (action === 'kick') p.kick = ticks;
  if (action === 'tackle') p.tackle = ticks;
  if (action === 'receive') p.receive = ticks;
}

function move(p, tx, ty, speed, arrive = false) {moveLivingPlayer(p,tx,ty,speed,arrive,dt);}

function projection(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const t = square ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / square, 0, 1) : 0;
  return { t, d: length(p.x - a.x - dx * t, p.y - a.y - dy * t) };
}
function laneDanger(s, team, a, b) {
  return s[other(team)].reduce((risk, p) => {
    const { t, d } = projection(p, a, b);
    // Opponents behind the passer or receiver do not close the passing lane.
    return risk + (isActive(p) && t > .05 && t < .95 ? Math.max(0, 2.7 - d) * (p.keeper ? .3 : 1) : 0);
  }, 0);
}
function rating(s, team, index) {
  const base = team === 'away' ? s.awayRating : index === s.personalIndex ? s.skills.technique : s.homeRating;
  return clamp(base - (s[team][index].refresh ? 3 : 0),1,99);
}

export function passTarget(s, team, index, mask = 0) {
  const p = s[team][index], f = forward(team), hasDirection = !!(mask & 63);
  const [dx, dy] = hasDirection ? DIRECTIONS[mask & 63] : [p.facingX * .45, f];
  const norm = length(dx, dy) || 1, through = !!(mask & THROUGH);
  let best = null, bestScore = -Infinity;
  s[team].forEach((mate, i) => {
    if (i === index || !isActive(mate)) return;
    const d = distance(p, mate);
    if (d < 2 || d > (through ? 43 : 49)) return;
    const direction = ((mate.x - p.x) * dx + (mate.y - p.y) * dy) / (d * norm);
    if (hasDirection && direction < -.2) return;
    const progress = (mate.y - p.y) * f;
    const pressure = nearestOpponentDistance(s, team, mate);
    const score = direction * (hasDirection ? 30 : 13) + progress * (through ? .4 : .12) - Math.abs(d - (through ? 22 : 15)) * .22 - laneDanger(s, team, p, mate) * 4.8 + clamp(pressure, 0, 7) * .7 - (mate.keeper ? 12 : 0);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  // A deliberate backward direction is allowed; an empty directional cone falls back to a safe outlet.
  return best === null && hasDirection ? passTarget(s, team, index, mask & ~63 & ~192) : best;
}

// A stable four-pass collision solver keeps every body on the playable pitch.
function separate(s) {
  const radius = 1.16;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < 22; i++) for (let j = i + 1; j < 22; j++) {
      const a = s[i < 11 ? 'home' : 'away'][i % 11], b = s[j < 11 ? 'home' : 'away'][j % 11];
      if (!isActive(a) || !isActive(b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
      if (square >= radius * radius) continue;
      const distance = Math.sqrt(square), angle = (i * 17 + j * 11) * 2.399963229728653;
      const nx = distance > .0001 ? dx / distance : Math.cos(angle);
      const ny = distance > .0001 ? dy / distance : Math.sin(angle);
      const push = (radius - distance) * .5;
      a.x = q(clamp(a.x - nx * push, -29.5, 29.5));
      a.y = q(clamp(a.y - ny * push, -47.4, 47.4));
      b.x = q(clamp(b.x + nx * push, -29.5, 29.5));
      b.y = q(clamp(b.y + ny * push, -47.4, 47.4));
      if (s.engineRevision>=5 && pass===0) {
        if (s.engineRevision===7 && i<11 && j>=11) resolveR7Duel(a,b,nx,ny,s.surface);
        else resolveShoulderMomentum(a,b,nx,ny,s.surface);
      }
    }
  }
}

const RESTART_LABELS = { 'throw-in':'Indkast', 'corner':'Hjørnespark', 'goal-kick':'Målspark', 'free-kick':'Frispark', penalty:'Straffespark', offside:'Offside' };

function refereeEvent(s, kind, team, index, text) {
  const minute = eventMinute(s);
  const event = {kind,side:team,index,tick:s.tick,minute,text};
  s.refereeEvents.push(event);
  if (s.refereeEvents.length > 32) s.refereeEvents.shift();
  s.lastReferee = event;
}

function substitute(s,team,force=false) {
  if (s.substitutions[team] >= 3) return false;
  const owner = s.ball.owner;
  let index = -1, tired = force ? Infinity : 55;
  for (let i=1;i<11;i++) {
    const p = s[team][i];
    if (!isActive(p) || p.refresh || (team === 'home' && i === s.personalIndex) ||
        (owner?.team === team && owner.index === i) || p.energy >= tired) continue;
    tired = p.energy;
    index = i;
  }
  if (index < 0) return false;
  const p = s[team][index], outgoing = p.shirt;
  s.substitutions[team]++;
  Object.assign(p,{energy:100,shirt:11+s.substitutions[team],refresh:1,booking:0,
    vx:0,vy:0,ax:0,ay:0,kick:0,tackle:0,receive:0,cooldown:0,pendingTackle:null,
    action:'idle',actionTicks:0,actionDuration:0});
  refereeEvent(s,'substitution',team,index,`Udskiftning · ${outgoing} ud, ${p.shirt} ind`);
  return true;
}

function nearestActive(s,team,x,y,{outfield=false,exclude=-1}={}) {
  let index=-1, nearest=Infinity;
  for (let i=outfield?1:0;i<11;i++) {
    const p=s[team][i];
    if (i===exclude || !isActive(p)) continue;
    const metric = (p.x-x)**2+(p.y-y)**2;
    if (metric<nearest) { nearest=metric; index=i; }
  }
  return index;
}

function restart(s, team, kind, x, y, indirect=false) {
  s.advantage = null;
  const direction = forward(team);
  if (kind === 'penalty') { x=0; y=direction*37; }
  if (kind === 'free-kick' || kind === 'offside') { x=clamp(x,-28.7,28.7); y=clamp(y,-43,43); }
  const taker = kind==='goal-kick' ? 0 : Math.max(0,nearestActive(s,team,x,y,{outfield:true}));
  const p = s[team][taker];
  Object.assign(p,{x,y,vx:0,vy:0,ax:0,ay:0,cooldown:0,possessionTicks:0,facingX:0,facingY:direction,pendingTackle:null});
  if (team==='home' && s.personalIndex===null) s.controlled=taker;
  s.ball=newBall(team,taker,x,y,0);
  if(s.engineRevision>=5)s.ball.surface=s.surface;
  s.restart={kind,team,tick:s.tick,x,y,taker,indirect,released:false};
  s.freeze=kind==='penalty'?28:kind==='free-kick'?(s.engineRevision>=5&&team==='home'?60:22):13;
  s.shotCharge=0;
  s.passCharge=0;
  setPieceLayout(s,team,kind,s.restart,taker);
  refereeEvent(s,kind,team,taker,RESTART_LABELS[kind]);
  if (s.tick>2700) for (const side of SIDES) substitute(s,side,side==='home'&&s.substitutionRequested);
  s.substitutionRequested=false;
}

function callFoul(s, team, index, victim, severity) {
  if (s.advantage) return;
  const p=s[team][index], beneficiary=other(team);
  s.stats[team+'Fouls']=(s.stats[team+'Fouls']||0)+1;
  if(severity>=2) {
    const red=severity===3 || p.booking>0;
    p.booking++;
    p.sentOff=red;
    p.pendingTackle=null;
    if(red&&team==='home'&&s.controlled===index) {
      s.controlled=Math.max(0,nearestActive(s,'home',s.ball.x,s.ball.y));
      if(s.personalIndex===index)s.personalIndex=null;
    }
    s.stats[team+(red?'Reds':'Yellows')]=(s.stats[team+(red?'Reds':'Yellows')]||0)+1;
    refereeEvent(s,red?'red-card':'yellow-card',team,index,red?'Rødt kort':'Gult kort');
  }
  if (inPenaltyArea(team,victim.x,victim.y)) {
    restart(s,beneficiary,'penalty',victim.x,victim.y);
  } else if (severity<3 && s.ball.owner?.team===beneficiary && victim.vy*forward(beneficiary)>2.8) {
    s.advantage={team:beneficiary,x:victim.x,y:victim.y,until:s.tick+22};
    refereeEvent(s,'advantage',beneficiary,s.ball.owner.index,'Fordel · spil videre');
  } else {
    restart(s,beneficiary,'free-kick',victim.x,victim.y);
  }
}

function autoRestart(s) {
  const r=s.restart;
  if(!r || r.released) return;
  r.released=true;
  const {team,taker,kind}=r;
  const p=s[team][taker];
  const direct=kind==='penalty' || (kind==='free-kick'&&!r.indirect&&(r.choice==='shot'||r.choice!=='pass'&&48-p.y*forward(team)<25&&Math.abs(p.x)<14));
  const target=kind==='goal-kick' ? longestOutlet(s,team) :
    passTarget(s,team,taker) ?? nearestActive(s,team,p.x,p.y,{exclude:taker});
  if (!direct && (target===null || target<0)) return;
  kick(s,team,taker,direct,0,{target,loft:kind==='corner'||kind==='goal-kick'||kind==='throw-in',restart:kind});
  if(r.indirect)s.ball.indirectTeam=team;
}

function nearestOpponentDistance(s, team, p) {
  let best = Infinity;
  for (const op of s[other(team)]) if (!op.keeper && isActive(op)) best = Math.min(best, distance(p, op));
  return best;
}

// Motor 11: afleveringer og skud har en realistisk, deterministisk usikkerhed, som
// vokser med pres, afstand og lavere rating. Afleveringsfarten er vægtet efter
// afstanden, og computerens skud placeres væk fra målmanden.
function kick(s, team, index, shoot, mask = 0, options = {}) {
  const p = s[team][index], b = s.ball;
  if (!isActive(p) || p.cooldown > 0 || b.owner?.team !== team || b.owner.index !== index) return false;
  const f = forward(team), skill = rating(s, team, index), user = team === 'home' && index === s.controlled && !s.autopilot;
  const pressure = nearestOpponentDistance(s, team, p), pressureFactor = 1 + Math.max(0, 3 - pressure) / 3 * .8;
  const penalty = options.restart === 'penalty';
  const setShot = shoot && options.restart === 'free-kick';
  b.offsideMask = identifyOffside(s,team,index,options.restart);
  b.offsideTeam = b.offsideMask ? team : null;
  b.indirectTeam = null;
  let tx, ty, speed, vz, kind, target = null;
  if (shoot) {
    const [dx, dy] = DIRECTIONS[mask & 63], power = options.restart ? .74 + random(s)*.14 : user ? clamp((s.shotCharge || 0) / 18, .18, 1) : .6 + random(s) * .3;
    const goalDistance = Math.max(2, 48 - p.y * f), directional = !!(mask & 63);
    const keeper = s[other(team)][0], keeperSide = Math.abs(keeper.x) > .25 ? Math.sign(keeper.x) : (p.x ? Math.sign(p.x) : 1);
    // Brugerens sigte er uændret fra motor 10 (retning, ellers langt hjørne fra skytten).
    // Computerens spillere vælger hjørnet væk fra målmanden.
    const aim = directional && Math.abs(dx) > .12 ? dx * 3.3 : user ? (p.x ? -Math.sign(p.x) : random(s) < .5 ? -1 : 1) * (2.25 + power * .55) : -keeperSide * (2.2 + random(s) * 1.5);
    const angle = Math.abs(p.x) / (goalDistance + 1);
    const spread = (2.25 - skill * .017) * (1 + Math.max(0, goalDistance - 16) / 30) * pressureFactor * (.8 + power * .4) * (1 + angle * .5);
    const error = (random(s) + random(s) - 1) * spread * (penalty ? .5 : 1);
    tx = aim + error; ty = f * 49.5;
    if (directional && dy * f < -.55) { tx = p.x + dx * 35; ty = p.y + dy * 35; }
    speed = 23 + power * 15 + skill * .018;
    const flightTime = length(tx - p.x, ty - p.y) / (speed * .9);
    const targetHeight = user ? .35 + power * .65 : goalDistance < 14 ? .3 + random(s) * .55 : .45 + random(s) * 1.25;
    const heightError = (random(s) - .5) * spread * .3;
    vz = clamp((targetHeight + heightError - .24) / Math.max(.15, flightTime) + 4.905 * flightTime, 1.1, 9.2);
    b.lastShooter = { team, index }; b.assist = b.lastPassFrom?.team === team && b.lastPassFrom.index !== index ? { ...b.lastPassFrom } : null;
    b.lastPassFrom = null; b.shot = true; b.shotId = ++s.shotSequence; b.passTarget = null; b.receivePoint = null;
    // Skruens fortegn virker i forhold til flugtretningen (fysikken drejer hastigheden).
    // Computerens skud skal altid skrue væk fra målmanden – uanset hvilken vej holdet spiller.
    b.curl = directional ? dx * (1 - power) * .8 : user ? -Math.sign(p.x) * (1 - power) * .45 : keeperSide * f * (1 - power) * .5;
    if(setShot)b.curl=(p.x>0?-1:1)*f*(2+skill*.017);
    b.flightKind='shot';
    s.lastAction = { kind: 'shot', team, index, power, tick: s.tick };
    s.stats[team === 'home' ? 'homeShots' : 'awayShots']++;
    if(s.engineRevision>=5)s.stats[team+'Xg']=q((s.stats[team+'Xg']||0)+(penalty?.76:shotQuality(s,team,p)));
  } else {
    target = options.target ?? passTarget(s, team, index, mask);
    if (target === null || target < 0 || target === index || !isActive(s[team][target])) return false;
    if (!options.restart && team === 'home' && s.personalIndex !== null && index !== s.personalIndex && s.callForPass > 0) { target = s.personalIndex; s.callForPass = 0; }
    const mate = s[team][target], through = !!(mask & THROUGH), d = distance(p, mate);
    const loft = options.loft || (user && (s.passCharge || 0) >= 9);
    speed = loft ? clamp(d * .72, 22, 32) : passSpeedFor(d, through, s.surface);
    const arrival = passArrival(p, mate, f, speed, through, loft, 6.25 + (team === 'home' ? s.homeRating : s.awayRating) * .021,s.surface);
    // Retningsfejl i radianer og en lille fartfejl.
    const division=Math.hypot(arrival.x-p.x,arrival.y-p.y)||1;
    const bodyAngle=1-clamp(((arrival.x-p.x)*p.facingX+(arrival.y-p.y)*p.facingY)/division,-1,1);
    const spread = (options.restart==='kickoff' ? 0 : clamp(.048 - skill * .00037, .009, .05)) * (1+bodyAngle*.32) * pressureFactor * (loft ? 1.3 : 1) * (through ? 1.15 : 1);
    const turn = (random(s) * 2 - 1) * spread, cos = Math.cos(turn), sin = Math.sin(turn);
    const ax = arrival.x - p.x, ay = arrival.y - p.y;
    tx = clamp(p.x + ax * cos - ay * sin, -29.4, 29.4); ty = clamp(p.y + ax * sin + ay * cos, -47.4, 47.4);
    speed = q(speed * (1 + (random(s) - .5) * spread * .8));
    const travel = length(tx - b.x, ty - b.y) / speed;
    vz = loft ? clamp(4.905 * travel / .9 + .4, 4.3, 9.2) : 0;
    kind = through ? 'through' : loft ? 'loft' : 'pass';
    b.flightKind=loft?'loft':through?'through':'pass';
    b.lastPassFrom = { team, index }; b.passCounted=false; b.lastShooter = null; b.assist = null; b.shot = false; b.curl = loft?clamp((tx-p.x)/Math.max(4,d),-1,1)*1.25:through?.14:0;
    b.passTarget = { team, index: target }; b.receivePoint = { x: tx, y: ty, through };
    s.lastAction = { kind, team, index, target, tick: s.tick };
    s.stats[team+'PassAttempts']++;
    if (team === 'home') { s.stats.passes++; if (index === s.personalIndex) s.stats.userPassAttempts++; }
  }
  const dx = tx - p.x, dy = ty - p.y, d = length(dx, dy) || 1;
  p.kickFacingX=dx/d;p.kickFacingY=dy/d;turnFacing(p,dx/d,dy/d,dt);
  if(options.restart&&options.restart!=='kickoff'){b.x=p.x;b.y=p.y;}
  const throwIn=options.restart==='throw-in';
  b.owner = null; b.vx = dx / d * speed + p.vx * .12; b.vy = dy / d * speed + p.vy * .12;
  b.vz = throwIn ? Math.max(4,vz) : vz;
  if((s.engineRevision===6||s.engineRevision===7)&&!options.restart){
    applyStrikeMechanics(b,p,skill,pressure);
    const pace=length(b.vx,b.vy)||1;
    p.kickFacingX=b.vx/pace;p.kickFacingY=b.vy/pace;
  }
  if(s.engineRevision===7&&setShot){
    // Keep the standard restart and release, but set a repeatable curved flight.
    b.curl*=1.24;
  }
  b.z = throwIn ? 1.85 : Math.max(.22,b.z); b.lastTouchTick=s.tick; b.lastTeam = team; b.lastTouch = { team, index }; b.protected = 2; b.flight = 0;
  p.cooldown = shoot ? 15 : 8; p.possessionTicks = 0; animate(p, 'kick', shoot ? 10 : 7);
  if (user) { s.shotCharge = 0; s.passCharge = 0; }
  return true;
}

// Motor 11: én fælles boldfysik bruges både af den rigtige bold og af alle
// forudsigelser (modtagelse, afleveringsfart, målmandens reaktion), så spillerne
// planlægger efter præcis den bevægelse, bolden faktisk får.
function ballPhysics(b) {integrateMatchBall(b,dt);}

function ballCopy(b) { return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, curl: b.curl || 0, flightKind:b.flightKind, ...(b.surface?{surface:b.surface}:{}) }; }
/** Ét tick af motor 11's boldfysik på en kopi (ingen spillerkontakter). Bruges af tests og visning. */
export function stepBallPhysics(ball) { const next = ballCopy(ball); ballPhysics(next); return next; }

function projectedRun(p, dx, dy, pace, seconds) {
 const projected={...p};for(let left=seconds;left>1e-8;){const span=Math.min(dt,left);moveLivingPlayer(projected,projected.x+dx*10,projected.y+dy*10,pace,false,span);left-=span;}
 return{x:clamp(projected.x,-28.2,28.2),y:clamp(projected.y,-44.8,44.8)};
}
/** Rulletid og fart ved ankomst for en jordaflevering med motor 11's rullemodstand. */
function groundRoll(distance, speed, kind = 'pass',surface) {
  if(surface)return estimateGroundFlight(distance,speed,kind,surface);
  const b = { x: 0, y: 0, z: .22, vx: speed, vy: 0, vz: 0, curl: 0, flightKind:kind };
  let time = 0;
  while (time < 4) {
    const before = b.x;
    ballPhysics(b); time += dt;
    // Lineær interpolation inden for det tick, hvor bolden passerer afstanden.
    if (b.x >= distance) return { time: time - dt + dt * (distance - before) / Math.max(1e-6, b.x - before), speed: b.vx };
    if (b.vx <= .05) return { time: Infinity, speed: 0 };
  }
  return { time, speed: b.vx };
}
function rollingTime(distance, speed, through=false,surface) { const roll = groundRoll(distance, speed, through?'through':'pass',surface); return Number.isFinite(roll.time) ? roll.time : 4; }
/** Afspark-fart, så en jordaflevering ankommer med en kontrollerbar fart. */
export function passSpeedFor(distance, through = false,surface) {
  const [low, high] = ENGINE.passArrivalSpeed, wanted = clamp(low + distance * .13 + (through ? 1.5 : 0), low, high);
  let min = 8, max = 34;
  for (let i = 0; i < 14; i++) { const mid = (min + max) / 2, roll = groundRoll(distance, mid, through?'through':'pass',surface); if (!Number.isFinite(roll.time) || roll.speed < wanted) min = mid; else max = mid; }
  return q(clamp(max, 9, 34));
}
function passArrival(p,mate,f,speed,through,loft,basePace,surface) {
  const moving=length(mate.vx,mate.vy),dx=mate.x-p.x,dy=mate.y-p.y,d=length(dx,dy)||1;
  const runningForward=moving>1.5&&mate.vy*f/moving>.15;
  const nx=runningForward?mate.vx/moving:dy*f/d>.15?dx/d:0,ny=runningForward?mate.vy/moving:dy*f/d>.15?dy/d:f;
  let point={x:mate.x,y:mate.y},time=loft?d/(speed*.9):rollingTime(Math.max(0,d-.8),speed,through,surface);
  for(let i=0;i<6;i++){
    point=through&&!loft?projectedRun(mate,nx,ny,basePace*1.08,Math.max(0,time-.06)):{x:clamp(mate.x+mate.vx*Math.min(.55,time*.7),-28.2,28.2),y:clamp(mate.y+mate.vy*Math.min(.55,time*.7),-44.8,44.8)};
    const distance=length(point.x-p.x,point.y-p.y);
    time=loft?distance/(speed*.9):rollingTime(Math.max(0,distance-.8),speed,through,surface);
  }
  return point;
}

// Modtageren følger bolden ad den forudsagte bane med samme fysik som bolden.
function receiveIntercept(b,p,pace) {
  if(b.receivePoint?.through&&(b.x-b.receivePoint.x)*b.vx+(b.y-b.receivePoint.y)*b.vy<0)return b.receivePoint;
  const ball=ballCopy(b);let point=b.receivePoint||{x:ball.x,y:ball.y};
  for(let step=1;step<=40;step++){
    ballPhysics(ball);
    if(Math.abs(ball.x)>29||Math.abs(ball.y)>46)break;
    const t=step*dt,reach=length(ball.x-p.x,ball.y-p.y),toward=reach?((ball.x-p.x)*p.vx+(ball.y-p.y)*p.vy)/reach:0;
    const accelerationTime=clamp((pace-toward)/25,0,t),run=pace*t-(pace-toward)*accelerationTime*.5;
    if(ball.z<=CONTACT.footHeight&&reach<=Math.max(0,run)+.08){point={x:ball.x,y:ball.y};break;}
    if(!b.receivePoint||(ball.x-b.receivePoint.x)*ball.vx+(ball.y-b.receivePoint.y)*ball.vy>0)point={x:ball.x,y:ball.y};
    if(length(ball.vx,ball.vy)<.05){point={x:ball.x,y:ball.y};break;}
  }
  return point;
}

/** Hvor og hvornår krydser bolden en mållinje (y = lineY)? Samme fysik som bolden. */
function predictCrossing(b, lineY, maxTicks = 40) {
  const ball = ballCopy(b);
  for (let tick = 1; tick <= maxTicks; tick++) {
    const beforeY = ball.y; ballPhysics(ball);
    if ((beforeY - lineY) * (ball.y - lineY) <= 0 && beforeY !== ball.y) return { x: ball.x, z: ball.z, ticks: tick };
    if (length(ball.vx, ball.vy) < .2) return null;
  }
  return null;
}

function kickoff(s, team) {
  const roster = {home:s.home,away:s.away};
  s.home = formation('home', s.positions); s.away = formation('away', s.awayPositions);
  for(const side of SIDES)s[side].forEach((p,i)=>{
    const old=roster[side][i];
    Object.assign(p,{energy:old.energy,shirt:old.shirt,booking:old.booking,sentOff:old.sentOff,refresh:old.refresh});
  });
  const sign=team==='home'?1:-1;
  for(const side of ['home','away'])for(let i=1;i<s[side].length;i++){const p=s[side][i],half=side==='home'?1:-1;p.y=half*Math.max(.6,Math.abs(p.y));if(side!==team&&length(p.x,p.y)<9.15){const d=length(p.x,p.y)||1;p.x=p.x/d*9.3;p.y=half*Math.max(.6,Math.abs(p.y/d*9.3));}}
  const taker = isActive(s[team][10]) ? 10 : Math.max(0,nearestActive(s,team,0,0,{outfield:true}));
  Object.assign(s[team][taker],{x:0,y:sign*.55,facingX:0,facingY:-sign});
  const receiver = isActive(s[team][6]) && taker !== 6 ? 6 : nearestActive(s,team,0,4*sign,{outfield:true,exclude:taker});
  if(receiver>=0)Object.assign(s[team][receiver],{x:2.35,y:sign*4.2});
  s.controlled=s.personalIndex??(team==='home'?taker:Math.max(0,nearestActive(s,'home',0,0,{outfield:true})));
  s.ball=newBall(team,taker,0,0,22); if(s.engineRevision>=5)s.ball.surface=s.surface; s.openingKickoff=team; s.kickoffTaker=taker; s.kickoffReceiver=receiver;
  s.restart=null; s.advantage=null;
  s.freeze = 24; s.skillTicks = 0; s.shotCharge = 0; s.passCharge = 0;
}

function beginGoalSequence(s, team, scorer, assister, crossing) {
  const anchor=scorer===null?{x:crossing.x,y:Math.sign(crossing.y)*43}:s[team][scorer];
  const celebrants=scorer===null?[]:[scorer,...s[team].map((p,i)=>({i,d:distance(p,anchor)}))
    .filter(({i,d})=>i!==scorer&&i>0&&d<18).sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,2).map(p=>p.i)];
  s.goalSequence={stage:'net',startedTick:s.tick,elapsedTicks:0,stageTicks:0,
    remainingTicks:GOAL_TIMING.netTicks+GOAL_TIMING.celebrationTicks+GOAL_TIMING.kickoffTicks,
    team,scorer,assister,celebrants,kickoffTeam:other(team),netSide:Math.sign(crossing.y),
    point:{x:crossing.x,y:crossing.y,z:crossing.z},impact:null,
    celebrationPoint:{x:clamp(anchor.x+(anchor.x<0?-3:3),-27,27),y:clamp(anchor.y-Math.sign(crossing.y)*2,-43,43)}};
  Object.assign(s.ball,{owner:null,x:crossing.x,y:crossing.y,z:Math.max(.22,crossing.z),
    protected:0,shot:false,passTarget:null,receivePoint:null,curl:0});
  s.freeze=0;s.restart=null;s.advantage=null;s.skillTicks=0;s.shotCharge=0;s.passCharge=0;
}

// This is the scored ball, not a new animation projectile. It keeps its actual
// incoming velocity, collides with the matching goal's net and loses energy.
function advanceGoalBall(s) {
  const b=s.ball,g=s.goalSequence,side=g.netSide;
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt-4.905*dt*dt;b.vz-=9.81*dt;b.flight++;
  const impact=(surface,speed)=>{g.impact={tick:s.tick,x:b.x,y:b.y,z:b.z,
    strength:q(clamp(Math.abs(speed)/24,.08,1)),surface};};
  const back=FIELD.length/2+2-.22,width=FIELD.goalWidth/2-.22,roof=FIELD.goalHeight-.22;
  if(b.y*side>back){const speed=b.vy;b.y=side*back;b.vy=-side*Math.abs(speed)*.08;b.vx*=.55;b.vz*=.6;impact('back',speed);}
  if(Math.abs(b.x)>width&&b.y*side>=FIELD.length/2){const speed=b.vx;b.x=Math.sign(b.x)*width;b.vx=-Math.sign(b.x)*Math.abs(speed)*.12;impact('side',speed);}
  if(b.z>roof&&b.y*side>=FIELD.length/2){const speed=b.vz;b.z=roof;b.vz=-Math.abs(speed)*.12;impact('roof',speed);}
  if(b.z<.22){b.z=.22;b.vz=Math.abs(b.vz)>1.1?-b.vz*.24:0;}
  const friction=b.z===.22?.91:.986;b.vx*=friction;b.vy*=friction;
  for(const key of ['vx','vy','vz'])if(Math.abs(b[key])<.015)b[key]=0;
  for(const key of ['x','y','z','vx','vy','vz'])b[key]=q(b[key]);
}

function advanceGoalSequence(s) {
  const g=s.goalSequence,total=GOAL_TIMING.netTicks+GOAL_TIMING.celebrationTicks+GOAL_TIMING.kickoffTicks;
  g.elapsedTicks=s.tick-g.startedTick;g.remainingTicks=Math.max(0,total-g.elapsedTicks);
  if(g.elapsedTicks>=total){s.goalSequence=null;s.freeze=0;return;}
  const kickoffAt=GOAL_TIMING.netTicks+GOAL_TIMING.celebrationTicks;
  if(g.elapsedTicks>=kickoffAt){
    if(g.stage!=='kickoff'){kickoff(s,g.kickoffTeam);g.stage='kickoff';}
    g.stageTicks=g.elapsedTicks-kickoffAt;s.freeze=g.remainingTicks;return;
  }
  g.stage=g.elapsedTicks<GOAL_TIMING.netTicks?'net':'celebration';
  g.stageTicks=g.stage==='net'?g.elapsedTicks:g.elapsedTicks-GOAL_TIMING.netTicks;
  advanceGoalBall(s);
  for(const team of ['home','away'])s[team].forEach((p,i)=>{
    if(!isActive(p))return;
    const celebrating=team===g.team&&g.stage==='celebration'&&g.celebrants.includes(i);
    if(celebrating){
      const place=g.celebrants.indexOf(i),offset=place===0?0:place===1?-1.4:1.4;
      move(p,g.celebrationPoint.x+offset,g.celebrationPoint.y+(place?1.1:0),i===g.scorer?2.6:3.2);
      p.role='celebrating';
    }else move(p,p.x,p.y,0);
  });
  separate(s);
}

function startDive(p, dx, dy, impulse = 5.5) {
  const d = length(dx, dy) || 1;
  p.dive = 10; p.diveX = dx / d; p.diveY = dy / d; p.cooldown = 24; animate(p, 'dive', 10);
  // Motor 11: eksplosivt afsæt – målmanden starter dykket med fart i stedet for fra stilstand.
  p.vx = q(p.vx * .3 + p.diveX * impulse); p.vy = q(p.vy * .3 + p.diveY * impulse);
}

/** Den mest fremskudte, frie medspiller til et langt udspark. */
function longestOutlet(s, team) {
  const f = forward(team); let best = null, score = -Infinity;
  s[team].forEach((mate, i) => { if (i === 0 || !isActive(mate)) return; const value = mate.y * f * .5 + Math.min(8, nearestOpponentDistance(s, team, mate)) * 1.5; if (value > score) { score = value; best = i; } });
  return best;
}

// Motor 11: målmanden står på halveringslinjen mellem bolden og målets midte, læser
// skud med en ratingafhængig reaktionstid ud fra den forudsagte bane, går ud mod
// en fri angriber, og vælger kort eller langt udspark ud fra presset.
function keeperAI(s, team, p) {
  const b = s.ball, f = forward(team), skill = team === 'home' ? s.homeRating : s.awayRating, goalY = -f * 48;
  const base = 4.8 + skill * .014;
  p.role = 'keeper';
  if (b.owner?.team === team && b.owner.index === 0) {
    move(p, clamp(p.x, -9, 9), -f * 40, 4.2, true);
    if (p.possessionTicks > (s.engineRevision>=5&&nearestOpponentDistance(s,team,p)<6?8:12) && p.cooldown === 0) {
      const target = passTarget(s, team, 0);
      const safe = target !== null && laneDanger(s, team, p, s[team][target]) < 1.6 && nearestOpponentDistance(s, team, s[team][target]) > 4;
      if (safe) kick(s, team, 0, false);
      else { const outlet = longestOutlet(s, team); if (outlet !== null) kick(s, team, 0, false, 0, { target: outlet, loft: true }); }
    }
    return;
  }
  if (b.shot && !b.owner && b.lastShooter?.team !== team && b.vy * -f > 2) {
    const crossing = predictCrossing(b, goalY, 40);
    if (crossing && Math.abs(crossing.x) < 4.8) {
      p.role = 'save';
      const reaction = Math.max(1, Math.round(ENGINE.keeperReaction[0] - skill * ENGINE.keeperReaction[1]));
      if (b.flight >= reaction) {
        // Redningen sker dér, hvor bolden passerer målmandens egen dybde – ikke på mållinjen.
        const plane = predictCrossing(b, p.y, 40) || crossing, lateral = plane.x - p.x;
        // Dyk kun, når bolden er uden for rækkevidde stående (hænder ≈ 0,8 m) eller høj.
        if (p.cooldown === 0 && p.dive === 0 && (Math.abs(lateral) > .85 || plane.z > 1.7) && plane.ticks <= 12 + Math.round(skill * .05)) startDive(p, lateral, 0, clamp(Math.abs(lateral) * 3, 2, 5.5));
        // Hænderne – ikke kroppen – skal i boldens bane; bremse op i stedet for at skyde forbi.
        const reach = p.dive > 0 ? .4 : 0, side = Math.sign(lateral) || 1;
        move(p, clamp(plane.x - side * reach, -4.2, 4.2), p.y, p.dive > 0 ? 10.2 + skill * .02 : base + 1.2, true);
      } else move(p, p.x, p.y, base, true);
      return;
    }
  }
  if (s.engineRevision>=5&&!b.owner&&!b.shot&&b.flightKind==='loft'&&b.y*-f>28&&b.vy*-f>2) {
    const line=-f*clamp(Math.abs(b.y)+5,34,42);
    const cross=predictCrossing(b,line,18);
    if(cross&&cross.z<2.12&&cross.z>.65&&Math.abs(cross.x)<11&&Math.hypot(cross.x-p.x,line-p.y)<2+cross.ticks*dt*(base+1.8)){
      p.role='claim';move(p,cross.x,line,base+1.8,true);return;
    }
  }
  if (!b.owner && Math.abs(b.y) > 31 && b.y * -f > 0 && Math.abs(b.x) < 17 && length(b.vx, b.vy) < 18) {
    const opponent = nearestOpponentDistance(s, team, b);
    if (distance(p, b) < opponent + 1.6) { p.role = 'sweeper'; move(p, b.x + b.vx * .18, clamp(b.y + b.vy * .18, -46, 46), base + 1.5); return; }
  }
  const toX = b.x, toY = b.y - goalY, ballDistance = length(toX, toY) || 1;
  const carrier = b.owner?.team === other(team) ? s[other(team)][b.owner.index] : null;
  let r = ballDistance > 30 ? 4.2 : 2.2 + ballDistance * .06;
  // En dribler helt tæt på målet: gå direkte i fødderne på ham (motor 10 lod ham drible i mål).
  if (carrier && ballDistance < 9 && Math.abs(b.x) < 9) {
    p.role = 'rush';
    if (distance(p, b) < ENGINE.keeperReach && p.cooldown === 0 && b.protected === 0) attemptTackle(s, team, 0);
    // Stil dig mellem bolden og målet (ikke bag angriberen), og kast dig i fødderne derfra.
    const gx = 0 - b.x, gy = goalY - b.y, gl = length(gx, gy) || 1;
    move(p, b.x + b.vx * .15 + gx / gl * .9, clamp(b.y + b.vy * .15 + gy / gl * .9, -46.8, 46.8), base + 2);
    return;
  }
  if (carrier && ballDistance < 17 && Math.abs(carrier.x) < 11 && laneDanger(s, other(team), carrier, { x: 0, y: goalY }) < .8) {
    p.role = 'rush'; r = clamp(ballDistance * .45, 2.5, 6);
    if (distance(p, b) < 1.5 && p.cooldown === 0 && b.protected === 0) attemptTackle(s, team, 0);
  }
  move(p, clamp(toX / ballDistance * r, -3.6, 3.6), clamp(goalY + toY / ballDistance * r, -46.6, 46.6), base + (p.role === 'rush' ? 1.5 : 0), true);
}

// Holdkoordinater: t = y·f (positiv mod modstanderens mål).
function lastLineT(s, team) { return Math.max(0,s.ball.y*forward(team),secondLastOpponent(s,team)); }
/** Hvor farlig er en position for holdet (cirka chancen for, at besiddelse dér bliver til mål)? */
function threat(team, x, y) { const t = y * forward(team), d = length(x, 48 - t), central = 1 - Math.min(1, Math.abs(x) / 30); return Math.exp(-d / 12) * .35 * (.5 + .5 * central); }
/** Skudkvalitet (xG-lignende) ud fra afstand, vinkel, blokerede skudlinjer og målmandens placering. */
export function shotQuality(s, team, p) {
  const f = forward(team), depth = Math.max(.5, 48 - p.y * f), angle = Math.abs(Math.atan2(p.x + 4, depth) - Math.atan2(p.x - 4, depth));
  const lane = laneDanger(s, team, p, { x: 0, y: f * 48 }), keeper = s[other(team)][0], keeperGap = clamp(Math.abs(keeper.x - p.x * .2) / 4, 0, .5);
  return clamp(angle * .55 * Math.exp(-Math.max(0, length(p.x, depth) - 6) / 14) * (1 - Math.min(.6, lane * .15)) * (1 + keeperGap), 0, .65);
}
/** Holdets fælles blok: én forsvarskæde, kompakte linjer, sideforskydning mod bolden. */
function shapeTarget(s, team, i, own) {
  const f = forward(team), sign = -f, b = s.ball, anchor = (team === 'home' ? s.positions : s.awayPositions)[i];
  const intent = team === 'home' ? s.tactic === 'attacking' ? 1 : s.tactic === 'defensive' ? -1 : 0 : 0;
  const ballT = b.y * f, anchorT = -anchor[1], band = anchor[1] >= 25 ? 0 : anchor[1] > 3 ? 1 : 2;
  const press=team==='home'&&s.tactic==='pressing';
  const shift=press?4:0;
  const back = own ? clamp(ballT - 22 + intent * 3, -36, 8) : clamp(ballT - 12 + intent * 2+shift, -37, 2+shift);
  // Forsvarskæden (band 0) står på én linje; midtbane og angreb beholder lidt forskydning.
  const compact = s.engineRevision===7 && !own && intent<0;
  const lineT = back + (own ? [0, 15, 29] : compact ? [0, 7, 14] : [0, 9, 17])[band] + (band === 0 ? 0 : (anchorT - [-28, -12, -1][band]) * .5);
  return { x: clamp(anchor[0] * sign * (own ? 1.03 : compact ? .57 : .65) + clamp(b.x * .35, -9, 9), -27, 27), y: clamp(lineT * f, -43.5, 43.5), band };
}
function paceFor(p, base) { return base * (ENGINE.fatigue.floor + (1 - ENGINE.fatigue.floor) * p.energy / 100); }
/** Sprint for computerspillere: kun med nok energi; trætheden (tire) tærer på energien. */
function sprintFor(p, base) { return paceFor(p, base) * (p.energy > ENGINE.sprintEnergy ? ENGINE.aiSprint : 1); }
function tire(p, base) {
  const fast = length(p.vx, p.vy) > base * .85;
  p.energy = q(clamp(p.energy + (fast ? -ENGINE.fatigue.sprintDrain : ENGINE.fatigue.recovery) * dt, 0, 100));
}
function supportSpot(s, team, i, p, carrier, base) {
  const f = forward(team); let best = base, score = -Infinity;
  for (const ox of [-6, 0, 6]) for (const oy of [-5, 0, 5]) {
    const spot = { x: clamp(base.x + ox, -27, 27), y: clamp(base.y + oy * f, -43.5, 43.5) };
    let crowd = 0; for (let m = 1; m < s[team].length; m++) if (m !== i && isActive(s[team][m]) && distance(s[team][m], spot) < 6) crowd++;
    const value = Math.min(8, nearestOpponentDistance(s, team, spot)) - laneDanger(s, team, carrier, spot) * 2.2 - crowd * 1.5 + (spot.y - carrier.y) * f * .08 - distance(p, spot) * .05;
    if (value > score) { score = value; best = spot; }
  }
  return best;
}

function ai(s, team) {
  const players = s[team], opponents = s[other(team)], b = s.ball, f = forward(team);
  const skill = team === 'home' ? s.homeRating : s.awayRating;
  const intent = team === 'home' ? s.tactic === 'attacking' ? 1 : s.tactic === 'defensive' ? -1 : 0 : 0;
  const own = b.owner?.team === team, defend = !!b.owner && !own;
  // Ejeren gemmes ved turens start: boldholderen kan sparke midt i holdets tur.
  const ownerIndex = b.owner ? b.owner.index : -1;
  const carrier = own ? players[ownerIndex] : null, opponentCarrier = defend ? opponents[ownerIndex] : null;
  s.phase[team] = own ? 'possession' : defend ? 'defending' : 'transition';
  const intercept = { x: clamp(b.x + b.vx * .25, -29, 29), y: clamp(b.y + b.vy * .25, -46, 46) };
  const pressing=team==='home'&&s.tactic==='pressing';
  const counterpress = defend && s.tick-s.turnoverTick<(pressing?55:32);
  let presser=-1,coverer=-1,best=Infinity,second=Infinity;
  for(let i=1;i<11;i++) {
    const p=players[i];
    if(!isActive(p)||(team==='home'&&i===s.controlled&&!s.autopilot))continue;
    const d=distance(p,b.owner?b:intercept)+(p.role==='press'?-1.3:0);
    if(d<best){second=best;coverer=presser;best=d;presser=i;}
    else if(d<second){second=d;coverer=i;}
  }
  const marked = new Set(), lastLine = lastLineT(s, team), ownGoal = { x: 0, y: -f * 48 };
  let outlets=null;
  if(s.engineRevision===7&&carrier&&!carrier.keeper){
    outlets=supportPlans.get(s);
    if(!outlets){outlets=createSupportTriangle();supportPlans.set(s,outlets);}
    planSupportTriangle(players,opponents,carrier,f,lastLine,
      team==='home'?s.tactic:'balanced',team==='home'&&!s.autopilot?s.controlled:-1,outlets);
  }
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!isActive(p)) continue;
    if (team === 'home' && i === s.controlled && !s.autopilot) { p.role = 'controlled'; continue; }
    if (p.keeper) { keeperAI(s, team, p); continue; }
    const base = (6.25 + skill * .021) * (p.tackle > 0 ? .42 : p.kick > 4 ? .65 : 1), pace = paceFor(p, base);
    if (own && ownerIndex === i) {
      p.role = 'carrier';
      const pressure = nearestOpponentDistance(s, team, p);
      if (p.decision === 0 && p.cooldown === 0) {
        const [low, high] = ENGINE.decisionTicks; p.decision = low + Math.floor(random(s) * (high - low + 1));
        const noise = () => (random(s) - .5) * .03 * (100 - skill) / 50;
        const xg = shotQuality(s, team, p) * (1 + intent * .15);
        let best = null, bestValue = -Infinity, bestThrough = false;
        players.forEach((mate, m) => {
          if (m === i || !isActive(mate) || mate.y*f>lastLine+.04 || (mate.keeper && pressure > 3)) return;
          const d = distance(p, mate); if (d < 3 || d > 45) return;
          const lane = laneDanger(s, team, p, mate), open = nearestOpponentDistance(s, team, mate);
          const pc = clamp(.97 - lane * .16 - Math.max(0, 3.5 - open) * .09 - Math.max(0, d - 25) * .012, .05, .97);
          let value = pc * threat(team, mate.x, mate.y) - (1 - pc) * .04 + noise(), through = false;
          if (length(mate.vx, mate.vy) > 4 && mate.vy * f > 2 && (mate.y - p.y) * f > 3) {
            const spot = { x: mate.x + mate.vx * .6, y: mate.y + mate.vy * .6 }, chance = clamp(.9 - laneDanger(s, team, p, spot) * .2, .05, .9);
            const runValue = chance * threat(team, spot.x, spot.y) - (1 - chance) * .04 + noise();
            if (runValue > value) { value = runValue; through = true; }
          }
          if (value > bestValue) { bestValue = value; best = m; bestThrough = through; }
        });
        const keep = clamp(.92 - Math.max(0, 4 - pressure) * .13, .3, .95);
        // Driblingsretning: den åbneste af fem retninger fremad.
        let dirX = 0, dirY = f, space = -Infinity;
        for (const angle of [-.9, -.45, 0, .45, .9]) {
          const dx = Math.sin(angle), dy = Math.cos(angle) * f, spot = { x: clamp(p.x + dx * 4, -27, 27), y: p.y + dy * 4 };
          const goalDepth = 48 - p.y * f, toGoal = goalDepth < 32 ? (dx * -p.x + dy * f * goalDepth) / (length(p.x, goalDepth) || 1) * 2 : 0;
          const value = Math.min(7, nearestOpponentDistance(s, team, spot)) + dy * f * 1.2 + toGoal - Math.max(0, Math.abs(spot.x) - 22) * .5 - Math.abs(spot.x) * .03;
          if (value > space) { space = value; dirX = dx; dirY = dy; }
        }
        p.dribbleX = q(dirX); p.dribbleY = q(dirY);
        const dribbleValue = keep * threat(team, p.x + dirX * 5, p.y + dirY * 5) - (1 - keep) * .04 + noise();
        const close = 48 - p.y * f < 13 && Math.abs(p.x) < 10;
        if ((xg > .035 && xg >= Math.max(bestValue, dribbleValue) * .6) || xg > .12 + intent * -.02 || (close && xg > .06)) { kick(s, team, i, true); continue; }
        if (best !== null && p.possessionTicks > 3 && (bestValue > dribbleValue + (pressure > 5 ? .012 : .003) || p.possessionTicks > 34)) { kick(s, team, i, false, bestThrough ? THROUGH : 0, { target: best }); continue; }
      }
      const dx = p.dribbleX ?? 0, dy = p.dribbleY ?? f, open = pressure > 5;
      move(p, clamp(p.x + dx * (open ? 9 : 6), -26, 26), clamp(p.y + dy * (open ? 9 : 6), -45.5, 45.5), open ? sprintFor(p, base) * .94 : pace * .91);
    } else if (own) {
      const outlet = i===outlets?.short.index ? outlets.short : i===outlets?.far.index ? outlets.far : null;
      if(outlet){
        p.role='support';
        move(p,outlet.x,outlet.y,pace*.9,true);
        tire(p,base);
        continue;
      }
      const shape = shapeTarget(s, team, i, true);
      if (shape.band === 2) {
        // Angribere holder den bageste forsvarers linje og løber i dybden, når boldholderen har tid.
        const lineY = Math.min(shape.y * f, lastLine - 1);
        if ((p.run || 0) > 0) p.run--;
        else if (nearestOpponentDistance(s, team, carrier) > 3.5 && carrier.facingY * f > .3 && (s.tick + i) % ENGINE.supportInterval === 0 && random(s) < .45) p.run = 30;
        p.role = p.run > 0 ? 'run' : 'support';
        const ty = p.run > 0 ? Math.min(lastLine + 7, 44) : lineY;
        move(p, clamp(shape.x * .9, -26, 26), clamp(ty * f, -43.5, 43.5), p.run > 0 ? sprintFor(p, base) : pace * .9, p.run === 0);
      } else {
        const wide = Math.abs(p.homeX)>15 && Math.sign(p.homeX)===Math.sign(carrier.x) && Math.abs(carrier.x)>10;
        const overlap = wide && carrier.y*f>2 && carrier.y*f<35 && nearestOpponentDistance(s,team,carrier)>3.4;
        if (overlap) {
          const underlap=(s.engineRevision===6||s.engineRevision===7)&&Math.abs(carrier.x)>17;
          p.role=underlap?'underlap':'overlap';
          move(p,Math.sign(p.homeX)*(underlap?14:26),clamp(carrier.y*f+(underlap?8:10),-33,lastLine-.7)*f,sprintFor(p,base),true);
          tire(p,base);
          continue;
        }
        p.role = 'support';
        if ((s.tick + i) % ENGINE.supportInterval === 0 || p.planX === undefined) { const spot = supportSpot(s, team, i, p, carrier, shape); p.planX = q(spot.x); p.planY = q(spot.y); }
        move(p, p.planX, p.planY, pace * .84, true);
      }
    } else if (defend) {
      const shape = shapeTarget(s, team, i, false), toGoal = { x: ownGoal.x - opponentCarrier.x, y: ownGoal.y - opponentCarrier.y }, gd = length(toGoal.x, toGoal.y) || 1;
      if (i === presser) {
        // Pres med front mod bolden: kom først på målsiden af boldholderen, og gå
        // derfra ind i bolden. Taklingen afgøres stadig af den fysiske fodkontakt.
        p.role = counterpress ? 'counterpress' : 'press';
        const ux = toGoal.x / gd, uy = toGoal.y / gd, reach = distance(p, b);
        const goalSide = (p.x - opponentCarrier.x) * ux + (p.y - opponentCarrier.y) * uy > .3;
        if (counterpress && reach < (pressing?12:9)) move(p,b.x+b.vx*.17,b.y+b.vy*.17,sprintFor(p,base));
        else if (p.tackle > 0) move(p, b.x + b.vx * .15, b.y + b.vy * .15, paceFor(p, (6.25 + skill * .021) * .9));
        else if (goalSide && reach < 2.6) move(p, b.x + b.vx * .2, b.y + b.vy * .2, pace);
        else move(p, opponentCarrier.x + ux * 1.2 + opponentCarrier.vx * .3, opponentCarrier.y + uy * 1.2 + opponentCarrier.vy * .3, reach > 3 ? sprintFor(p, base) : pace);
      } else if (i === coverer) {
        p.role = 'cover';
        // Tæt på eget mål: blokér skudlinjen mellem boldholderen og målets midte.
        if (gd < 28) {
          const tx = opponentCarrier.x + toGoal.x / gd * 3.2, ty = opponentCarrier.y + toGoal.y / gd * 3.2;
          move(p, clamp(tx, -27.5, 27.5), clamp(ty, -45, 45), pace, true);
          tire(p, base); continue;
        }
        // Ellers: dæk den farligste afleveringsvej fra boldholderen.
        let danger = null, worst = -Infinity;
        opponents.forEach((op, m) => { if (!isActive(op) || op.keeper || m === ownerIndex) return; const d = distance(op, opponentCarrier); if (d > 25) return; const value = threat(other(team), op.x, op.y) - d * .002; if (value > worst) { worst = value; danger = op; } });
        const target = danger ? { x: opponentCarrier.x + (danger.x - opponentCarrier.x) * .45, y: opponentCarrier.y + (danger.y - opponentCarrier.y) * .45 } : shape;
        move(p, clamp(target.x, -27.5, 27.5), clamp(target.y, -43.5, 43.5), pace * .92, true);
      } else {
        // Zone + markering: hold blokken, men tag en angriber, der kommer ind i zonen.
        p.role = 'mark';
        let mark = null, nearest = 8;
        opponents.forEach((op, m) => { if (!isActive(op) || op.keeper || m === ownerIndex || marked.has(m)) return; const d = distance(op, shape); const dangerous = op.y * f < b.y * f + 2 || length(op.x, op.y - ownGoal.y) < 22; if (dangerous && d < nearest) { nearest = d; mark = m; } });
        let tx = shape.x, ty = shape.y;
        if (mark !== null) {
          marked.add(mark);
          const op = opponents[mark], ax = ownGoal.x - op.x, ay = ownGoal.y - op.y, ad = length(ax, ay) || 1;
          tx = (op.x + ax / ad * 1.6) * .75 + shape.x * .25; ty = (op.y + ay / ad * 1.6) * .75 + shape.y * .25;
          // Forsvarskæden holder linjen og følger kun angriberen i dybden tæt på eget felt.
          if (shape.band === 0 && ad > 22) ty = shape.y;
        }
        move(p, clamp(tx, -27.5, 27.5), clamp(ty, -43.5, 43.5), pace * .9, true);
      }
    } else if (b.passTarget?.team === team && b.passTarget.index === i) {
      p.role = 'receive'; const target = receiveIntercept(b, p, sprintFor(p, base));
      const reach = distance(p, target), arrivalPace = Math.min(sprintFor(p, base), Math.max(b.receivePoint?.through ? pace * .45 : 0, Math.sqrt(40 * Math.max(0, reach - .04))));
      move(p, target.x, target.y, arrivalPace);
    } else if (i === presser && (b.z < 2 || distance(p, intercept) < 8)) {
      p.role = 'recover'; move(p, intercept.x, intercept.y, sprintFor(p, base));
    } else {
      p.role = 'cover'; const shape = shapeTarget(s, team, i, b.lastTeam === team);
      move(p, shape.x, shape.y, pace * .8, true);
    }
    tire(p, base);
  }
}

// Feet are offset from the player's centre; the strike window corresponds to
// the extended leg rather than a large invisible capture circle.
export const CONTACT = Object.freeze({footOffset:.18,footRadius:.38,footHeight:.55,autoOffset:.4,autoRadius:.26,manualOffset:.55,manualRadius:.27,windup:2,strikeEnd:5});
function footPosition(p,offset=CONTACT.footOffset){return{x:p.x+p.facingX*offset,y:p.y+p.facingY*offset};}
const contactFrames = new WeakMap();

function contactMotion(s) {
  let frame = contactFrames.get(s);
  if (!frame) {
    const slots = () => Array.from({length: 11}, () => ({x: 0, y: 0, facingX: 0, facingY: 0}));
    frame = {home: slots(), away: slots(), ball: {x: 0, y: 0, z: 0}};
    contactFrames.set(s, frame);
  }
  for (const team of SIDES) {
    for (let i = 0; i < 11; i++) {
      const current = s[team][i], previous = frame[team][i];
      previous.x = current.x; previous.y = current.y;
      previous.facingX = current.facingX; previous.facingY = current.facingY;
    }
  }
  frame.ball.x = s.ball.x; frame.ball.y = s.ball.y; frame.ball.z = s.ball.z;
  return frame;
}

// Earliest intersection of the ball and moving contact volume, including the
// height interval. Relative motion avoids both tunnelling and phantom touches
// when a player has already moved away from the ball's path.
export function sweptContact(previous,endpoint,start,end,radius,height,endT=1){
 const x=previous.x-start.x,y=previous.y-start.y,vx=endpoint.x-previous.x-end.x+start.x,vy=endpoint.y-previous.y-end.y+start.y;
 const a=vx*vx+vy*vy,b=2*(x*vx+y*vy),c=x*x+y*y-radius*radius;
 let enter=0,exit=endT;
 if(a<1e-12){if(c>0)return null;}
 else{const discriminant=b*b-4*a*c;if(discriminant<0)return null;const root=Math.sqrt(discriminant);enter=Math.max(enter,(-b-root)/(2*a));exit=Math.min(exit,(-b+root)/(2*a));}
 const dz=endpoint.z-previous.z;
 if(Math.abs(dz)<1e-12){if(previous.z>height)return null;}
 else if(dz>0)exit=Math.min(exit,(height-previous.z)/dz);
 else enter=Math.max(enter,(height-previous.z)/dz);
 if(enter>exit+1e-9||exit<0||enter>endT)return null;
 const t=clamp(enter,0,endT),z=previous.z+dz*t;
 return{t,d:length(x+vx*t,y+vy*t),height:z,x:previous.x+(endpoint.x-previous.x)*t,y:previous.y+(endpoint.y-previous.y)*t,z};
}
function noteContact(s,kind,team,index,point,extra={}){s.ball.lastTouchTick=s.tick;s.lastContact={kind,team,index,tick:s.tick,x:q(point.x),y:q(point.y),z:q(point.z),time:q(point.t??1),...extra};}
function attemptTackle(s,team,index,manual=false){
 const p=s[team][index],b=s.ball;
 if(!isActive(p)||p.cooldown>0)return false;
 if(!manual&&(b.owner?.team!==other(team)||b.protected>0||distance(p,b)>(p.keeper?ENGINE.keeperReach:ENGINE.tackleReach)||b.z>CONTACT.footHeight))return false;
 animate(p,'tackle',manual?9:7);p.cooldown=manual?18:p.keeper?8:17;
 p.pendingTackle={manual,started:s.tick,resolved:false};
 s.lastAction={kind:'tackle',team,index,tick:s.tick,contact:false};
 return true;
}
// Samme fysiske fod-/håndvolumener som den normale boldkontaktsti.
// En centerafstand eller vundet duel alene må aldrig flytte bolden.
function automaticTackleContact(s,team,p,before,previous){
 const b=s.ball,hands=p.keeper&&p.y*-forward(team)>30&&Math.abs(p.x)<20;
 if(hands){
  const extension=p.dive>0?.4:.18;
  const start={x:before.x+(p.dive>0?p.diveX:before.facingX)*extension,y:before.y+(p.dive>0?p.diveY:before.facingY)*extension};
  const end={x:p.x+(p.dive>0?p.diveX:p.facingX)*extension,y:p.y+(p.dive>0?p.diveY:p.facingY)*extension};
  return sweptContact(previous,b,start,end,p.dive>0?.78:.65,p.dive>0?2.35:1.95);
 }
 return sweptContact(previous,b,footPosition(before,CONTACT.autoOffset),footPosition(p,CONTACT.autoOffset),CONTACT.autoRadius,CONTACT.footHeight);
}
function resolveTackles(s,frame,previous){
 const b=s.ball,candidates=[];
 if(!b.owner||b.protected>0)return false;
 // Motor 11: computerens taklinger afgøres som en deterministisk duel i det øjeblik,
 // benet når frem (windup), hvis bolden stadig er inden for rækkevidde: forsvarerens
 // og boldholderens rating, boldholderens fart, placering på målsiden og skærmning.
 for(const team of['home','away'])for(let i=0;i<s[team].length;i++){
  const p=s[team][i],attempt=p.pendingTackle;
  if(!isActive(p)||!attempt||attempt.manual||attempt.resolved||(s.tick-attempt.started<CONTACT.windup||s.tick-attempt.started>CONTACT.strikeEnd)||b.owner.team!==other(team))continue;
  const reach=distance(p,b);if(reach>(p.keeper?ENGINE.keeperReach:ENGINE.tackleReach)+.35)continue;
  const hit=automaticTackleContact(s,team,p,frame[team][i],previous);if(!hit)continue;attempt.resolved=true;
  const owner=s[b.owner.team][b.owner.index],ownerPace=length(owner.vx,owner.vy),f=forward(b.owner.team);
  const goalSide=(p.y-owner.y)*f>.2,duel=(rating(s,team,i)-rating(s,b.owner.team,b.owner.index))*.01;
  // Målmanden går i fødderne med hænderne og har en højere chance end en markspiller.
  const chance=p.keeper?clamp(ENGINE.keeperSmother+duel-ownerPace*.015,.3,.9):clamp(ENGINE.tackleBase+duel-ownerPace*.025+(goalSide?.12:0)-Math.max(0,reach-.8)*.25,.08,.7);
  if(random(s)<chance){
   if(p.keeper){noteContact(s,'save',team,i,hit);s.stats[team+'Tackles']++;receiveBall(s,team,i);s.lastAction={kind:'smother',team,index:i,tick:s.tick};return true;}
   candidates.push({team,i,p,attempt,duel:true,hit});
  }
 }
 if(candidates.length)return pokeBall(s,candidates[0]);
 // Motor 11: målmanden kan også gå i fødderne på en fri angriber (indeks 0).
 for(const team of['home','away'])for(let i=0;i<s[team].length;i++){
  const p=s[team][i],attempt=p.pendingTackle,age=attempt?s.tick-attempt.started:-1;
  if(!isActive(p)||!attempt||attempt.resolved||age<CONTACT.windup||age>CONTACT.strikeEnd||p.tackle<=0||b.owner.team!==other(team))continue;
  const offset=attempt.manual?CONTACT.manualOffset:CONTACT.autoOffset,radius=attempt.manual?CONTACT.manualRadius:CONTACT.autoRadius;
  const hit=sweptContact(previous,b,footPosition(frame[team][i],offset),footPosition(p,offset),radius,CONTACT.footHeight);
  if(hit)candidates.push({team,i,p,attempt,hit});
 }
 candidates.sort((a,c)=>a.hit.t-c.hit.t||a.i-c.i||(a.team==='home'?-1:1));
 const contact=candidates[0];
 if(contact)return pokeBall(s,contact);
 const victim=s[b.owner.team][b.owner.index],offending=other(b.owner.team);
 for(let i=1;i<11;i++){
  const p=s[offending][i],a=p.pendingTackle,age=a?s.tick-a.started:-1;
  if(!isActive(p)||!a||a.resolved||age<CONTACT.windup||age>CONTACT.strikeEnd)continue;
  const severity=foulSeverity(p,victim,b,a.manual);
  if(!severity)continue;
  a.resolved=true;callFoul(s,offending,i,victim,severity);return true;
 }
 return false;
}
function pokeBall(s,contact){
 const b=s.ball;
 const{team,i,p,attempt,hit,duel}=contact,owner=s[b.owner.team][b.owner.index],ownerPace=length(owner.vx,owner.vy),sign=duel?-1:1,dx=(hit.x-p.x)*sign,dy=(hit.y-p.y)*sign,n=length(dx,dy)||1;
 // The tackle touches and knocks the ball loose; no opponent receives remote
 // ownership. A later physical foot/hand contact must win the loose ball.
 // Motor 11: en ren takling stopper bolden nær forsvareren ("poke"), så den kan erobres
 // naturligt med næste fodkontakt; ejerskab overdrages stadig aldrig på afstand.
 b.owner=null;b.x=hit.x;b.y=hit.y;b.z=Math.max(.22,hit.z);const poke=duel?ENGINE.pokeSpeed*.6:ENGINE.pokeSpeed+ownerPace*.08;b.vx=dx/n*poke+p.vx*.35;b.vy=dy/n*poke+p.vy*.35;b.vz=.2;
 b.lastTeam=team;b.lastTouch={team,index:i};b.protected=2;b.flight=0;b.curl=0;b.flightKind='loose';b.shot=false;b.passTarget=null;b.receivePoint=null;b.lastPassFrom=null;b.lastShooter=null;b.assist=null;
 attempt.resolved=true;p.possessionTicks=0;
 s.stats[team+'Tackles']++;
 if(team==='home'){s.stats.tackles++;if(s.personalIndex===null)s.controlled=i;if(i===s.personalIndex)s.stats.userTackles++;}
 s.lastAction={kind:'tackle',team,index:i,tick:s.tick,contact:true};noteContact(s,'tackle',team,i,hit,{manual:attempt.manual});
 return true;
}

function receiveBall(s, team, index) {
  const b = s.ball, p = s[team][index];
  if(b.lastPassFrom?.team===team&&b.lastPassFrom.index!==index&&!b.passCounted){s.stats[team+'CompletedPasses']++;b.passCounted=true;}
  if (team === 'home' && b.lastPassFrom?.team === 'home' && b.lastPassFrom.index !== index) {
    s.stats.completedPasses++; if (b.lastPassFrom.index === s.personalIndex) s.stats.userPasses++;
  }
  if (b.lastPassFrom?.team !== team) b.lastPassFrom = null;
  b.owner = { team, index }; b.lastTeam = team; b.lastTouch = { team, index }; b.protected = p.keeper ? 16 : ENGINE.receiveProtection;
  // A controlled collection ends the previous shot. A later dribble or own goal
  // must not be attributed to someone who shot before possession changed.
  b.shot=false;b.lastShooter=null;b.assist=null;
  b.curl=0;b.passTarget=null;b.receivePoint=null;b.offsideMask=0;b.offsideTeam=null;b.indirectTeam=null;
  // A receiving touch carries momentum into the next stride instead of teleporting to the chest.
  const skill=rating(s,team,index),pressure=nearestOpponentDistance(s,team,p);
  p.touch=s.engineRevision===7&&!p.keeper
    ? cushionR7Ball(b,p,skill,pressure,s.surface)
    : receiveMatchBall(b,p,{skill,pressure,keeper:p.keeper});
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

function ballContacts(s, previous, endpoint, endT = 1, frame = contactMotion(s)) {
  const b=s.ball,contacts=[];
  for(const team of['home','away'])for(let i=0;i<s[team].length;i++){
    const p=s[team][i],before=frame[team][i],hands=p.keeper&&p.y*-forward(team)>30&&Math.abs(p.x)<20;
    if(!isActive(p))continue;
    if(b.lastTouch?.team===team&&b.lastTouch.index===i&&s.tick-(b.lastTouchTick??0)<3)continue;
    let start,end,radius,height,block=false,header=false;
    if(hands){const extension=p.dive>0?.4:.18;start={x:before.x+(p.dive>0?p.diveX:before.facingX)*extension,y:before.y+(p.dive>0?p.diveY:before.facingY)*extension};end={x:p.x+(p.dive>0?p.diveX:p.facingX)*extension,y:p.y+(p.dive>0?p.diveY:p.facingY)*extension};radius=p.dive>0?.78:.65;height=p.dive>0?2.35:1.95;}
    else{const attempt=p.pendingTackle,age=attempt?s.tick-attempt.started:-1,extended=attempt&&age>=CONTACT.windup&&age<=CONTACT.strikeEnd&&p.tackle>0,offset=extended?(attempt.manual?CONTACT.manualOffset:CONTACT.autoOffset):CONTACT.footOffset;start=footPosition(before,offset);end=footPosition(p,offset);radius=extended?(attempt.manual?CONTACT.manualRadius:CONTACT.autoRadius):CONTACT.footRadius;height=CONTACT.footHeight;}
    let hit=sweptContact(previous,endpoint,start,end,radius,height,endT);
    // Motor 11: en forsvarer tæt på skytten strækker ben og krop ind i skudlinjen (bredere blokering).
    if(!hit&&!hands&&b.shot){const shooter=b.lastShooter&&s[b.lastShooter.team]?.[b.lastShooter.index],near=shooter&&b.lastShooter.team!==team&&distance(p,shooter)<ENGINE.blockRange;hit=sweptContact(previous,endpoint,before,p,near?ENGINE.blockRadius:.43,near?1.3:1.65,endT);block=!!hit;}
    // Motor 11: målmandens krop kan også stoppe et skud, der går lige på ham.
    if(!hit&&hands&&b.shot){hit=sweptContact(previous,endpoint,before,p,.45,1.9,endT);}
    if(!hit&&!hands&&s.engineRevision>=5&&!b.shot&&Math.min(previous.z,endpoint.z)>=1.43){
      hit=sweptContact(previous,endpoint,before,p,.37,2.05,endT);
      header=!!hit;
    }
    if(hit)contacts.push({team,i,hands,block,header,...hit});
  }
  contacts.sort((a,c)=>a.t-c.t||a.d-c.d||a.i-c.i||(a.team==='home'?-1:1));
  const contact=contacts[0];if(!contact)return false;
  const{team,i,t,hands,d,height}=contact,p=s[team][i],speed=length(b.vx,b.vy);
  b.x=previous.x+(endpoint.x-previous.x)*t;b.y=previous.y+(endpoint.y-previous.y)*t;b.z=Math.max(.22,height);
  if (team===b.offsideTeam && (b.offsideMask & (1<<i))) {
    restart(s,other(team),'offside',b.x,b.y,true);
    return true;
  }
  b.indirectTeam=null;
  if (hands) {
    noteContact(s,'save',team,i,{x:b.x,y:b.y,z:b.z,t});
    saveShot(s, team, p);
    if (b.shot && (speed > 25 || height > 1.5 || d > .85)) {
      // Hard or stretching saves are pushed wide. The ball stays live for rebounds and corners.
      const side = b.x - p.x ? Math.sign(b.x - p.x) : b.vx ? Math.sign(b.vx) : (random(s) < .5 ? -1 : 1);
      if(s.engineRevision===7)redirectR7Save(b,p,forward(team),side,d);
      else {b.vx = side * (8 + speed * .15); b.vy = forward(team) * (6 + speed * .22); b.vz = 2.5 + Math.max(0, height - 1);}
      b.lastTeam = team; b.lastTouch = { team, index: i }; b.lastPassFrom = null; b.passTarget = null; b.receivePoint = null; b.curl = 0;b.flightKind='loose'; b.protected = 5;
      b.x += side * .22; b.y += forward(team) * .18;
      if (p.dive === 0) startDive(p, side, -.2);
      return true;
    }
    receiveBall(s, team, i); return true;
  }
  if (contact.header) {
    const f=forward(team), attack=48-p.y*f<20&&Math.abs(p.x)<13&&p.facingY*f>.25;
    const skill=rating(s,team,i);
    redirectHeader(b,p,f,skill,attack);
    b.lastTeam=team; b.lastTouch={team,index:i}; b.offsideMask=0; b.offsideTeam=null;
    b.passTarget=null; b.receivePoint=null; b.lastPassFrom=null; b.flightKind=attack?'shot':'loose';
    b.shot=attack; b.lastShooter=attack?{team,index:i}:null; b.assist=null;
    if(attack){b.shotId=++s.shotSequence;s.stats[team+'Shots']++;s.stats[team+'Xg']=q((s.stats[team+'Xg']||0)+shotQuality(s,team,p)*.7);}
    b.protected=2;b.flight=0;
    noteContact(s,'header',team,i,{x:b.x,y:b.y,z:b.z,t});
    s.lastAction={kind:'header',team,index:i,tick:s.tick};
    animate(p,s.engineRevision===7?'header':'receive',7);
    return true;
  }
  if (contact.block || b.shot && speed > 24) {
    noteContact(s,'block',team,i,{x:b.x,y:b.y,z:b.z,t});
    // Outfield blocks deflect a driven shot rather than granting instant possession.
    const side = p.x > b.x ? -1 : 1;
    b.vx = b.vx * .22 + side * 5; b.vy *= -.26; b.vz = 1.2; b.lastTeam = team; b.lastTouch = { team, index: i }; b.lastPassFrom = null; b.passTarget = null; b.receivePoint = null; b.curl = 0;b.flightKind='loose'; b.protected = 4;
    animate(p, 'receive', 5); return true;
  }
  noteContact(s,'touch',team,i,{x:b.x,y:b.y,z:b.z,t});
  // Motor 11: førsteberøring. En hård eller høj bold under pres kan springe fra en
  // svagere spiller; sandsynligheden falder med rating og stiger med fart og pres.
  const skill=rating(s,team,i),pressure=nearestOpponentDistance(s,team,p);
  const touchRisk=s.engineRevision===7?receptionLoad(b,p,skill,pressure,s.surface)*.12:0;
  const miss=clamp((speed-(9+skill*.12))*.035+Math.max(0,b.z-.6)*.12+Math.max(0,2.5-pressure)*.06-skill*.0015+(s.engineRevision>=5?firstTouchError(p,b,skill,pressure,s.surface):0)+touchRisk,0,s.engineRevision>=5?.5:.4);
  if(miss>0&&random(s)<miss){
    const fx=p.facingX||0,fy=p.facingY||forward(team);
    b.vx=b.vx*.3+fx*2.4;b.vy=b.vy*.3+fy*2.4;b.vz=.6;b.lastTeam=team;b.lastTouch={team,index:i};b.lastPassFrom=b.lastPassFrom?.team===team?b.lastPassFrom:null;
    b.passTarget=null;b.receivePoint=null;b.curl=0;b.shot=false;b.protected=3;
    animate(p,'receive',5);s.lastAction={kind:'miscontrol',team,index:i,tick:s.tick};return true;
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
    if(s.engineRevision===6||s.engineRevision===7)reboundFromWoodwork(b,crossing,post,bar);
    else{b.vy *= -.55; if (post) b.vx = (crossing.x > 0 ? -1 : 1) * Math.max(3, Math.abs(b.vx) * .6); if (bar) b.vz = -Math.abs(b.vz) * .6;}
    b.protected = 2; s.lastAction = { kind: 'woodwork', tick: s.tick }; return;
  }
  if (Math.abs(crossing.x) < 3.86 && crossing.z < 2.28) {
    const team = crossing.y < 0 ? 'home' : 'away';
    if (b.indirectTeam) {
      const side=other(team), directOwnGoal=b.indirectTeam===side;
      restart(s,directOwnGoal?team:side,directOwnGoal?'corner':'goal-kick',directOwnGoal?29:0,Math.sign(crossing.y)*(directOwnGoal?46:43));
      return;
    }
    const scorer = b.lastShooter?.team === team ? b.lastShooter : b.lastTouch?.team === team ? b.lastTouch : null;
    const scorerIndex=scorer&&Number.isInteger(scorer.index)&&s[team][scorer.index]?scorer.index:null;
    const assister=b.assist?.team===team&&Number.isInteger(b.assist.index)&&s[team][b.assist.index]&&b.assist.index!==scorerIndex?b.assist.index:null;
    const ownGoal=scorerIndex===null&&b.lastTouch?.team===other(team);
    if (team === 'home') {
      if (scorer?.index === s.personalIndex) s.stats.userGoals++;
      if (b.assist?.team === 'home' && b.assist.index === s.personalIndex && scorer?.index !== s.personalIndex) s.stats.userAssists++;
    }
    s[team === 'home' ? 'homeScore' : 'awayScore']++;
    s.events.push({ minute: eventMinute(s), kind: 'goal', side: team, scorer:scorerIndex,assister,ownGoal,text: team === 'home' ? 'Du spiller bolden i nettet!' : 'Modstanderen scorer i den spillede kamp.' });
    s.lastGoal={tick:s.tick,time:crossing.t,point:{x:crossing.x,y:crossing.y,z:crossing.z},side:team,scorer:scorerIndex,assister,ownGoal,homeScore:s.homeScore,awayScore:s.awayScore,version:ARCADE_VERSION,field:FIELD,...structuredClone({home:s.home,away:s.away,ball:{...b,x:crossing.x,y:crossing.y,z:crossing.z,owner:null},controlled:s.controlled})};
    beginGoalSequence(s,team,scorerIndex,assister,crossing);
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
  let fx = p.facingX, fy = s.engineRevision===6||s.engineRevision===7 ? p.facingY : p.facingY || f;
  if (s.skillTicks > 0 && team === 'home' && index === s.controlled) {
    const angle = (1 - s.skillTicks / 12) * Math.PI * 2, x = fx;
    fx = x * Math.cos(angle) - fy * Math.sin(angle); fy = x * Math.sin(angle) + fy * Math.cos(angle);
  }
  // Motor 11: skærmning. Under pres holdes bolden tættere og på den side, der vender
  // væk fra den nærmeste modstander – mere jo bedre spilleren er.
  let ox = 0, oy = 0, close = 1;
  let rival = null, rivalDistance = 2.4;
  for (const op of s[other(team)]) { const d = distance(op, p); if (isActive(op) && !op.keeper && d < rivalDistance) { rivalDistance = d; rival = op; } }
  if (rival) {
    const ax = p.x - rival.x, ay = p.y - rival.y, ad = length(ax, ay) || 1, side = (ax * -fy + ay * fx) / ad >= 0 ? 1 : -1;
    const amount = (2.4 - rivalDistance) / 2.4 * ENGINE.shield * clamp(skill / 75, .4, 1.2);
    ox = -fy * side * amount; oy = fx * side * amount; close = 1 - amount * .35;
  }
  const tx=p.x+fx*stride*close+ox,ty=p.y+fy*stride*close+oy;
  const keepsControl=dribbleStep(b,p,tx,ty,speed,skill);
  b.lastTeam=team;
  if(b.lastTouch?.team!==team || b.lastTouch.index!==index)b.lastTouch={team,index};
  if(!keepsControl){
    b.owner=null;b.protected=0;b.shot=false;b.passTarget=null;b.receivePoint=null;b.flight=0;
    b.lastTouchTick=s.tick;b.flightKind='loose';
  }
  s.stats[team === 'home' ? 'homePossession' : 'awayPossession']++;
}

function flightBall(s,frame) {
  const b = s.ball, previous = { x: b.x, y: b.y, z: b.z };
  ballPhysics(b); b.flight++;
  const endpoint = { x: b.x, y: b.y, z: b.z }, crossing = boundary(previous, b);
  const contact = ballContacts(s, previous, endpoint, crossing?.t ?? 1,frame);
  if (!contact && crossing) leavePitch(s, crossing);
}

function stepPlayingArcade(s, mask) {
  if (!validateMask(mask)) throw Error('Ugyldig kampstyring.');
  if (s.tick >= maxTicks(s)) return s;
  if (s.tick === 0 && s.personalIndex !== null) s.home[s.personalIndex].energy = s.startingEnergy;
  s.tick++;
  for (const key of ['skillCooldown', 'skillTicks', 'callForPass']) s[key] = Math.max(0, (s[key] || 0) - 1);
  // Samme resultat som Math.max(0, x - 1) for hver tæller, men uden dynamiske opslag.
  for (const team of ['home', 'away']) for (const p of s[team]) {
    p.cooldown = down(p.cooldown); p.dive = down(p.dive); p.kick = down(p.kick); p.tackle = down(p.tackle);
    p.receive = down(p.receive); p.actionTicks = down(p.actionTicks); p.decision = down(p.decision);
    if(p.duelTicks>0)p.duelTicks--;
    if (p.actionTicks === 0) p.action = 'idle';
  }
  s.ball.protected = Math.max(0, s.ball.protected - 1);
  if(s.goalSequence){advanceGoalSequence(s);s.lastMask=mask;return s;}
  if (s.freeze > 0) { s.freeze--; s.lastMask = mask; return s; }
  if(s.openingKickoff){
    const team=s.openingKickoff;
    delete s.openingKickoff;
    kick(s,team,s.kickoffTaker,false,0,{target:s.kickoffReceiver,restart:'kickoff'});
    s.lastMask=mask;
    return s;
  }
  if(s.restart&&!s.restart.released){
    autoRestart(s);
    s.lastMask=mask;
    return s;
  }
  let b = s.ball;
  const ownerTeam=b.owner?.team;
  if(ownerTeam&&ownerTeam!==s.possessionTeam){
    s.possessionTeam=ownerTeam;
    s.turnoverTick=s.tick;
  }
  if(s.advantage){
    const a=s.advantage;
    if(s.tick>=a.until)s.advantage=null;
    else if(ownerTeam&&ownerTeam!==a.team){restart(s,a.team,'free-kick',a.x,a.y);s.lastMask=mask;return s;}
  }
  const frame=contactMotion(s),carriedFrom=frame.ball;
  if (s.autopilot) mask = 0;
  if (!s.autopilot) {
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
    if (owns) {if(distance(controlled,b)<1.65)kick(s,'home',s.controlled,false,mask);}
    else if (s.personalIndex !== null) {
      s.callForPass = 24; const owner = b.owner;
      if (owner?.team === 'home') kick(s, 'home', owner.index, false, mask);
    } else {
      s.controlled = Math.max(0,nearestActive(s,'home',b.x,b.y,{outfield:true}));
    }
  }
  if ((mask & SHOOT) && !(s.lastMask & SHOOT)) {
    if (b.owner?.team === 'home' && b.owner.index === s.controlled) {if(distance(controlled,b)<1.65)kick(s,'home',s.controlled,true,mask);}
    else if (controlled.keeper && controlled.energy >= 10 && controlled.cooldown === 0) {
      const dx = magnitude ? direction[0] : b.x - controlled.x, dy = magnitude ? direction[1] : (b.y - controlled.y) * .15;
      startDive(controlled, dx, dy); controlled.energy -= 10;
    } else if (controlled.cooldown === 0 && controlled.energy >= 10) {
      controlled.energy -= 10;
      attemptTackle(s,'home',s.controlled,true);
    }
  }
  }
  ai(s, 'home'); ai(s, 'away'); separate(s);
  b=s.ball;
  if(!(mask&SHOOT_HELD)&&!(mask&SHOOT))s.shotCharge=0;
  if(!(mask&PASS_HELD)&&!(mask&PASS)&&!(mask&THROUGH))s.passCharge=0;
  if(b.owner){
    carryBall(s);
    const crossing=boundary(carriedFrom,b);
    if(crossing)leavePitch(s,crossing);
    else{
      if(b.owner&&b.protected===0){const team=other(b.owner.team);let nearest=-1,best=Infinity;for(let i=1;i<s[team].length;i++){if(!isActive(s[team][i])||team==='home'&&i===s.controlled&&!s.autopilot)continue;const d=distance(s[team][i],b);if(d<best){best=d;nearest=i;}}if(nearest>=0)attemptTackle(s,team,nearest);}
      resolveTackles(s,frame,carriedFrom);
    }
  }else flightBall(s,frame);
  for (const key of ballFields) s.ball[key] = q(s.ball[key]);
  s.lastMask = mask;
  return s;
}

export function stepArcade(s,mask){
 const extended=s.engineRevision>=5&&isR5Command(mask);
 if(!extended&&!validateMask(mask))throw Error('Ugyldig kampstyring.');
 if(s.tick>=maxTicks(s))return s;
 if(extended){
   if(mask===HIGH_PRESS_COMMAND){s.tactic='pressing';s.stats.tacticalChanges++;}
   else if(s.restart?.kind==='free-kick'&&s.restart.team==='home'&&!s.restart.released){s.restart.choice=mask===FREE_KICK_SHOT?'shot':'pass';s.freeze=Math.min(s.freeze,6);}
   mask=0;
 }
 captureR4Pose(s);
 if (mask===SUBSTITUTION_COMMAND) {
   if (s.freeze>0 || s.period==='halftime') substitute(s,'home',true);
   else s.substitutionRequested=true;
   mask=0;
 }
 if(isTacticalCommand(mask)){applyTacticalCommand(s,mask);mask=0;}
 const half=HALF_MS/STEP_MS+(s.engineRevision>=5?R5_ADDED_TICKS:0),pause=HALFTIME_MS/STEP_MS;
 if(s.tick>=half&&s.tick<half+pause){s.tick++;s.intermissionRemaining=(half+pause-s.tick)*STEP_MS;s.lastMask=mask;if(s.tick===half+pause){kickoff(s,'away');s.period='second';s.half=2;s.freeze=24;s.lastMask=0;}return s;}
 stepPlayingArcade(s,mask);
 if(s.tick===half){s.goalSequence=null;s.restart=null;s.advantage=null;s.freeze=0;for(const side of SIDES)substitute(s,side,side==='home'&&s.substitutionRequested);s.substitutionRequested=false;for(const team of ['home','away'])for(const p of s[team]){p.vx=0;p.vy=0;p.energy=Math.min(100,p.energy+25);}s.period='halftime';s.half=1;s.intermissionRemaining=HALFTIME_MS;s.shotCharge=0;s.passCharge=0;}
 else if(s.tick===maxTicks(s)){s.goalSequence=null;s.freeze=0;for(const team of ['home','away'])for(const p of s[team]){p.vx=0;p.vy=0;}s.period='finished';s.half=2;}
 else{s.period=s.tick<half?'first':'second';s.half=s.tick<half?1:2;}
 return s;
}

export function replayArcade(seed, config, inputs) {
  if (inputs.length !== INPUT_COUNT) throw Error('Ufuldstændigt kampforløb.');
  const s = createArcade(seed, config);
  for (const mask of inputs) stepArcade(s, mask);
  return s;
}
