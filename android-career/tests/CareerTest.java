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
    require(m.awaitingKickoff());
    for (int f = 0; f < 120; f++) m.advance(.15, new Motor12.Input());
    require(m.tick == tick && m.bx == 0 && m.by == 0 && m.bvx == 0 && m.bvy == 0);
    int near = 0;
    for (int i = 0; i < 22; i++) {
      Motor12.Player p = m.players[i];
      if (Math.hypot(p.x, p.y) < 4) near++;
      require(p.x * m.dir(i / 11) <= 0);
      if (i / 11 != m.kickSide) require(Math.hypot(p.x, p.y) >= 9.15);
    }
    require(near == 2);
  }

  static void centrePass(Motor12 m) {
    int side = m.kickSide, clock = m.tick, kicks = m.kicks;
    require(m.kickOff() && !m.kickOff());
    for (int f = 0; m.phase == Motor12.Phase.KICKOFF_RUNUP && f < 150; f++)
      m.advance(Motor12.DT, new Motor12.Input());
    require(m.phase == Motor12.Phase.PLAY && m.tick == clock && m.kicks == kicks + 1);
    require(m.last == side * 11 + 9 && m.receiver == side * 11 + 6 && m.bz == Motor12.R);
    require(Math.hypot(m.bvx, m.bvy) > 3 && Math.hypot(m.bvx, m.bvy) < 7);
  }

  static void receiveCentrePass(Motor12 m) {
    int side = m.kickSide, first = side * 11 + 9, partner = side * 11 + 6;
    int before = m.players[first].complete;
    for (int f = 0; m.owner < 0 && f < 70; f++) m.advance(Motor12.DT, new Motor12.Input());
    require(m.owner == partner && m.players[first].complete == before + 1);
  }

  static void finish(Career c, int g, int a) {
    Motor12 m = c.start(Career.Control.SIMULATION);
    m.goals[0] = g;
    m.goals[1] = a;
    m.phase = Motor12.Phase.FULL_TIME;
    require(c.settle());
    require(!c.settle());
  }

  public static void main(String[] args) throws Exception {
    Motor12 m = new Motor12(183);
    waiting(m);
    centrePass(m);
    receiveCentrePass(m);
    passed("to spillere ved midten og modtaget kort afspark");
    m.tick = Motor12.HALF - 1;
    m.advance(Motor12.DT, new Motor12.Input());
    waiting(m);
    require(m.kickSide == 1 && m.half == 2 && m.clock().equals("45:00"));
    centrePass(m);
    receiveCentrePass(m);
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
    centrePass(m);
    receiveCentrePass(m);
    passed("mål, scoring og nyt afspark til holdet der indkasserer");
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
    Motor12 p = player.start(Career.Control.PLAYER);
    require(p.locked == 8 && p.selected == 8 && p.manual);
    centrePass(p);
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
    Career all = new Career(0, 0);
    Motor12 team = all.start(Career.Control.TEAM);
    require(team.manual && team.locked == -1 && all.role == 0);
    require(all.start(Career.Control.PLAYER) == team && team.locked == -1);
    centrePass(team);
    receiveCentrePass(team);
    require(team.selected == 6);
    team.owner = 13;
    team.last = 13;
    int before = team.selected;
    cmd.clear();
    cmd.action = Motor12.SWITCH;
    team.advance(Motor12.DT, cmd);
    require(team.selected != before);
    Motor12 restored = SaveFormat.decode(new ByteArrayInputStream(SaveFormat.encode(all))).match;
    require(restored.manual && restored.locked == -1 && restored.selected == team.selected);
    passed("holdstyring i spillerkarriere, modtagerskift, forsvarsskift og gemning");
    Career oldClub = new Career(0, 1);
    Motor12 oldMatch = oldClub.start(Career.Control.PLAYER);
    oldMatch.players[6].x = -6;
    oldMatch.players[6].y = 3;
    oldMatch.phase = Motor12.Phase.KICKOFF_READY;
    oldMatch.tick = 709;
    oldMatch.goals[1] = 1;
    ByteArrayOutputStream legacy = new ByteArrayOutputStream();
    oldClub.write(new DataOutputStream(legacy));
    byte[] body = legacy.toByteArray();
    ByteArrayOutputStream file = new ByteArrayOutputStream();
    DataOutputStream header = new DataOutputStream(file);
    header.writeInt(0x544c3132);
    header.writeInt(1);
    header.writeInt(body.length);
    header.write(java.security.MessageDigest.getInstance("SHA-256").digest(body));
    header.write(body);
    byte[] oldSave = file.toByteArray();
    Motor12 migrated = SaveFormat.decode(new ByteArrayInputStream(oldSave)).match;
    require(migrated.goals[1] == 1 && migrated.tick == 709 && migrated.locked == oldMatch.locked);
    waiting(migrated);
    centrePass(migrated);
    receiveCentrePass(migrated);
    passed("TEST75-karriere ved afspark åbner med ny opstilling og bevaret score");
    Career during = new Career(0, 0);
    Motor12 sequence = during.start(Career.Control.TEAM);
    sequence.kickOff();
    for (int f = 0; f < 10; f++) sequence.advance(Motor12.DT, empty);
    Motor12 resumed = SaveFormat.decode(new ByteArrayInputStream(SaveFormat.encode(during))).match;
    for (int f = 0; f < 75; f++) {
      sequence.advance(Motor12.DT, empty);
      resumed.advance(Motor12.DT, empty);
    }
    require(Arrays.equals(bytes(sequence), bytes(resumed)));
    passed("igangværende afsparkssekvens fortsætter én gang efter genindlæsning");
    Motor12 fast = new Motor12(13), jog = new Motor12(13);
    fast.phase = jog.phase = Motor12.Phase.PLAY;
    fast.locked = jog.locked = 8;
    Motor12.Input run = new Motor12.Input(), walk = new Motor12.Input();
    run.x = walk.x = 1;
    run.sprint = true;
    for (int n = 0; n < 90; n++) {
      fast.advance(Motor12.DT, run);
      jog.advance(Motor12.DT, walk);
    }
    require(
        fast.players[8].x > jog.players[8].x + 1 && fast.players[8].energy < jog.players[8].energy);
    Motor12 soft = Motor12.practice(true), hard = Motor12.practice(true);
    Motor12.Input tap = new Motor12.Input(), hold = new Motor12.Input();
    tap.power = .22;
    hold.power = 1;
    tap.action = hold.action = Motor12.SHOOT;
    tap.y = hold.y = -.75;
    soft.advance(Motor12.DT, tap);
    hard.advance(Motor12.DT, hold);
    require(Math.hypot(hard.bvx, hard.bvy) > Math.hypot(soft.bvx, soft.bvy) + 7 && hard.bvy < 0);
    passed("sprint øger tempo og belastning, ladet rettet skud ændrer boldens fart");
    Career stats = new Career(1, 0);
    Motor12 match = stats.start(Career.Control.TEAM);
    match.phase = Motor12.Phase.PLAY;
    match.owner = -1;
    match.last = 9;
    match.receiver = -1;
    match.shotInFlight = true;
    match.bx = 52.49;
    match.bvx = 25;
    match.by = 0;
    match.bz = .5;
    match.advance(Motor12.DT, new Motor12.Input());
    require(match.goals[0] == 1 && match.onTarget[0] == 1 && match.awaitingKickoff());
    match.phase = Motor12.Phase.PLAY;
    match.bx = 52.49;
    match.by = 20;
    match.bvx = 25;
    match.last = 12;
    match.advance(Motor12.DT, new Motor12.Input());
    require(match.restartType == 3 && match.corners[0] == 1);
    Career reread = SaveFormat.decode(new ByteArrayInputStream(SaveFormat.encode(stats)));
    require(reread.match.onTarget[0] == 1 && reread.match.corners[0] == 1);
    passed("mål, skud på mål og hjørnespark registreres på rette hold og følger gemmepladsen");
    Career coach = new Career(1, 0);
    coach.start(Career.Control.TEAM);
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
    Motor12 injured = injury.start(Career.Control.PLAYER);
    require(!injured.manual && injured.locked < 0);
    finish(injury, 0, 0);
    require(injury.injury[8] == 1);
    passed("skadet spiller, erstatning og kampbaseret restitution");
    Career sidelined = new Career(0, 0);
    sidelined.injury[8] = 2;
    Motor12 teammates = sidelined.start(Career.Control.TEAM);
    require(teammates.manual && teammates.locked == -1);
    for (int i = 0; i < 11; i++) require(teammates.players[i].shirt != sidelined.personalShirt);
    passed("resten af holdet kan styres under egen skade");
    int[] allGoals = {0, 0};
    int totalShots = 0;
    for (int seed = 1; seed <= 12; seed++) {
      Motor12 sim = new Motor12(seed);
      sim.manual = false;
      for (int f = 0; f < 30000 && sim.phase != Motor12.Phase.FULL_TIME; f++) {
        if (sim.awaitingKickoff()) sim.kickOff();
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
