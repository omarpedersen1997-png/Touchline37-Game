package dk.touchline.career;

import static dk.touchline.career.Motor12.*;

/** Ground speeds are m/s. Grip and acceleration are m/s². */
final class Locomotion {
  static double angleDelta(double from, double to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  static void sprintState(Player p, boolean requested, double magnitude) {
    p.cooldown = Math.max(0, p.cooldown - DT);
    p.burst = Math.max(0, p.burst - DT);
    boolean active =
        requested && magnitude > .25 && p.cooldown == 0 && p.energy > 7 && p.delay <= .26;
    if (active && !p.sprinting) p.burst = .34;
    p.sprinting = active;
  }

  static void move(
      Player p,
      double desiredX,
      double desiredY,
      boolean carrying,
      boolean watchBall,
      double lookX,
      double lookY) {
    double speed = Math.hypot(p.vx, p.vy), wanted = Math.hypot(desiredX, desiredY);
    double alignment =
        speed * wanted > 1e-6 ? (p.vx * desiredX + p.vy * desiredY) / (speed * wanted) : 1;
    // Plant the outside foot to cut back. Lateral acceleration becomes available as speed falls.
    boolean cutting = speed > 1.15 && alignment <= -.495;
    double traction = (.83 + .0017 * p.energy) * (.81 + .0028 * p.attribute(Attribute.AGILITY));
    double brake = (10.6 - .32 * Math.min(speed, 9)) * traction;
    double engine =
        (p.sprinting ? 8.8 : 6.35) * traction * (.78 + .0035 * p.attribute(Attribute.ACCELERATION));
    if (p.dive > Goalkeeping.DIVE - .16) engine *= 2.4;
    if (p.sprinting && p.burst > 0) engine *= 1 + .45 * Math.max(0, 1 - speed / 8);
    double ax = desiredX - p.vx, ay = desiredY - p.vy;
    if (cutting) {
      ax = -p.vx;
      ay = -p.vy;
    }
    double limit = cutting || wanted < speed - .1 ? brake : engine;
    // At pace a planted foot cannot redirect the body at its full longitudinal acceleration.
    double sideways =
        speed > .2
            ? Math.abs(p.vx * ay - p.vy * ax) / (speed * Math.max(.01, Math.hypot(ax, ay)))
            : 0;
    limit *= 1 - .31 * sideways * Math.min(1, speed / 6);
    double gain = Math.min(1, limit * DT / Math.max(1e-9, Math.hypot(ax, ay)));
    double oldX = p.vx, oldY = p.vy;
    p.vx += ax * gain;
    p.vy += ay * gain;
    p.x = clamp(p.x + (oldX + p.vx) * .5 * DT, -L + .2, L - .2);
    p.y = clamp(p.y + (oldY + p.vy) * .5 * DT, -W + .2, W - .2);
    if (Math.abs(p.x) >= L - .2 && p.x * p.vx > 0) p.vx = 0;
    if (Math.abs(p.y) >= W - .2 && p.y * p.vy > 0) p.vy = 0;
    double v = Math.hypot(p.vx, p.vy);
    double bearing =
        watchBall
            ? Math.atan2(lookY - p.y, lookX - p.x)
            : v > .55 && !cutting
                ? Math.atan2(p.vy, p.vx)
                : wanted > .5
                    ? Math.atan2(desiredY, desiredX)
                    : Math.atan2(lookY - p.y, lookX - p.x);
    double turn = DT * (7.8 - .48 * Math.min(9, v));
    p.face += clamp(angleDelta(p.face, bearing), -turn, turn);
    // One cycle is a full left/right stride. Accumulate actual distance rather than match time.
    p.stride += (v * DT) / (1.28 + .25 * v);
    double rate = p.sprinting ? -(carrying ? 7.2 : 6) : v > 4.4 ? -1.4 : v < 1.1 ? 2.4 : 1.1;
    if (rate < 0) rate *= 1.18 - .35 * p.attribute(Attribute.STAMINA) / 99;
    if (p.sprinting) p.fatigue = clamp(p.fatigue - rate * DT * .12, 0, 100);
    p.energy = clamp(p.energy + rate * DT, 0, 100 - .15 * p.fatigue);
    if (p.sprinting && p.energy <= 7) {
      p.sprinting = false;
      p.cooldown = 2.4;
      p.burst = 0;
    }
  }
}
