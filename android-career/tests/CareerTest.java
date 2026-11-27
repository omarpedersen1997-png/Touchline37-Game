package dk.touchline.career;

import java.io.*;
import java.util.*;

public final class CareerTest {
  static int count;

  static void require(boolean b) {
    if (!b) throw new AssertionError();
  }

  static void passed(String s) {
    count++;
    System.out.println("OK " + s);
  }

  static byte[] bytes(Motor12 m) throws IOException {
    ByteArrayOutputStream b = new ByteArrayOutputStream();
    m.write(new DataOutputStream(b));
    return b.toByteArray();
  }

  static void waiting(Motor12 m) {
    int tick = m.tick;
    m.advance(.3, new Motor12.Input());
    require(m.tick == tick && m.bx == 0 && m.by == 0 && m.bvx == 0 && m.bvy == 0);
    for (int i = 0; i < 22; i++) {
      Motor12.Player p = m.players[i];
      require(p.x * m.dir(i / 11) <= 0);
      if (i / 11 != m.kickSide) require(Math.hypot(p.x, p.y) >= 9.15);
    }
  }

  static void finish(Career c, int g, int a) {
    Motor12 m = c.start(false);
    m.goals[0] = g;
    m.goals[1] = a;
    m.phase = Motor12.Phase.FULL_TIME;
    require(c.settle());
    require(!c.settle());
  }

