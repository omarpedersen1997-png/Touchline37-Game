package dk.touchline.career;

import static dk.touchline.career.Motor12.*;

import java.io.*;
import java.util.*;

/** Behaviour tests operate in pitch metres and real seconds. */
public final class PhysicsTest {
  private static int passed;

  private static void check(boolean condition, String reason) {
    if (!condition) throw new AssertionError(reason);
  }

  private static void pass(String name) {
    passed++;
    System.out.println("OK " + name);
  }

  private static Player athlete() {
    Player p = new Player();
    p.shirt = 9;
    p.skill = 72;
    return p;
  }

  private static void run(Player p, double vx, double vy, boolean sprint) {
    Locomotion.sprintState(p, sprint, Math.min(1, Math.hypot(vx, vy)));
    Locomotion.move(p, vx, vy, false, false, 10, 0);
  }

  private static void feet() {
    Player fast = athlete(), slow = athlete();
    for (int i = 0; i < HZ * 2; i++) {
      run(fast, 8.3, 0, true);
      run(slow, 5.6, 0, false);
    }
    double start = fast.x, jogStart = slow.x;
    check(fast.energy < slow.energy && fast.stride > slow.stride, "arbejde");
    int frames = 0;
    while (fast.vx >= 0 && frames < 2 * HZ) {
      double face = fast.face;
      run(fast, -8.3, 0, true);
      frames++;
      check(Math.abs(Locomotion.angleDelta(face, fast.face)) <= 8.01 * DT, "rotation");
    }
    double brake = fast.x - start;
    while (slow.vx > 0) run(slow, 0, 0, false);
    check(
        frames > HZ * .5 && frames < HZ * 1.6 && brake > slow.x - jogStart && brake > 2,
        "bremselængde");
    System.out.printf(
        Locale.ROOT,
        "Vending %.3f s, sprint %.2f m, jog %.2f m%n",
        frames * DT,
        brake,
        slow.x - jogStart);
    pass("180° vending og hastighedsafhængig bremselængde");
    Player curve = athlete();
    curve.vx = 7;
    for (int i = 0; i < 18; i++) run(curve, -4, 6.1, true);
    check(curve.vx > 4 && Math.abs(curve.vy) < .4, "plantet fod i skrå vending");
    pass("skarp 123° vending");
    Player tired = athlete();
    tired.energy = 7.02;
    run(tired, 7, 0, true);
    check(!tired.sprinting && tired.cooldown > 2, "udmattelse");
    for (int i = 0; i < HZ; i++) run(tired, 0, 0, true);
    check(tired.energy > 7 && !tired.sprinting && tired.cooldown > 1, "hvile");
    for (int i = 0; i < HZ * 2; i++) run(tired, 0, 0, false);
    run(tired, 8, 0, true);
    check(tired.sprinting && tired.burst > .3, "genopladning");
    pass("antrit, udmattelseslås og aktiv restitution");
  }

  private static void shape() {
    Motor12 m = new Motor12(81);
    TeamShape s = new TeamShape();
    m.owner = 6;
    m.players[6].x = m.bx = 5;
    m.players[6].y = m.by = -12;
    s.prepare(m, 0);
    double home = s.y[2], away = s.y[13], back = s.x[13];
    check(s.runner >= 0 && s.first[1] != s.cover[1] && s.x[s.cover[1]] > m.bx, "opgavefordeling");
    m.by = 11;
    m.bx = 20;
    s.prepare(m, 0);
    check(s.y[2] > home + 3 && s.y[13] > away + 3 && s.x[13] > back + 2, "kædeforskydning");
    check(s.x[13] > s.x[17] && s.x[17] > s.x[20], "kædeafstande");
    int press = s.first[1], cover = s.cover[1];
    check(Math.hypot(s.x[press] - s.x[cover], s.y[press] - s.y[cover]) > 3, "pres og sikring");
    check(s.nearSupport >= 0 || s.farSupport >= 0, "støtte til boldholderen");
    pass("begge blokke forskyder sig, én presser, én sikrer, medspillere støtter");
    Player a = athlete(), b = athlete();
    a.vx = 3;
    b.vx = -2;
    a.x = -.16;
    b.x = .16;
    Player[] bodies = {a, b};
    for (int i = 0; i < 20; i++) TeamShape.resolveBodies(bodies);
    check(b.x - a.x > .63 && a.vx <= b.vx + .01, "blød kontakt");
    pass("kropskontakt uden overlap");
  }

  private static Motor12 flight() {
    Motor12 m = new Motor12(14);
    m.phase = Phase.PLAY;
    m.manual = false;
    for (int i = 0; i < 22; i++) {
      Player p = m.players[i];
      p.x = (i % 11 - 5) * 4;
      p.y = i % 2 == 0 ? 23 : -23;
    }
    m.players[11].x = 50;
    m.players[11].y = 0;
    m.owner = -1;
    m.last = 9;
    m.receiver = -1;
    return m;
  }

