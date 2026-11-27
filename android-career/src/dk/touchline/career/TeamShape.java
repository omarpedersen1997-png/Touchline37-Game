package dk.touchline.career;

import static dk.touchline.career.Motor12.*;

/** All assignments use the same pre-movement picture of the pitch. */
final class TeamShape {
  final double[] x = new double[22],
      y = new double[22],
      avoidX = new double[22],
      avoidY = new double[22];
  final int[] first = new int[2], cover = new int[2];
  int nearSupport, farSupport, runner;

  private static int line(int f, int j) {
    int depth = DEPTH[f][j];
    return depth < 20 ? 0 : depth < 40 ? 1 : 2;
  }

  void prepare(Motor12 m, int possession) {
    java.util.Arrays.fill(avoidX, 0);
    java.util.Arrays.fill(avoidY, 0);
    for (int side = 0; side < 2; side++) {
      first[side] = -1;
      cover[side] = -1;
      double best = Double.MAX_VALUE, second = best;
      for (int i = side * 11 + 1; i < side * 11 + 11; i++) {
        Player p = m.players[i];
        double dx = m.bx - p.x, dy = m.by - p.y;
        double closing = (dx * p.vx + dy * p.vy) / Math.max(1, Math.hypot(dx, dy));
        double cost =
            Math.hypot(dx, dy) - .32 * closing - .012 * p.attribute(Attribute.POSITIONING);
        if (m.manual && m.locked == i && side != possession) cost += 2;
        if (cost < best) {
          second = best;
          cover[side] = first[side];
          best = cost;
          first[side] = i;
        } else if (cost < second) {
          second = cost;
          cover[side] = i;
        }
      }
    }
    nearSupport = farSupport = runner = -1;
    double left = 1000, right = 1000, runScore = -1000;
    int dir = m.dir(possession);
    for (int i = possession * 11 + 1; i < possession * 11 + 11; i++) {
      if (i == m.owner) continue;
      Player p = m.players[i];
      int band = line(m.formations[possession], i % 11);
      double dx = (p.x - m.bx) * dir, dy = p.y - m.by, dist = Math.hypot(dx, dy);
      double cost = Math.abs(dist - 11) + Math.max(0, dx) * .55 + (band == 0 ? 6 : 0);
      if (dy <= 0 && cost < left) {
        nearSupport = i;
        left = cost;
      }
      if (dy > 0 && cost < right) {
        farSupport = i;
        right = cost;
      }
      if (band == 0 || dx < -8 || dx > 30) continue;
      double space = 12;
      for (int j = (1 - possession) * 11 + 1; j < (1 - possession) * 11 + 11; j++) {
        Player defender = m.players[j];
        space = Math.min(space, Math.hypot(p.x + 7 * dir - defender.x, p.y - defender.y));
      }
      double value = space + band * 2 - Math.abs(Math.abs(dy) - 10) * .18 - Math.abs(dx - 7) * .15;
      if (space > 3 && value > runScore) {
        runner = i;
        runScore = value;
      }
    }
    double deepest = -L, secondLast = -L;
    for (int i = (1 - possession) * 11; i < (2 - possession) * 11; i++) {
      double depth = m.players[i].x * dir;
      if (depth > deepest) {
        secondLast = deepest;
        deepest = depth;
      } else secondLast = Math.max(secondLast, depth);
    }
    double runLine = Math.min(L - 3, Math.max(0, Math.max(m.bx * dir, secondLast) - .5));
    for (int i = 0; i < 22; i++) {
      Player p = m.players[i];
      int side = i / 11, j = i % 11, d = m.dir(side), f = m.formations[side];
      boolean attacking = side == possession;
      int band = line(f, j);
      double mentality =
          m.approach[side] == 3 ? -2 : m.approach[side] == 4 ? 2 : m.approach[side] - 1;
      boolean regain = m.press[side] == 3 && !attacking && m.counterPress > 0;
      double pressure = m.press[side] == 3 ? (regain ? 2 : 0) : m.press[side] - 1;
      Player presser = m.players[first[side]];
      boolean engage =
          !attacking
              && (m.owner < 0
                  || d * m.bx < 14 + pressure * 16
                  || Math.hypot(presser.x - m.bx, presser.y - m.by) < 5.5);
      double height = mentality * 3.6 + pressure * (attacking ? 1.2 : 3.2);
      // The block travels together, compressing between its back line and front line when
      // defending.
      double depth = (DEPTH[f][j] * 1.36 - 43) * (attacking ? 1 : .86);
      x[i] = d * (depth + height + (attacking ? 4 : -4)) + m.bx * (.45 - band * .045);
      y[i] = LANE[f][j] * (attacking ? .97 : .75) + m.by * (attacking ? .24 : .37);
      if (j == 0) continue;
      if (i == m.owner) {
        x[i] = d * L;
        y[i] = p.y * .56;
      } else if (i == m.receiver
          || (i == first[side] && (engage || m.owner < 0 && m.receiver < 0))) {
        double anticipation = clamp(Math.hypot(p.x - m.bx, p.y - m.by) * .045, .10, .48);
        if (i == m.receiver && !m.openingPass) {
          double vv = m.bvx * m.bvx + m.bvy * m.bvy;
          anticipation =
              clamp(((p.x - m.bx) * m.bvx + (p.y - m.by) * m.bvy) / Math.max(1, vv), .1, 1.4);
        }
        x[i] = m.bx + m.bvx * anticipation;
        y[i] = m.by + m.bvy * anticipation;
      } else if (engage && i == cover[side]) {
        // The second man screens the passing lane behind the presser, on the goal side.
        x[i] = m.bx - d * (5.3 + (1 - pressure) * 1.1);
        y[i] = m.by * .7 + LANE[f][j] * .24;
      } else if (attacking && m.owner >= 0) {
        if (i == runner) {
          x[i] = d * Math.min(runLine, Math.max(d * x[i], d * m.bx + 11.5 + mentality * 2.5));
          y[i] = p.y * .40 + LANE[f][j] * .52 + m.by * .08;
        } else if (i == nearSupport || i == farSupport) {
          x[i] = m.bx + d * (band == 0 ? -10 : band == 1 ? -5 : 4);
          y[i] = m.by + (i == nearSupport ? -1 : 1) * (7 + band * 2.4);
        }
      }
      x[i] = clamp(x[i], -49.5, 49.5);
      y[i] = clamp(y[i], -32, 32);
    }
    // Soft anticipatory steering for both teams; opposite forces avoid bias by shirt order.
    for (int i = 0; i < 21; i++)
      for (int j = i + 1; j < 22; j++) {
        Player a = m.players[i], b = m.players[j];
        double dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > 3.4 || Math.abs(dy) > 3.4) continue;
        dx += (a.vx - b.vx) * .12;
        dy += (a.vy - b.vy) * .12;
        double r = i / 11 == j / 11 ? 2.35 : 1.15, dist = Math.hypot(dx, dy);
        if (dist >= r) continue;
        if (dist < .001) {
          dx = 0;
          dy = (i % 2 == 0 ? 1 : -1);
          dist = 1e-3;
        } else {
          dx /= dist;
          dy /= dist;
        }
        double push = (1 - dist / r) * (i / 11 == j / 11 ? 2.7 : 2);
        avoidX[i] += dx * push;
        avoidY[i] += dy * push;
        avoidX[j] -= dx * push;
        avoidY[j] -= dy * push;
      }
  }

  static void resolveBodies(Player[] players) {
    for (int i = 0; i < players.length - 1; i++)
      for (int j = i + 1; j < players.length; j++) {
        Player a = players[i], b = players[j];
        double dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > .64 || Math.abs(dy) > .64) continue;
        double distance = Math.hypot(dx, dy);
        if (distance >= .64) continue;
        if (distance < 1e-6) {
          dx = 0;
          dy = i % 2 == 0 ? 1 : -1;
        } else {
          dx /= distance;
          dy /= distance;
        }
        double correction = Math.min((.64 - distance) * .5, 2.8 * DT);
        a.x = clamp(a.x + dx * correction, -L + .2, L - .2);
        a.y = clamp(a.y + dy * correction, -W + .2, W - .2);
        b.x = clamp(b.x - dx * correction, -L + .2, L - .2);
        b.y = clamp(b.y - dy * correction, -W + .2, W - .2);
        double closing = Math.min(0, (a.vx - b.vx) * dx + (a.vy - b.vy) * dy) * .5;
        a.vx -= closing * dx;
        a.vy -= closing * dy;
        b.vx += closing * dx;
        b.vy += closing * dy;
      }
  }
}
