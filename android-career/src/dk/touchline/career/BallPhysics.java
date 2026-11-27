package dk.touchline.career;

import static dk.touchline.career.Motor12.*;

/** Ball radius and pitch coordinates in metres. Spin is horizontal turn rate (radians/s). */
final class BallPhysics {
  static final double GRAVITY = 9.81;

  private static void travel(Motor12 m, double dt, boolean air) {
    double speed = Math.hypot(m.bvx, m.bvy);
    double loss = air ? .0042 * speed * speed : 1.38 + .0085 * speed * speed;
    double scale = speed > 0 ? Math.max(0, 1 - loss * dt / speed) : 0;
    double turn = m.spin * dt * (air ? 1 : .23), cx = Math.cos(turn), sn = Math.sin(turn);
    double vx = (cx * m.bvx - sn * m.bvy) * scale, vy = (sn * m.bvx + cx * m.bvy) * scale;
    m.bx += (m.bvx + vx) * .5 * dt;
    m.by += (m.bvy + vy) * .5 * dt;
    m.bvx = vx;
    m.bvy = vy;
    m.topSpin *= Math.exp(-(air ? .32 : 2.0) * dt);
    m.spin *= Math.exp(-(air ? .46 : 1.8) * dt);
  }

  static void step(Motor12 m, double dt) {
    double gravity = GRAVITY + clamp(m.topSpin * Math.hypot(m.bvx, m.bvy) * .012, -3, 4);
    double gap = Math.max(0, m.bz - R);
    if (gap < 1e-7 && m.bvz <= .025) {
      m.bz = R;
      m.bvz = 0;
      travel(m, dt, false);
      return;
    }
    double impact = (m.bvz + Math.sqrt(m.bvz * m.bvz + 2 * gravity * gap)) / gravity;
    double free = Math.min(dt, impact);
    travel(m, free, true);
    m.bz += m.bvz * free - .5 * gravity * free * free;
    m.bvz -= gravity * free;
    if (impact <= dt) {
      double rebound = -m.bvz * .46;
      m.bz = R;
      m.bvz = rebound > .68 ? rebound : 0;
      m.bvx *= .86;
      m.bvy *= .86;
      m.spin *= .71;
      if (dt - free > 1e-8) step(m, dt - free);
    }
  }

  static void dribble(Motor12 m, Player p) {
    double v = Math.hypot(p.vx, p.vy), kicksPerCycle = 2 * p.stride;
    double beat = kicksPerCycle - Math.floor(kicksPerCycle);
    // A little more space between boot and ball at pace. A touch adds momentum.
    double lead =
        (p.sprinting ? .52 : .32) + v * (p.sprinting ? .09 : .048) + Math.sin(beat * Math.PI) * .16;
    double dx = p.x + Math.cos(p.face) * lead - m.bx, dy = p.y + Math.sin(p.face) * lead - m.by;
    double control = beat < .24 ? 1 : .55;
    double ax = (dx * 40 + (p.vx - m.bvx) * 8) * control,
        ay = (dy * 40 + (p.vy - m.bvy) * 8) * control;
    double grip = Math.min(1, 40 / Math.max(.001, Math.hypot(ax, ay)));
    m.bvx += ax * grip * DT;
    m.bvy += ay * grip * DT;
    step(m, DT);
  }
}
