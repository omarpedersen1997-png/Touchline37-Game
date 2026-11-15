// Deterministisk testspiller til balancesimulationer (kun tests).
// Styrer hjemmeholdets kontrollerede spiller som en simpel, rimelig menneskelig spiller:
// løber mod bolden, dribler mod mål, afleverer under pres, lader skud op og skyder i feltet.
// Bruger kun kampmotorens offentlige inputprotokol (samme for motor 6–11).
const length = (x, y) => Math.hypot(x, y);

export function createBot(rules, { seed = 1 } = {}) {
  const { SHOOT, PASS, SPRINT, SHOOT_HELD, directionMask } = rules;
  let charging = 0;
  let x = (seed * 2654435761) >>> 0 || 1;
  const rand = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  return function nextMask(s) {
    if (s.goalSequence || s.freeze > 0 || s.period === 'halftime') return 0;
    const me = s.home[s.controlled], b = s.ball, f = -1, last = s.lastMask || 0;
    const owns = b.owner?.team === 'home' && b.owner.index === s.controlled;
    const press = (bit) => (last & bit ? 0 : bit);
    if (owns) {
      const goalDistance = 48 - me.y * f;
      const nearest = Math.min(...s.away.filter((p) => !p.keeper).map((p) => length(p.x - me.x, p.y - me.y)));
      const dir = directionMask(-me.x * 0.04 + (rand() - 0.5) * 0.3, f);
      if (goalDistance < 21 && Math.abs(me.x) < 15) {
        charging++;
        if (charging > 9) { charging = 0; return dir | press(SHOOT); }
        return dir | SHOOT_HELD;
      }
      charging = 0;
      if ((nearest < 3.2 && me.possessionTicks > 4) || me.possessionTicks > 40) return dir | press(PASS);
      return dir | (nearest > 6 && me.energy > 40 ? SPRINT : 0);
    }
    charging = 0;
    const tx = b.x + b.vx * 0.2 - me.x, ty = b.y + b.vy * 0.2 - me.y, d = length(tx, ty);
    const dir = d > 0.4 ? directionMask(tx / d, ty / d) : 0;
    if (b.owner?.team === 'away' && d < 1.3 && me.cooldown === 0 && me.energy >= 12) return dir | press(SHOOT);
    return dir | (d > 8 && me.energy > 50 ? SPRINT : 0);
  };
}

/** Spiller en hel kamp med botten og returnerer input-båndet og sluttilstanden. */
export function playBotMatch(rules, seed, config) {
  const s = rules.createArcade(seed, config);
  const bot = createBot(rules, { seed: [...String(seed)].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0 });
  const tape = new Uint16Array(rules.INPUT_COUNT);
  for (let i = 0; i < rules.INPUT_COUNT; i++) {
    const mask = bot(s);
    tape[i] = mask;
    rules.stepArcade(s, mask);
  }
  return { tape, state: s };
}

/** Samlede balancetal for en række kampe. */
export function simulate(rules, { matches = 40, homeRating = 60, awayRating = 60, prefix = 'balance', config = {} } = {}) {
  const totals = { matches, homeGoals: 0, awayGoals: 0, homeWins: 0, draws: 0, awayWins: 0, homeShots: 0, awayShots: 0, homeSaves: 0, awaySaves: 0,
    homePassAttempts: 0, homeCompletedPasses: 0, awayPassAttempts: 0, awayCompletedPasses: 0, homePossession: 0, awayPossession: 0, tackles: 0, restarts: 0, goallessMatches: 0 };
  for (let m = 0; m < matches; m++) {
    const { state: s } = playBotMatch(rules, `${prefix}-${m}`, { homeRating, awayRating, tactic: 'balanced', ...config });
    totals.homeGoals += s.homeScore; totals.awayGoals += s.awayScore;
    if (s.homeScore > s.awayScore) totals.homeWins++; else if (s.homeScore < s.awayScore) totals.awayWins++; else totals.draws++;
    if (s.homeScore + s.awayScore === 0) totals.goallessMatches++;
    for (const key of ['homeShots', 'awayShots', 'homeSaves', 'awaySaves', 'homePassAttempts', 'homeCompletedPasses', 'awayPassAttempts', 'awayCompletedPasses', 'homePossession', 'awayPossession']) totals[key] += s.stats[key] || 0;
    totals.tackles += (s.stats.homeTackles || 0) + (s.stats.awayTackles || 0);
  }
  const per = (n) => Math.round((n / matches) * 100) / 100;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    matches,
    goalsPerMatch: per(totals.homeGoals + totals.awayGoals),
    homeGoalsPerMatch: per(totals.homeGoals), awayGoalsPerMatch: per(totals.awayGoals),
    shotsPerMatch: per(totals.homeShots + totals.awayShots),
    conversionPct: pct(totals.homeGoals + totals.awayGoals, totals.homeShots + totals.awayShots),
    savePct: pct(totals.homeSaves + totals.awaySaves, totals.homeShots + totals.awayShots),
    homePassPct: pct(totals.homeCompletedPasses, totals.homePassAttempts),
    awayPassPct: pct(totals.awayCompletedPasses, totals.awayPassAttempts),
    passesPerMatch: per(totals.homePassAttempts + totals.awayPassAttempts),
    homePossessionPct: pct(totals.homePossession, totals.homePossession + totals.awayPossession),
    tacklesPerMatch: per(totals.tackles),
    homeWinPct: pct(totals.homeWins, matches), drawPct: pct(totals.draws, matches), awayWinPct: pct(totals.awayWins, matches),
    goallessPct: pct(totals.goallessMatches, matches),
  };
}
