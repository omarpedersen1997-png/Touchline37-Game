package dk.touchline.career;

import java.io.*;
import java.util.ArrayList;
import java.util.Locale;

/** Native fixed-step Motor 12. Pitch coordinates are metres, velocity is m/s. */
public final class Motor12 {
  public enum Phase {
    PRE_KICKOFF,
    PLAY,
    RESTART,
    KICKOFF_READY,
    FULL_TIME,
    KICKOFF_RUNUP
  }

  public static final int HZ = 120, HALF = 150 * HZ;
  static final double DT = 1.0 / HZ, L = 52.5, W = 34, R = .11;
  static final int[][] DEPTH = {
    {3, 16, 15, 15, 16, 31, 28, 31, 45, 46, 45},
    {3, 15, 14, 14, 15, 31, 29, 29, 31, 44, 44},
    {3, 15, 13, 15, 27, 30, 28, 31, 27, 45, 45}
  };
  static final int[][] LANE = {
    {0, -24, -8, 8, 24, -14, 0, 14, -23, 0, 23},
    {0, -24, -8, 8, 24, -24, -8, 8, 24, -10, 10},
    {0, -17, 0, 17, -26, -12, 0, 12, 26, -10, 10}
  };

  enum Attribute {
    PACE,
    ACCELERATION,
    AGILITY,
    STAMINA,
    DRIBBLING,
    PASSING,
    VISION,
    SHOOTING,
    TACKLING,
    POSITIONING,
    GOALKEEPING
  }

  public static final class Player {
    public double x, y, vx, vy, face, energy = 100, skill = 65, delay;
    public double previousX, previousY, previousFace, previousStride, previousDive;
    double stride, dive, diveSide, burst, cooldown, fatigue;

    double attribute(Attribute a) {
      int variation = Math.floorMod((shirt * 43 + 11) * (a.ordinal() * 7 + 19), 19) - 9;
      return clamp(skill + variation, 1, 99);
    }

    boolean sprinting;
    public int shirt, goals, assists, passes, complete, shots, tackles, cards;
  }

  public static final class Input {
    public double x, y, power = .45;
    public boolean sprint;
    public int action;

    public void clear() {
      x = y = 0;
      sprint = false;
      power = .45;
      action = 0;
    }
  }

  public static final int PASS = 1, SHOOT = 2, THROUGH = 3, SWITCH = 4, TACKLE = 5, PRESS_BALL = 6;
  public final Player[] players = new Player[22];
  public final int[] goals = new int[2],
      shots = new int[2],
      onTarget = new int[2],
      corners = new int[2],
      cards = new int[2],
      chances = new int[2],
      passes = new int[2],
      saves = new int[2],
      possession = new int[2],
      formations = {0, 0},
      press = {1, 1},
      approach = {1, 1};
  public final double[] xg = new double[2];
  public final ArrayList<String> log = new ArrayList<>();
  public Phase phase = Phase.PRE_KICKOFF;
  public int tick,
      half = 1,
      kickSide,
      owner = -1,
      last = -1,
      receiver = -1,
      assist = -1,
      selected = 9,
      locked = -1,
      restartType,
      restartSide,
      kicks,
      subCount;
  public double bx, by, bz = R, bvx, bvy, bvz, spin;
  public boolean manual = true;
  boolean openingPass, shotInFlight, partialStats, throwInFlight;
  double topSpin, momentum, counterPress;
  int deflectedShot = -1;
  final int[] completed = new int[2];
  private final TeamShape shape = new TeamShape();
  private int rng, restartWait;
  private double decision, sinceKick, accum, pressureRun;
  double netX, netY, netZ, netVX, netVY, netVZ;
  int netEvent;
  double previousBallX, previousBallY, previousBallZ;

  double blend() {
    return clamp(accum * HZ, 0, 1);
  }

  private void snapshot() {
    for (Player p : players) {
      p.previousX = p.x;
      p.previousY = p.y;
      p.previousFace = p.face;
      p.previousStride = p.stride;
      p.previousDive = p.dive;
    }
    previousBallX = bx;
    previousBallY = by;
    previousBallZ = bz;
  }

  private static int team(int i) {
    return i / 11;
  }

  public int dir(int side) {
    return (half == 1 ? 1 : -1) * (side == 0 ? 1 : -1);
  }

  public Motor12(int seed) {
    rng = seed == 0 ? 1 : seed;
    for (int i = 0; i < 22; i++) {
      players[i] = new Player();
      players[i].shirt = i % 11 + 1;
      players[i].skill = 58 + random() * 15;
    }
    lineUp(0, true);
  }

