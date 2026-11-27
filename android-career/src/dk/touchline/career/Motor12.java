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

  public static final int HZ = 60, HALF = 90 * HZ;
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

  public static final class Player {
    public double x, y, vx, vy, face, energy = 100, skill = 65, delay;
    public double previousX, previousY;
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
  boolean openingPass, shotInFlight, partialStats;
  private int rng, restartWait;
  private double decision, sinceKick, accum, pressureRun;
  double previousBallX, previousBallY, previousBallZ;

  double blend() {
    return clamp(accum * HZ, 0, 1);
  }

  private void snapshot() {
    for (Player p : players) {
      p.previousX = p.x;
      p.previousY = p.y;
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
    int s = tick / 2;
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
    openingPass = shotInFlight = false;
    owner = last = receiver = assist = -1;
    sinceKick = 0;
  }

  private void lineUp(int side, boolean first) {
    kickSide = side;
    phase = first ? Phase.PRE_KICKOFF : Phase.KICKOFF_READY;
    stillBall(0, 0);
    pressureRun = 0;
    for (int i = 0; i < 22; i++) {
      Player p = players[i];
      int t = team(i), j = i % 11, d = dir(t), f = formations[t];
      p.x = (-L + DEPTH[f][j]) * d;
      p.y = LANE[f][j];
      p.vx = p.vy = p.delay = 0;
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
    restartWait = 24;
    resetClock();
    return true;
  }

  private void centrePass() {
    int p = kickSide * 11 + 9, r = kickSide * 11 + 6;
    phase = Phase.PLAY;
    send(p, players[r].x, players[r].y, 5.2, 0, r);
    openingPass = true;
    players[p].face = Math.atan2(bvy, bvx);
    passes[kickSide]++;
    players[p].passes++;
    assist = p;
    record("Afspark");
  }

  private void send(int p, double x, double y, double pace, double loft, int target) {
    double dx = x - bx, dy = y - by, h = Math.max(.01, Math.hypot(dx, dy));
    openingPass = shotInFlight = false;
    bvx = pace * dx / h;
    bvy = pace * dy / h;
    bvz = loft;
    bz = R;
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
      double score =
          (dx * ax + dy * ay) / r * 13 - r * .17 + openness * .65 + (i % 11 == 0 ? -5 : 0);
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
    double lead = through ? 4.8 : 0,
        x = clamp(q.x + q.vx * .42 + dir(t) * lead, -51, 51),
        y = clamp(q.y + q.vy * .42, -33, 33);
    double quality = clamp((players[p].skill + .2 * players[p].energy) / 115, .35, 1);
    y = clamp(y + (random() - .5) * (1 - quality) * (through ? 4 : 1.8), -33, 33);
    double range = Math.hypot(x - bx, y - by);
    send(p, x, y, clamp(7 + range * .41, 8, through ? 24 : 20), through && range > 20 ? 3.7 : 0, r);
    assist = p;
    passes[t]++;
    players[p].passes++;
  }

  private void shoot(int p, double sideAim, double power) {
    int t = team(p), d = dir(t);
    double range = Math.hypot(L * d - bx, by);
    double angle = Math.atan2(Math.abs(by), Math.max(1, L - bx * d));
    double error =
        (.55 + range * .05 + angle * 1.3 + power * power) * (1.6 - players[p].skill / 100);
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
        clamp(range * (phase == Phase.RESTART ? .205 : .088), .9, 6.4),
        -1);
    shotInFlight = true;
    spin = -sideAim * d * .16;
    record(range < 17 ? "Stor chance" : "Afslutning");
  }

  private void receive(int i) {
    if (receiver >= 0 && last >= 0 && last != i && team(last) == team(i)) players[last].complete++;
    if (last >= 0 && team(last) != team(i)) assist = -1;
    if (shotInFlight && last >= 0 && team(last) != team(i) && i % 11 == 0) {
      saves[team(i)]++;
      onTarget[team(last)]++;
      record("Målmandsredning");
    }
    openingPass = shotInFlight = false;
    owner = i;
    last = i;
    receiver = -1;
    bvx = bvy = bvz = spin = 0;
    bz = R;
    decision = .38 + random() * .9;
    if (manual && locked < 0 && team(i) == 0) selected = i;
  }

  private void restart(int type, int side, double x, double y) {
    stillBall(x, y);
    phase = Phase.RESTART;
    restartType = type;
    if (type == 3) corners[side]++;
    restartSide = side;
    restartWait = 55;
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
      if (--restartWait < 24) {
        Player kicker = players[kickSide * 11 + 9];
        kicker.vx = 2.2 * dir(kickSide);
        kicker.vy = .6 * dir(kickSide);
        kicker.x += kicker.vx * DT;
        kicker.y += kicker.vy * DT;
      }
      if (restartWait <= 0) centrePass();
      return;
    }
    pressureRun = Math.max(0, pressureRun - DT);
    if (action == PRESS_BALL) pressureRun = .9;
    if (phase == Phase.RESTART) {
      int p = taker();
      boolean user = manual && restartSide == 0 && (locked < 0 || locked == p);
      if (user && action != PASS && action != SHOOT && action != THROUGH) return;
      if (!user && --restartWait > 0) return;
      if (user && action == SHOOT && restartType == 2)
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
    int chase0 = nearest(0, bx, by, -1, false), chase1 = nearest(1, bx, by, -1, false);
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
    boolean inFlight = owner < 0;
    for (int i = 0; i < 22; i++) {
      Player p = players[i];
      p.delay = Math.max(0, p.delay - DT);
      int t = team(i), j = i % 11, d = dir(t), f = formations[t];
      boolean mine = manual && selected == i;
      double vx, vy, pace = (4.5 + p.skill * .025) * (.68 + .32 * p.energy / 100);
      if (mine) {
        vx = in.x;
        vy = in.y;
        if (in.sprint) pace *= 1.34;
        if (pressureRun > 0 && ballSide == 1 && Math.hypot(vx, vy) < .13) {
          double gap = Math.max(1, Math.hypot(bx - p.x, by - p.y));
          vx = (bx - p.x) / gap;
          vy = (by - p.y) / gap;
          pace *= 1.15;
        }
      } else {
        double tx, ty;
        if (j == 0) {
          tx = d * (-L + 2 + clamp((bx * d + L) * .12, 0, 9));
          ty = clamp(by * .36, -4.5, 4.5);
        } else if (i == owner) {
          tx = L * d;
          ty = p.y * .48;
        } else if (i == receiver
            || (i == (t == 0 ? chase0 : chase1) && (inFlight || ballSide != t))) {
          tx = bx + bvx * .15;
          ty = by + bvy * .15;
          pace *= .94 + press[t] * .13;
        } else {
          double possessionLift = ballSide == t ? 4 : -2;
          tx =
              clamp(
                  (DEPTH[f][j] * 1.65 - L + possessionLift + (approach[t] - 1) * 4) * d + bx * .28,
                  -49,
                  49);
          ty = LANE[f][j] * .91 + by * .17;
        }
        vx = tx - p.x;
        vy = ty - p.y;
        double dist = Math.hypot(vx, vy);
        if (dist > 1) {
          vx /= dist;
          vy /= dist;
        }
      }
      double len = Math.max(1, Math.hypot(vx, vy));
      double ease = 1 - Math.exp(-DT * 7);
      p.vx += (vx / len * pace - p.vx) * ease;
      p.vy += (vy / len * pace - p.vy) * ease;
      p.x = clamp(p.x + p.vx * DT, -L + .2, L - .2);
      p.y = clamp(p.y + p.vy * DT, -W + .2, W - .2);
      double v = Math.hypot(p.vx, p.vy);
      if (v > .2) p.face = Math.atan2(p.vy, p.vx);
      p.energy = clamp(p.energy - (v * .028 + (mine && in.sprint ? .1 : 0)) * DT, 24, 100);
    }
    if (owner >= 0) {
      int holder = owner;
      Player a = players[holder];
      bx = a.x + Math.cos(a.face) * .43;
      by = a.y + Math.sin(a.face) * .43;
      boolean controlled = manual && holder == selected;
      decision -= DT;
      if (controlled) {
        if (action == SHOOT) shoot(holder, in.y, in.power);
        else if (action == PASS || action == THROUGH)
          pass(holder, action == THROUGH, in.x, in.y, -1);
      } else if (decision <= 0) {
        if ((L - bx * dir(ballSide)) < 24 && Math.abs(by) < 22 && random() < .78)
          shoot(holder, (random() - .5) * 1.85, .68);
        else if (random() < .70) pass(holder, random() < .28, dir(ballSide), 0, -1);
        else decision = .4 + random() * .8;
      }
      if (owner == holder) {
        int defender = nearest(1 - ballSide, bx, by, -1, true);
        Player b = players[defender];
        double gap = Math.hypot(b.x - bx, b.y - by);
        boolean tackling = manual && defender == selected && action == TACKLE;
        if (gap < (tackling ? 2.7 : 1.22) && a.delay <= 0 && (tackling || random() < .035)) {
          if (random() < (tackling ? .18 : .055)) {
            if (random() < .45) {
              b.cards++;
              cards[team(defender)]++;
              record("Gult kort · " + (defender < 11 ? "Hjemme" : "Ude") + " #" + b.shirt);
            }
            restart(1, ballSide, a.x, a.y);
          } else {
            b.tackles++;
            receive(defender);
            b.delay = .55;
          }
        }
      }
    } else {
      double oldX = bx, oldY = by, oldZ = bz;
      double speed = Math.hypot(bvx, bvy),
          loss = bz > R + .005 ? .0028 * speed * speed : 2.1 + .009 * speed * speed;
      double scale = speed > .01 ? Math.max(0, 1 - loss * DT / speed) : 0;
      double sx = bvx;
      bvx = (bvx - spin * bvy * DT) * scale;
      bvy = (bvy + spin * sx * DT) * scale;
      spin *= .995;
      bx += bvx * DT;
      by += bvy * DT;
      bz += bvz * DT;
      bvz -= 9.81 * DT;
      if (bz <= R) {
        bz = R;
        bvz = bvz < -.9 ? -bvz * .43 : 0;
      }
      if (Math.abs(bx) > L + R || Math.abs(by) > W + R) {
        double fx =
            Math.abs(bx) > L + R
                ? (Math.copySign(L + R, bx) - oldX) / (bx - oldX)
                : Double.POSITIVE_INFINITY;
        double fy =
            Math.abs(by) > W + R
                ? (Math.copySign(W + R, by) - oldY) / (by - oldY)
                : Double.POSITIVE_INFINITY;
        if (fy < fx) {
          restart(
              0, 1 - ballSide, clamp(oldX + (bx - oldX) * fy, -51, 51), Math.copySign(W - .2, by));
          return;
        }
        int attack = (bx > 0) == (dir(0) > 0) ? 0 : 1;
        if (Math.abs(oldY + (by - oldY) * fx) < 3.66 - R && oldZ + (bz - oldZ) * fx < 2.44 - R) {
          goals[attack]++;
          if (shotInFlight && last >= 0 && team(last) == attack) onTarget[attack]++;
          if (last >= 0 && team(last) == attack) players[last].goals++;
          if (assist >= 0 && assist != last && team(assist) == attack) players[assist].assists++;
          lineUp(1 - attack, false);
          record("MÅL · " + goals[0] + "–" + goals[1]);
        } else if (ballSide == attack)
          restart(2, 1 - attack, Math.signum(bx) * 47, Math.copySign(4, by));
        else restart(3, attack, Math.signum(bx) * 52, Math.copySign(33.6, by));
        return;
      }
      int best = -1;
      double distance = 2.5;
      for (int i = 0; i < 22; i++) {
        Player p = players[i];
        if (i == last && (openingPass || sinceKick < .35)) continue;
        boolean keeper = i % 11 == 0 && Math.abs(p.x) > 36;
        double gap = Math.hypot(bx - p.x, by - p.y);
        if (bz < (keeper ? 2.5 : 1.45) && gap < (keeper ? 2 : 1.0) && gap < distance) {
          distance = gap;
          best = i;
        }
      }
      if (best >= 0) receive(best);
    }
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
          || m.press[t] > 2
          || m.approach[t] < 0
          || m.approach[t] > 2) throw new IOException("Kampplan");
    for (int n = 0; n < count; n++) m.log.add(i.readUTF());
    m.resetClock();
    return m;
  }
}
