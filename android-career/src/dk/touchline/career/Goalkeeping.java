package dk.touchline.career;

import static dk.touchline.career.Motor12.*;

final class Goalkeeping {
  static final double DIVE = .75;

  static void position(Motor12 m, int side, TeamShape shape, double sinceKick) {
    int i = side * 11, d = m.dir(side);
    Player keeper = m.players[i];
    keeper.dive = Math.max(0, keeper.dive - DT);
    double goal = -L * d, range = (m.bx - goal) * d;
    double step = clamp(1.35 + range * .115, 1.35, 8);
    shape.x[i] = goal + step * d;
    // Bisect the view of the posts as the attacker changes angle.
    shape.y[i] = clamp(m.by * step / Math.max(step, range), -3.7, 3.7);
    if (m.shotInFlight && m.last >= 0 && m.last / 11 != side && m.bvx * d < -.8) {
      double arrival = (keeper.x - m.bx) / m.bvx;
      if (arrival > 0
          && arrival < 1.4
          && sinceKick > .095 + (100 - keeper.attribute(Attribute.GOALKEEPING)) * .0016) {
        double aim = m.by + m.bvy * arrival + .5 * m.spin * m.bvx * arrival * arrival;
        shape.x[i] = keeper.x;
        shape.y[i] = clamp(aim, -5.4, 5.4);
        double reach = Math.abs(aim - keeper.y);
        if (keeper.dive == 0 && arrival < .45 && reach > .75 && reach < 3.8) {
          keeper.dive = DIVE;
          keeper.diveSide = Math.signum(aim - keeper.y);
        }
      }
    }
  }

  static double extension(double remaining) {
    double t = DIVE - remaining;
    if (remaining <= 0) return 0;
    return t < .24 ? Math.sin(t / .24 * Math.PI * .5) : clamp(remaining / (DIVE - .24), 0, 1);
  }

  static boolean inArea(Motor12 m, int i, double x, double y) {
    return i % 11 == 0 && x * m.dir(i / 11) < -L + 16.5 && Math.abs(y) < 20.16;
  }
}