  public static void main(String[] args) throws Exception {
    Motor12 m = new Motor12(183);
    waiting(m);
    require(m.kickOff() && !m.kickOff() && m.kicks == 1 && m.bvx != 0);
    passed("manuelt første afspark og egen banehalvdel");
    m.tick = Motor12.HALF - 1;
    m.advance(Motor12.DT, new Motor12.Input());
    waiting(m);
    require(m.kickSide == 1 && m.half == 2 && m.clock().equals("45:00"));
    m.kickOff();
    passed("halvleg og modstanderens afspark");
    m.bx = -52.45;
    m.by = 0;
    m.bz = .4;
    m.bvx = -25;
    m.bvy = 0;
    m.bvz = 0;
    m.owner = -1;
    m.last = 8;
    m.advance(Motor12.DT, new Motor12.Input());
    require(m.goals[0] == 1 && m.phase == Motor12.Phase.KICKOFF_READY && m.kickSide == 1);
    waiting(m);
    passed("mål, scoring og nyt afspark");
    Motor12 a = new Motor12(2), b = new Motor12(2);
    a.manual = b.manual = false;
    a.kickOff();
    b.kickOff();
    Motor12.Input empty = new Motor12.Input();
    for (int t = 0; t < 2400; t++) {
      a.advance(1. / 60, empty);
      b.advance(1. / 120, empty);
      b.advance(1. / 120, empty);
    }
    require(Arrays.equals(bytes(a), bytes(b)));
    passed("samme kamptilstand ved 60 og 120 renderkald pr. sekund");
    Career player = new Career(0, 0);
    Motor12 p = player.start(true);
    require(p.locked == 8 && p.selected == 8 && p.manual);
    p.kickOff();
    p.owner = 5;
    p.players[8].x = 10;
    p.players[8].y = 3;
    p.players[5].x = p.bx = 2;
    p.players[5].y = p.by = 17;
    Motor12.Input cmd = new Motor12.Input();
    cmd.x = 1;
    cmd.action = Motor12.PASS;
    double initial = p.players[8].x;
    p.advance(Motor12.DT, cmd);
    require(p.receiver == 8 && p.selected == 8 && p.players[8].x > initial);
    p.owner = 8;
    p.last = 8;
    cmd.action = Motor12.SHOOT;
    p.advance(Motor12.DT, cmd);
    require(p.shots[0] == 1 && p.owner == -1);
    passed("spillerlås, løb, kald på bold og personligt skud");
    Career coach = new Career(1, 0);
    coach.start(true);
    coach.match.tactics(2, 2, 2);
    waiting(coach.match);
    require(coach.sub(3, 13) && !coach.sub(3, 3) && coach.match.subCount == 1);
    passed("formation, pres og udskiftning uden genindtræden");
    byte[] encoded = SaveFormat.encode(player);
    Career decoded = SaveFormat.decode(new ByteArrayInputStream(encoded));
    require(Arrays.equals(encoded, SaveFormat.encode(decoded)));
    passed("versioneret rundtur med aktiv kamp");
    for (byte[] bad : new byte[][] {encoded.clone(), Arrays.copyOf(encoded, 20)}) {
      bad[0] ^= 7;
      try {
        SaveFormat.decode(new ByteArrayInputStream(bad));
        throw new AssertionError();
      } catch (IOException expected) {
      }
    }
    encoded[100] ^= 1;
    try {
      SaveFormat.decode(new ByteArrayInputStream(encoded));
      throw new AssertionError();
    } catch (IOException expected) {
    }
    passed("ukendt, afkortet og beskadiget backup afvises");
    for (int role = 0; role < 2; role++)
      for (int story = 0; story < 4; story++) {
        Career cs = new Career(role, story);
        require(cs.hasDecision() == (story < 3));
        int news = cs.newsIndex;
        cs.decide(true);
        cs.decide(false);
        require(cs.newsIndex == news + (story < 3 ? 1 : 0));
      }
    passed("seks baggrunde, fri karriere og valg med konsekvenser én gang");
    Career seasons = new Career(1, 1);
    Set<Integer> clubs = new HashSet<>();
    int fixtures = 0, cups = 0;
    int money = seasons.budget;
    seasons.upgrade();
    require(seasons.facilities == 2 && seasons.budget < money);
    seasons.market();
    int bought = seasons.budget;
    seasons.market();
    require(seasons.budget == bought);
    seasons.train(1);
    seasons.train(1);
    require(seasons.trainingSessions == 1);
    passed("anlæg, transfervindue og træningsbelastning");
    while (seasons.season == 1) {
      if (!seasons.cupDue) {
        require(clubs.add(seasons.opposition()));
        fixtures++;
      } else cups++;
      finish(seasons, 3, 0);
    }
    require(
        fixtures == 15
            && clubs.size() == 15
            && cups == 3
            && seasons.division == 9
            && seasons.trophies == 2
            && seasons.points == 0);
    passed("15 forskellige ligamodstandere, pokalfinale, titel og oprykning");
    for (int year = 2; year <= 11; year++) while (seasons.season == year) finish(seasons, 3, 0);
    require(seasons.division == 1 && seasons.history.size() == 20 && seasons.honours.size() <= 30);
    passed("11 sæsoner, ligaloft og afgrænset historik");
    Career bottom = new Career(1, 2);
    while (bottom.season == 1) finish(bottom, 0, 4);
    require(bottom.division == 10);
    passed("nedrykning og ny sæson");
    Career deal = new Career(0, 2);
    deal.season = 2;
    String next = deal.offerClub();
    deal.transfer();
    require(deal.clubName.equals(next) && deal.contract == 3 && deal.wage > 1750);
    passed("klubtilbud og personlig kontrakt");
    Career injury = new Career(0, 0);
    injury.injury[8] = 2;
    Motor12 injured = injury.start(true);
    require(!injured.manual && injured.locked < 0);
    finish(injury, 0, 0);
    require(injury.injury[8] == 1);
    passed("skadet spiller, erstatning og kampbaseret restitution");
    int[] allGoals = {0, 0};
    int totalShots = 0;
    for (int seed = 1; seed <= 12; seed++) {
      Motor12 sim = new Motor12(seed);
      sim.manual = false;
      for (int f = 0; f < 30000 && sim.phase != Motor12.Phase.FULL_TIME; f++) {
        sim.kickOff();
        sim.advance(Motor12.DT, empty);
      }
      require(
          sim.tick == 2 * Motor12.HALF
              && sim.phase == Motor12.Phase.FULL_TIME
              && sim.passes[0] > 0
              && sim.passes[1] > 0);
      allGoals[0] += sim.goals[0];
      allGoals[1] += sim.goals[1];
      totalShots += sim.shots[0] + sim.shots[1];
    }
    require(totalShots > 20 && allGoals[0] > 0 && allGoals[1] > 0);
    passed("12 hele AI-kampe med afslutninger, mål og slutfløjt");
    System.out.println(
        "PASS " + count + "   AI-mål " + Arrays.toString(allGoals) + "   Skud " + totalShots);
  }
}