  private double random() {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng & 0xffffffffL) / 4294967296.0;
  }

  static double clamp(double n, double a, double b) {
    return Math.max(a, Math.min(b, n));
  }

  void record(String s) {
    log.add(0, clock() + "  " + s);
    if (log.size() > 512) log.remove(512);
  }

  public String clock() {
    int s = tick * 18 / HZ;
    return String.format(Locale.ROOT, "%02d:%02d", s / 60, s % 60);
  }

  public String newest() {
    return log.isEmpty() ? "Bolden ligger på midterpletten" : log.get(0);
  }

  private void stillBall(double x, double y) {
    bx = x;
    by = y;
    bz = R;
    bvx = bvy = bvz = spin = 0;
    throwInFlight = false;
    deflectedShot = -1;
    topSpin = 0;
    openingPass = shotInFlight = false;
    owner = last = receiver = assist = -1;
    sinceKick = 0;
  }

  private void lineUp(int side, boolean first) {
    kickSide = side;
    phase = first ? Phase.PRE_KICKOFF : Phase.KICKOFF_READY;
    stillBall(0, 0);
    pressureRun = counterPress = 0;
    for (int i = 0; i < 22; i++) {
      Player p = players[i];
      int t = team(i), j = i % 11, d = dir(t), f = formations[t];
      p.x = (-L + DEPTH[f][j]) * d;
      p.y = LANE[f][j];
      p.vx = p.vy = p.delay = p.dive = p.burst = 0;
      p.sprinting = false;
      p.face = d == 1 ? 0 : Math.PI;
      if (t != side && Math.hypot(p.x, p.y) < 9.4) p.x = -9.5 * d;
    }
    int d = dir(side);
    Player kicker = players[side * 11 + 9], partner = players[side * 11 + 6];
    kicker.x = -1.22 * d;
    kicker.y = -.34 * d;
    kicker.face = Math.atan2(-kicker.y, -kicker.x);
    partner.x = -2.05 * d;
    partner.y = 1.65 * d;
    partner.face = Math.atan2(-partner.y, -partner.x);
    selected = locked >= 0 ? locked : (side == 0 ? 9 : 6);
    restartWait = 0;
    snapshot();
  }

  boolean awaitingKickoff() {
    return phase == Phase.PRE_KICKOFF || phase == Phase.KICKOFF_READY;
  }

  // TEST75 stored a different arrangement and no countdown while waiting for its button.
  void restoreLegacyKickoff() {
    if (awaitingKickoff()) lineUp(kickSide, phase == Phase.PRE_KICKOFF);
  }

  public void resetClock() {
    accum = 0;
    snapshot();
  }

  public boolean kickOff() {
    if (!awaitingKickoff()) return false;
    phase = Phase.KICKOFF_RUNUP;
    restartWait = (int) (.4 * HZ);
    resetClock();
    return true;
  }

  private void centrePass() {
    int p = kickSide * 11 + 9, r = kickSide * 11 + 6;
    phase = Phase.PLAY;
    send(p, players[r].x, players[r].y, 5.2, 0, r);
    openingPass = true;
    passes[kickSide]++;
    players[p].passes++;
    assist = p;
    record("Afspark");
  }

  private void send(int p, double x, double y, double pace, double loft, int target) {
    double dx = x - bx, dy = y - by, h = Math.max(.01, Math.hypot(dx, dy));
    throwInFlight = false;
    deflectedShot = -1;
    topSpin = 0;
    openingPass = shotInFlight = false;
    bvx = pace * dx / h;
    bvy = pace * dy / h;
    bvz = loft;
    bz = Math.max(bz, R);
    last = p;
    owner = -1;
    receiver = target;
    sinceKick = 0;
    players[p].delay = .44;
    kicks++;
  }

  public void advance(double dt, Input in) {
    if (phase == Phase.FULL_TIME || awaitingKickoff()) {
      accum = 0;
      in.action = 0;
      return;
    }
    accum += clamp(dt, 0, .15);
    while (accum + 1e-9 >= DT) {
      accum -= DT;
      snapshot();
      Phase before = phase;
      step(in);
      if (before != phase) snapshot();
      if (phase == Phase.FULL_TIME || awaitingKickoff()) {
        accum = 0;
        break;
      }
    }
  }

  public void tactics(int formation, int pressure, int mentality) {
    formations[0] = formation;
    press[0] = pressure;
    approach[0] = mentality;
    if (phase == Phase.PRE_KICKOFF || phase == Phase.KICKOFF_READY)
      lineUp(kickSide, phase == Phase.PRE_KICKOFF);
    record("Taktik · " + Career.FORMATIONS[formation]);
  }

  private int nearest(int t, double x, double y, int skip, boolean keeper) {
    int best = -1;
    double min = Double.MAX_VALUE;
    for (int i = t * 11 + (keeper ? 0 : 1); i < t * 11 + 11; i++) {
      if (i == skip) continue;
      Player p = players[i];
      double d = Math.hypot(p.x - x, p.y - y);
      if (d < min) {
        min = d;
        best = i;
      }
    }
    return best;
  }

  private int target(int p, double ax, double ay) {
    int t = team(p), best = -1;
    double bestScore = -1e9;
    Player a = players[p];
    if (Math.hypot(ax, ay) < .12) {
      ax = dir(t);
      ay = 0;
    }
    for (int i = t * 11; i < t * 11 + 11; i++) {
      if (i == p) continue;
      Player b = players[i];
      double dx = b.x - a.x, dy = b.y - a.y, r = Math.max(1, Math.hypot(dx, dy));
      Player marker = players[nearest(1 - t, b.x, b.y, -1, true)];
      double openness = Math.min(8, Math.hypot(marker.x - b.x, marker.y - b.y));
      double clearance = 8;
      for (int j = (1 - t) * 11; j < (1 - t) * 11 + 11; j++) {
        Player defender = players[j];
        double along = clamp(((defender.x - a.x) * dx + (defender.y - a.y) * dy) / (r * r), 0, 1);
        clearance =
            Math.min(
                clearance,
                Math.hypot(defender.x - a.x - along * dx, defender.y - a.y - along * dy));
      }
      double score =
          clearance * (.34 + a.attribute(Attribute.VISION) * .007)
              + (dx * ax + dy * ay) / r * 13
              - r * .17
              + openness * .65
              + (i % 11 == 0 ? -5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  private void pass(int p, boolean through, double ax, double ay, int requested) {
    int t = team(p), r = requested >= 0 ? requested : target(p, ax, ay);
    Player q = players[r];
    double distance = Math.hypot(q.x - bx, q.y - by);
    double travel = clamp(.28 + distance * .025, .34, 1.2);
    double nx = dir(t), ny = 0;
    if (Math.hypot(ax, ay) > .25) {
      double len = Math.hypot(ax, ay);
      nx = ax / len;
      ny = ay / len;
    }
    double lead = through ? clamp(2 + distance * .12, 2.2, 7) : 0;
    double x = clamp(q.x + q.vx * travel + nx * lead, -51.4, 51.4);
    double y = clamp(q.y + q.vy * travel + ny * lead, -33.4, 33.4);
    double range = Math.hypot(x - bx, y - by);
    double error =
        clamp(
            1 - (players[p].attribute(Attribute.PASSING) + .16 * players[p].energy) / 112, .08, .7);
    y = clamp(y + (random() - .5) * error * (through ? 3.5 : 1.4), -33.4, 33.4);
    send(p, x, y, clamp(5.7 + range * (through ? .54 : .48), 6.5, through ? 25 : 22), 0, r);
    if (through) record("Stikning · #" + players[p].shirt);
    assist = p;
    passes[t]++;
    players[p].passes++;
  }

  private void throwIn(int p, int action, double ax, double ay) {
    int r = target(p, ax, ay);
    Player q = players[r];
    double x = q.x + q.vx * .55, y = q.y + q.vy * .55;
    if (action == THROUGH) {
      x += dir(team(p)) * 3.5;
      y += ay * 2;
    }
    double dx = x - bx, dy = y - by, range = Math.max(1, Math.hypot(dx, dy));
    double distance = Math.min(range, action == SHOOT ? 27 : 19);
    double flight = .69 + .025 * distance;
    bz = 1.92;
    send(
        p,
        bx + dx,
        by + dy,
        distance / flight * 1.025,
        Math.max(2.1, (.5 * BallPhysics.GRAVITY * flight * flight - 1.15) / flight),
        r);
    throwInFlight = true;
    topSpin = -6;
    assist = p;
  }

  private void shoot(int p, double sideAim, double power) {
    int t = team(p), d = dir(t);
    double range = Math.hypot(L * d - bx, by);
    double angle = Math.atan2(Math.abs(by), Math.max(1, L - bx * d));
    double error =
        (.55 + range * .05 + angle * 1.3 + power * power)
            * (1.6 - players[p].attribute(Attribute.SHOOTING) / 100);
    double aim = sideAim * 3.45 + (random() - .5) * error;
    if (range < 17) chances[t]++;
    shots[t]++;
    players[p].shots++;
    xg[t] += .61 * Math.exp(-range / 21);
    send(
        p,
        d * (L + 1),
        aim,
        clamp(11 + 12 * power + players[p].skill * .075, 14, 31),
        clamp(range * (phase == Phase.RESTART ? .205 : .17 + .035 * power), .9, 6.4),
        -1);
    shotInFlight = true;
    topSpin = 4 + power * 8;
    spin = -sideAim * d * .16;
    record(range < 17 ? "Stor chance" : "Afslutning");
  }

  private void receive(int i) {
    if (receiver >= 0 && last >= 0 && last != i && team(last) == team(i) && !throwInFlight) {
      players[last].complete++;
      completed[team(last)]++;
    }
    if (last >= 0 && team(last) != team(i)) counterPress = 4;
    if (last >= 0 && team(last) != team(i)) assist = -1;
    if (shotInFlight
        && last >= 0
        && team(last) != team(i)
        && Goalkeeping.inArea(this, i, players[i].x, players[i].y)) {
      saves[team(i)]++;
      onTarget[team(last)]++;
      record("Målmandsredning");
    }
    throwInFlight = false;
    deflectedShot = -1;
    topSpin = 0;
    openingPass = shotInFlight = false;
    owner = i;
    last = i;
    receiver = -1;
    // Cushion the incoming ball. Its position remains continuous through the first touch.
    bvx = .21 * bvx + .52 * players[i].vx;
    bvy = .21 * bvy + .52 * players[i].vy;
    bvz = Math.min(0, bvz * .22);
    spin *= .3;
    decision = .38 + random() * .9;
    if (manual && locked < 0 && team(i) == 0) selected = i;
  }

  private void restart(int type, int side, double x, double y) {
    stillBall(x, y);
    phase = Phase.RESTART;
    restartType = type;
    if (type == 3) corners[side]++;
    restartSide = side;
    restartWait = 55 * HZ / 60;
    int taker = taker();
    Player p = players[taker];
    p.x = x - dir(side) * .75;
    p.y = y;
    p.vx = p.vy = 0;
    if (side == 0 && locked < 0) selected = taker;
    if (type == 1 && Math.hypot(dir(side) * L - x, y) < 35) {
      double dx = dir(side) * L - x, dy = -y, l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
      for (int j = 1; j <= 4; j++) {
        Player w = players[(1 - side) * 11 + j];
        double off = (j - 2.5) * .8;
        w.x = x + dx * 9.15 - dy * off;
        w.y = y + dy * 9.15 + dx * off;
        w.vx = w.vy = 0;
      }
    }
    record(restartName());
  }

  public static Motor12 practice(boolean freeKick) {
    Motor12 m = new Motor12(77);
    double x = freeKick ? 31 : -47, y = freeKick ? 3 : -4;
    for (int i = 0; i < 22; i++) {
      int t = i / 11, j = i % 11;
      Player p = m.players[i];
      p.x = clamp((DEPTH[0][j] * 1.65 - L) * m.dir(t) + x * .28, -50, 50);
      p.y = LANE[0][j] * .91;
    }
    m.players[0].x = -51;
    m.players[11].x = 51;
    m.restart(freeKick ? 1 : 2, 0, x, y);
    m.players[m.taker()].x -= .6;
    m.resetClock();
    return m;
  }

  int taker() {
    return restartSide * 11 + (restartType == 2 ? 0 : 7);
  }

  String restartName() {
    return new String[] {"Indkast", "Frispark", "Målspark", "Hjørnespark"}[restartType];
  }

  private void step(Input in) {
    int action = in.action;
    in.action = 0;
    if (phase == Phase.KICKOFF_RUNUP) {
      // The clock stays still while the kicker takes the final step to the ball.
      int ticks = (int) (.4 * HZ);
      double u = clamp((ticks - restartWait + .5) / ticks, 0, 1);
      restartWait--;
      Player kicker = players[kickSide * 11 + 9], partner = players[kickSide * 11 + 6];
      double stride = 6 * u * (1 - u) / .4;
      kicker.vx = .90 * dir(kickSide) * stride;
      kicker.vy = .24 * dir(kickSide) * stride;
      kicker.x += kicker.vx * DT;
      kicker.y += kicker.vy * DT;
      kicker.stride += Math.hypot(kicker.vx, kicker.vy) * DT / 1.7;
      double footAngle = Math.atan2(partner.y - kicker.y, partner.x - kicker.x);
      kicker.face += clamp(Locomotion.angleDelta(kicker.face, footAngle), -6 * DT, 6 * DT);
      if (restartWait <= 0) centrePass();
      return;
    }
    pressureRun = Math.max(0, pressureRun - DT);
    counterPress = Math.max(0, counterPress - DT);
    if (action == PRESS_BALL) pressureRun = .9;
    if (phase == Phase.RESTART) {
      int p = taker();
      boolean user = manual && restartSide == 0 && (locked < 0 || locked == p);
      if (user && action != PASS && action != SHOOT && action != THROUGH) return;
      if (!user && --restartWait > 0) return;
      if (restartType == 0) throwIn(p, action, user ? in.x : dir(restartSide), user ? in.y : 0);
      else if (user && action == SHOOT && restartType == 2)
        send(p, bx + dir(0) * 45, by + in.y * 23, 28, 7, -1);
      else if (user && action == SHOOT) shoot(p, in.y, in.power);
      else
        pass(
            p,
            action == THROUGH || restartType == 3,
            user ? in.x : dir(restartSide),
            user ? in.y : 0,
            -1);
      phase = Phase.PLAY;
      return;
    }
    tick++;
    sinceKick += DT;
    if (tick == HALF) {
      half = 2;
      lineUp(1, false);
      record("Halvleg");
      return;
    }
    if (tick >= 2 * HALF) {
      phase = Phase.FULL_TIME;
      record("Slutfløjt");
      return;
    }
    int ballSide = owner >= 0 ? team(owner) : last >= 0 ? team(last) : kickSide;
    if (owner >= 0) possession[ballSide]++;
    double territory = (ballSide == 0 ? 1 : -1) * (44 + 48 * clamp(bx * dir(ballSide) / L, -1, 1));
    momentum += (territory - momentum) * (-Math.expm1(-DT / 6));
    if (manual && locked < 0) {
      if (action == SWITCH) selected = nearest(0, bx, by, selected, false);
      else if (owner >= 0 && ballSide == 0) selected = owner;
      else if (receiver >= 0 && team(receiver) == 0) selected = receiver;
    } else if (locked >= 0) selected = locked;
    if (manual
        && selected != owner
        && owner >= 0
        && ballSide == 0
        && action == PASS
        && locked >= 0) {
      pass(owner, false, 0, 0, selected);
      action = 0;
    }
    shape.prepare(this, ballSide);
    Goalkeeping.position(this, 0, shape, sinceKick);
    Goalkeeping.position(this, 1, shape, sinceKick);
    for (int i = 0; i < 22; i++) movePlayer(i, ballSide, in);
    TeamShape.resolveBodies(players);
    double oldX = bx, oldY = by, oldZ = bz;
    if (owner >= 0) {
      int holder = owner;
      Player a = players[holder];
      BallPhysics.dribble(this, a);
      if (outOfPlay(oldX, oldY, oldZ, ballSide)) return;
      boolean controlled = manual && holder == selected;
      decision -= DT;
      if (controlled) {
        if (action == SHOOT) shoot(holder, in.y, in.power);
        else if (action == PASS || action == THROUGH)
          pass(holder, action == THROUGH, in.x, in.y, -1);
      } else if (decision <= 0) {
        if ((L - bx * dir(ballSide)) < 24 && Math.abs(by) < 22 && random() < .78) {
          Player keeper = players[(1 - ballSide) * 11];
          double nearPost = keeper.y + keeper.vy * .25;
          double side = Math.abs(nearPost) > .3 ? -Math.signum(nearPost) : (random() < .5 ? -1 : 1);
          if (random() < .16) side = -side;
          shoot(holder, side * (.78 + .23 * random()), .57 + .38 * random());
        } else if (random() < .70) pass(holder, random() < .28, dir(ballSide), 0, -1);
        else decision = .4 + random() * .8;
      }
      if (owner == holder) {
        int defender = nearest(1 - ballSide, bx, by, -1, true);
        Player b = players[defender];
        double gap = Math.hypot(b.x - bx, b.y - by);
        boolean tackling = manual && defender == selected && action == TACKLE;
        if (gap < (tackling ? 2.7 : 1.22)
            && a.delay <= 0
            && (tackling || random() < .01765 * (.70 + .005 * b.attribute(Attribute.TACKLING)))) {
          if (random() < (tackling ? .18 : .055)) {
            if (random() < .45) {
              b.cards++;
              cards[team(defender)]++;
              record("Gult kort · " + (defender < 11 ? "Hjemme" : "Ude") + " #" + b.shirt);
            }
            restart(1, ballSide, a.x, a.y);
          } else {
            b.tackles++;
            record("Bolderobring · #" + b.shirt);
            receive(defender);
            b.delay = .55;
          }
        }
      }
    } else {
      BallPhysics.step(this, DT);
      double fx = crossing(oldX, bx, L + R), fy = crossing(oldY, by, W + R);
      if (touchOnPath(oldX, oldY, oldZ, Math.min(1, Math.min(fx, fy)))) return;
      outOfPlay(oldX, oldY, oldZ, ballSide);
    }
  }

  private void movePlayer(int i, int ballSide, Input input) {
    Player p = players[i];
    int side = team(i);
    p.delay = Math.max(0, p.delay - DT);
    boolean mine = manual && selected == i, carrying = owner == i;
    double dx = shape.x[i] - p.x, dy = shape.y[i] - p.y, distance = Math.hypot(dx, dy);
    double x, y;
    boolean pressInput =
        mine && pressureRun > 0 && ballSide != side && Math.hypot(input.x, input.y) < .13;
    if (pressInput) {
      dx = bx - p.x;
      dy = by - p.y;
      distance = Math.hypot(dx, dy);
    }
    if (mine && !pressInput) {
      x = input.x;
      y = input.y;
    } else {
      // Arrival steering eases the last few metres into the passing lane.
      double scale = 1 / Math.max(i == receiver || carrying ? .9 : 2.6, distance);
      x = dx * scale;
      y = dy * scale;
    }
    boolean sprint =
        mine
            ? input.sprint
            : i % 11 != 0
                && distance > 5
                && (i == shape.runner && side == ballSide
                    || i == shape.first[side] && side != ballSide && press[side] >= 2);
    double magnitude = Math.hypot(x, y);
    Locomotion.sprintState(p, sprint, magnitude);
    double max =
        (4.65 + p.attribute(Attribute.PACE) * .021)
            * (i % 11 == 0 ? .83 : 1)
            * (.68 + .32 * Math.sqrt(clamp(p.energy, 0, 100) / 100));
    if (p.sprinting) max *= 1.46;
    if (carrying)
      max *=
          p.sprinting
              ? .90 + .05 * p.attribute(Attribute.DRIBBLING) / 99
              : .94 + .04 * p.attribute(Attribute.DRIBBLING) / 99;
    double divisor = Math.max(1, magnitude);
    double vx = x / divisor * max + shape.avoidX[i], vy = y / divisor * max + shape.avoidY[i];
    if (i % 11 == 0 && p.dive > 0) {
      double extension = Goalkeeping.extension(p.dive);
      vx *= .2;
      vy = p.diveSide * 6 * extension;
    }
    Locomotion.move(p, vx, vy, carrying, i % 11 == 0 && !carrying, bx, by);
  }

  private static double crossing(double from, double to, double limit) {
    if (Math.abs(to) <= limit) return Double.POSITIVE_INFINITY;
    return from == to ? 0 : clamp((Math.copySign(limit, to) - from) / (to - from), 0, 1);
  }

  private boolean outOfPlay(double oldX, double oldY, double oldZ, int ballSide) {
    if (Math.abs(bx) > L + R || Math.abs(by) > W + R) {
      double fx = crossing(oldX, bx, L + R), fy = crossing(oldY, by, W + R);
      if (fy < fx) {
        restart(
            0, 1 - ballSide, clamp(oldX + (bx - oldX) * fy, -51, 51), Math.copySign(W - .2, by));
        return true;
      }
      int attack = (bx > 0) == (dir(0) > 0) ? 0 : 1;
      if (Math.abs(oldY + (by - oldY) * fx) < 3.66 - R && oldZ + (bz - oldZ) * fx < 2.44 - R) {
        netX = Math.copySign(L + R, bx);
        netY = oldY + (by - oldY) * fx;
        netZ = Math.max(R, oldZ + (bz - oldZ) * fx);
        netVX = bvx; netVY = bvy; netVZ = bvz; netEvent++;
        goals[attack]++;
        if (shotInFlight && last >= 0 && team(last) == attack) onTarget[attack]++;
        if (deflectedShot >= 0 && team(deflectedShot) == attack)
          saves[1 - attack] = Math.max(0, saves[1 - attack] - 1);
        int scorer = deflectedShot >= 0 ? deflectedShot : last;
        if (scorer >= 0 && team(scorer) == attack) players[scorer].goals++;
        if (assist >= 0 && assist != scorer && team(assist) == attack) players[assist].assists++;
        lineUp(1 - attack, false);
        record("MÅL · " + goals[0] + "–" + goals[1]);
      } else if (ballSide == attack)
        restart(2, 1 - attack, Math.signum(bx) * 47, Math.copySign(4, by));
      else restart(3, attack, Math.signum(bx) * 52, Math.copySign(33.6, by));
      return true;
    }
    return false;
  }

  private boolean touchOnPath(double x0, double y0, double z0, double limit) {
    int best = -1;
    double first = Double.POSITIVE_INFINITY;
    for (int i = 0; i < 22; i++) {
      Player p = players[i];
      if (i == last && (openingPass || sinceKick < .32)) continue;
      boolean hands = Goalkeeping.inArea(this, i, p.x, p.y);
      double stretch = hands ? Goalkeeping.extension(p.dive) : 0;
      double hx = p.previousX, hy = p.previousY + p.diveSide * stretch * .66;
      double dx = x0 - hx, dy = y0 - hy;
      double vx = bx - x0 - (p.x - p.previousX), vy = by - y0 - (p.y - p.previousY);
      double radius = hands ? .99 + stretch * .46 : .77;
      // First entry into a moving contact disc, before either boundary is crossed.
      double vv = vx * vx + vy * vy,
          along = dx * vx + dy * vy,
          c = dx * dx + dy * dy - radius * radius;
      if (c > 0 && (vv < 1e-10 || along >= 0)) continue;
      double disc = along * along - vv * c;
      if (c > 0 && disc < 0) continue;
      double time = c <= 0 ? 0 : (-along - Math.sqrt(disc)) / vv;
      if (time > limit
          || time >= first
          || z0 + (bz - z0) * time > (hands ? 2.03 + stretch * .39 : 1.30)) continue;
      first = time;
      best = i;
    }
    if (best < 0) return false;
    bx = x0 + (bx - x0) * first;
    by = y0 + (by - y0) * first;
    bz = Math.max(R, z0 + (bz - z0) * first);
    Player p = players[best];
    int side = team(best);
    double pace = Math.hypot(bvx - p.vx, bvy - p.vy);
    boolean hands = Goalkeeping.inArea(this, best, p.x, p.y);
    if (hands
        && shotInFlight
        && last >= 0
        && team(last) != side
        && (pace > 17.5 + p.skill * .045 || (p.dive > 0 && pace > 13))) {
      saves[side]++;
      onTarget[1 - side]++;
      record("Målmandsparade · returbold");
      double wide = by - p.y;
      if (Math.abs(wide) < .08) wide = bvy == 0 ? p.y + .01 : bvy;
      boolean tip = p.dive > 0 && Math.abs(wide) > .35;
      bvx = dir(side) * (tip ? -1 : 1) * clamp(pace * (tip ? .20 : .29), 3.3, 9);
      bvy = Math.copySign(clamp(pace * .46, 4.2, 13), wide);
      bvz = clamp(pace * .12, 1.7, 4.4);
      spin *= -.33;
      deflectedShot = last;
      last = best;
      receiver = -1;
      openingPass = shotInFlight = false;
      sinceKick = 0;
      p.delay = .38;
    } else if (!hands && shotInFlight && pace > 13 && last >= 0 && team(last) != side) {
      // A driven shot striking an outfield body loses its normal velocity and glances off.
      double nx = bx - p.x, ny = by - p.y, len = Math.hypot(nx, ny);
      if (len < .01) {
        nx = -bvx;
        ny = -bvy;
        len = Math.max(.01, Math.hypot(nx, ny));
      }
      nx /= len;
      ny /= len;
      double approach = Math.min(0, (bvx - p.vx) * nx + (bvy - p.vy) * ny);
      bvx = p.vx + .57 * (bvx - p.vx - 1.35 * approach * nx);
      bvy = p.vy + .57 * (bvy - p.vy - 1.35 * approach * ny);
      bvz = .32 * Math.abs(bvz) + 1.1;
      last = best;
      sinceKick = 0;
      receiver = assist = deflectedShot = -1;
      shotInFlight = false;
      record("Blokeret skud · #" + p.shirt);
    } else receive(best);
    return true;
  }

  void upgradeClock() {
    tick = (int) Math.ceil(tick * (double) HALF / (90 * 60));
    restartWait *= HZ / 60;
    for (int side = 0; side < 2; side++) {
      possession[side] *= HZ / 60;
      for (int j = 0; j < 11; j++) completed[side] += players[side * 11 + j].complete;
    }
  }

  void writeMotion(DataOutput out) throws IOException {
    out.writeDouble(pressureRun);
    out.writeDouble(counterPress);
    out.writeDouble(momentum);
    out.writeDouble(topSpin);
    out.writeInt(deflectedShot);
    out.writeBoolean(throwInFlight);
    for (int count : completed) out.writeInt(count);
    for (Player p : players) {
      out.writeDouble(p.stride);
      out.writeDouble(p.dive);
      out.writeDouble(p.diveSide);
      out.writeDouble(p.fatigue);
      out.writeDouble(p.cooldown);
      out.writeDouble(p.burst);
      out.writeBoolean(p.sprinting);
    }
  }

  void readMotion(DataInput in) throws IOException {
    pressureRun = readRange(in, 0, 1);
    counterPress = readRange(in, 0, 4);
    momentum = readRange(in, -100, 100);
    topSpin = readRange(in, -100, 100);
    deflectedShot = in.readInt();
    throwInFlight = in.readBoolean();
    if (deflectedShot < -1 || deflectedShot >= 22) throw new IOException("Sidste skytte");
    for (int i = 0; i < 2; i++) {
      completed[i] = in.readInt();
      if (completed[i] < 0) throw new IOException("Afleveringer");
    }
    for (Player p : players) {
      p.stride = readRange(in, 0, 1e7);
      p.dive = readRange(in, 0, Goalkeeping.DIVE);
      p.diveSide = readRange(in, -1, 1);
      p.fatigue = readRange(in, 0, 100);
      p.cooldown = readRange(in, 0, 2.4);
      p.burst = readRange(in, 0, .35);
      p.sprinting = in.readBoolean();
    }
    resetClock();
  }

  private static double readRange(DataInput in, double low, double high) throws IOException {
    double value = in.readDouble();
    if (!Double.isFinite(value) || value < low || value > high)
      throw new IOException("Bevægelsesdata");
    return value;
  }

  public void write(DataOutput o) throws IOException {
    for (int v :
        new int[] {
          phase.ordinal(),
          tick,
          half,
          kickSide,
          owner,
          last,
          receiver,
          assist,
          selected,
          locked,
          restartType,
          restartSide,
          kicks,
          subCount,
          rng,
          restartWait
        }) o.writeInt(v);
    for (double v : new double[] {bx, by, bz, bvx, bvy, bvz, spin, decision, sinceKick})
      o.writeDouble(v);
    o.writeBoolean(manual);
    for (int[] a :
        new int[][] {goals, shots, passes, saves, possession, formations, press, approach})
      for (int v : a) o.writeInt(v);
    for (double v : xg) o.writeDouble(v);
    for (Player p : players) {
      for (double v : new double[] {p.x, p.y, p.vx, p.vy, p.face, p.energy, p.skill, p.delay})
        o.writeDouble(v);
      for (int v :
          new int[] {
            p.shirt, p.goals, p.assists, p.passes, p.complete, p.shots, p.tackles, p.cards
          }) o.writeInt(v);
    }
    o.writeInt(log.size());
    for (String s : log) o.writeUTF(s);
  }

  public static Motor12 read(DataInput i) throws IOException {
    Motor12 m = new Motor12(1);
    m.phase = Phase.values()[i.readInt()];
    m.tick = i.readInt();
    m.half = i.readInt();
    m.kickSide = i.readInt();
    m.owner = i.readInt();
    m.last = i.readInt();
    m.receiver = i.readInt();
    m.assist = i.readInt();
    m.selected = i.readInt();
    m.locked = i.readInt();
    m.restartType = i.readInt();
    m.restartSide = i.readInt();
    m.kicks = i.readInt();
    m.subCount = i.readInt();
    m.rng = i.readInt();
    m.restartWait = i.readInt();
    m.bx = i.readDouble();
    m.by = i.readDouble();
    m.bz = i.readDouble();
    m.bvx = i.readDouble();
    m.bvy = i.readDouble();
    m.bvz = i.readDouble();
    m.spin = i.readDouble();
    m.decision = i.readDouble();
    m.sinceKick = i.readDouble();
    m.manual = i.readBoolean();
    for (int[] a :
        new int[][] {
          m.goals, m.shots, m.passes, m.saves, m.possession, m.formations, m.press, m.approach
        }) for (int n = 0; n < 2; n++) a[n] = i.readInt();
    for (int n = 0; n < 2; n++) m.xg[n] = i.readDouble();
    for (Player p : m.players) {
      p.x = i.readDouble();
      p.y = i.readDouble();
      p.vx = i.readDouble();
      p.vy = i.readDouble();
      p.face = i.readDouble();
      p.energy = i.readDouble();
      p.skill = i.readDouble();
      p.delay = i.readDouble();
      p.shirt = i.readInt();
      p.goals = i.readInt();
      p.assists = i.readInt();
      p.passes = i.readInt();
      p.complete = i.readInt();
      p.shots = i.readInt();
      p.tackles = i.readInt();
      p.cards = i.readInt();
      if (!Double.isFinite(p.x) || !Double.isFinite(p.energy) || p.shirt < 1 || p.shirt > 18)
        throw new IOException("Spillerdata");
    }
    int count = i.readInt();
    if (count < 0
        || count > 512
        || m.tick < 0
        || m.tick > 2 * HALF
        || m.half < 1
        || m.half > 2
        || m.selected < 0
        || m.selected >= 11
        || m.locked >= 11
        || m.locked < -1
        || m.owner >= 22
        || m.owner < -1
        || m.last < -1
        || m.last >= 22
        || m.receiver < -1
        || m.receiver >= 22
        || m.kickSide < 0
        || m.kickSide > 1
        || m.restartSide < 0
        || m.restartSide > 1
        || m.restartType < 0
        || m.restartType > 3
        || !Double.isFinite(m.bx)
        || !Double.isFinite(m.by)) throw new IOException("Kampdata");
    for (int t = 0; t < 2; t++)
      if (m.formations[t] < 0
          || m.formations[t] > 2
          || m.press[t] < 0
          || m.press[t] >= Career.PRESS.length
          || m.approach[t] < 0
          || m.approach[t] >= Career.STYLE.length) throw new IOException("Kampplan");
    for (int n = 0; n < count; n++) m.log.add(i.readUTF());
    m.resetClock();
    return m;
  }
}