  private static void ball() {
    Motor12 g = flight(), a = flight();
    g.bvx = a.bvx = 16;
    a.bz = 2;
    a.bvz = 1;
    double lastSpeed = 16;
    boolean bounced = false;
    for (int i = 0; i < HZ * 2; i++) {
      double before = a.bvz;
      BallPhysics.step(a, DT);
      BallPhysics.step(g, DT);
      if (i == 22) check(g.bvx < a.bvx, "luft og græs");
      if (before < -1 && a.bvz > 0) bounced = true;
      check(a.bz >= R - 1e-7 && g.bvx <= lastSpeed + 1e-8, "græskontakt");
      lastSpeed = g.bvx;
    }
    check(bounced && a.bx > 0 && g.bx > 0, "opspring");
    pass("luftmodstand, rul, friktion og energitab ved opspring");
    Motor12 spin = flight(), plain = flight();
    spin.bvx = plain.bvx = 20;
    spin.bz = plain.bz = 1;
    spin.bvz = plain.bvz = 3;
    spin.spin = .28;
    spin.topSpin = 12;
    for (int i = 0; i < 48; i++) {
      BallPhysics.step(spin, DT);
      BallPhysics.step(plain, DT);
    }
    check(spin.by > .15 && spin.bz < plain.bz - .1, "Magnus");
    pass("sideskru og topspin ændrer banen");
    Motor12 t = flight();
    t.phase = Phase.RESTART;
    t.restartType = 0;
    t.restartSide = 0;
    t.bx = 3;
    t.by = 33.8;
    t.manual = true;
    Input in = new Input();
    in.action = PASS;
    in.y = -1;
    t.advance(DT, in);
    check(t.throwInFlight && t.bz > 1.7 && t.bvz > 0 && t.bvy < 0 && t.shots[0] == 0, "indkast");
    double release = t.by;
    t.advance(DT, in);
    check(t.by < release && t.bz >= 1.8, "bue");
    pass("indkast frigives i hovedhøjde og flyver ind på banen");
    Motor12 tap = flight();
    Player carrier = tap.players[9];
    carrier.x = 0;
    carrier.y = 0;
    carrier.face = 0;
    carrier.vx = 7;
    tap.bx = .4;
    tap.by = 0;
    Motor12 jog = flight();
    Player other = jog.players[9];
    other.x = other.y = 0;
    other.vx = 7;
    other.face = 0;
    jog.bx = .4;
    carrier.sprinting = true;
    for (int i = 0; i < HZ; i++) {
      carrier.x += 7 * DT;
      other.x += 7 * DT;
      BallPhysics.dribble(tap, carrier);
      BallPhysics.dribble(jog, other);
    }
    check(tap.bx - jog.bx > .25, "sprint-touch");
    pass("længere touch ved sprint");
  }

  private static void keepers() {
    for (boolean hard : new boolean[] {false, true}) {
      Motor12 m = flight();
      m.bx = 38;
      m.by = hard ? 1.6 : 0;
      m.bz = .65;
      m.bvx = hard ? 27 : 12;
      m.shotInFlight = true;
      boolean dive = false;
      Input in = new Input();
      for (int f = 0; f < HZ * 2 && m.saves[1] == 0; f++) {
        m.advance(DT, in);
        dive |= m.players[11].dive > 0;
      }
      check(m.saves[1] == 1 && m.onTarget[0] == 1, "registreret redning");
      if (hard) check(dive && m.owner == -1 && m.last == 11 && Math.abs(m.bvy) > 4, "dyk og retur");
      else check(m.owner == 11 && Math.hypot(m.bvx, m.bvy) < 6, "grebet afslutning");
    }
    Motor12 block = flight();
    block.shotInFlight = true;
    block.bx = 5;
    block.by = 0;
    block.bz = .5;
    block.bvx = 29;
    block.players[14].x = 6.1;
    block.players[14].y = .24;
    for (int i = 0; i < 10 && block.shotInFlight; i++) block.advance(DT, new Input());
    check(
        block.owner < 0 && block.last == 14 && Math.hypot(block.bvx, block.bvy) < 25, "afretning");
    pass("hårdt skud bliver afrettet af en markspiller");
    pass("målmand holder det bløde skud og parerer det hårde efter dyk");
  }

  private static void replay() throws IOException {
    Career c = new Career(1, 1);
    Motor12 m = c.start(Career.Control.SIMULATION);
    m.kickOff();
    Input in = new Input();
    for (int i = 0; i < 900; i++) m.advance(DT, in);
    Career copy = SaveFormat.decode(new ByteArrayInputStream(SaveFormat.encode(c)));
    for (int i = 0; i < 720; i++) {
      if (m.awaitingKickoff()) {
        m.kickOff();
        copy.match.kickOff();
      }
      m.advance(1. / 60, in);
      copy.match.advance(DT, in);
      copy.match.advance(DT, in);
    }
    check(Arrays.equals(SaveFormat.encode(c), SaveFormat.encode(copy)), "replay");
    pass("save og identisk videre kamp ved 60 og 120 renderkald");
  }

  private static void legacy() throws IOException {
    try (InputStream input =
        new FileInputStream("android-career/tests/fixtures/native-test76.tls")) {
      Career c = SaveFormat.decode(input);
      Motor12 m = c.match;
      check(
          m.awaitingKickoff() && m.clock().equals("42:22") && m.goals[1] == 1,
          "gemt kampur og fase");
      check(
          c.camera == 2 && c.volume == 42 && m.possession[0] == 220 && m.possession[1] == 320,
          "gamle indstillinger");
      for (int f = 0; f < HZ; f++) m.advance(DT, new Input());
      check(
          m.clock().equals("42:22") && m.bx == 0 && m.by == 0 && m.kickOff(),
          "manuelt afspark efter opgradering");
    }
    pass("autentisk TEST76-fil bevarer tid, score, boldbesiddelse og manuel genstart");
  }

  public static void main(String[] args) throws Exception {
    feet();
    shape();
    ball();
    keepers();
    replay();
    legacy();
    System.out.println("PASS " + passed + " physics");
  }
}
