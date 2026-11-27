package dk.touchline.career;

import java.io.*;
import java.util.*;

/** One independent career slot, including the day's fixture. All progression is event-driven. */
public final class Career {
  public static final String[] FORMS = {"Spillerkarriere", "Trænerkarriere"},
      FORMATIONS = {"4-3-3", "4-4-2", "3-5-2"},
      PRESS = {"Lav blok", "Middelpres", "Højt pres"},
      STYLE = {"Forsigtig", "Balanceret", "Offensiv"};
  public static final String[][] STORIES = {
    {"Akademiets reserve", "Fra gaden til ligaen", "Landets stortalent", "Fri karriere"},
    {"Assistenten", "Anføreren vender hjem", "Redningsmanden", "Fri karriere"}
  };
  public static final String[][] BRIEFS = {
    {
      "Lav status. Vind trænerens tillid med præcise afleveringer.",
      "God fysik og fanstøtte. Spil dig til din første kontraktforlængelse.",
      "Høj rating og mediepres. Lever mål eller oplæg fra første sæson.",
      "Start som seniorspiller og vælg din egen retning."
    },
    {
      "Lille budget. Få dit presspil til at fungere med den trup, du har.",
      "Stor tillid i truppen. Udvikl de unge med få transfermidler.",
      "En presset bestyrelse. Genskab moralen og undgå nedrykning.",
      "Tag over som cheftræner uden en baggrundsfortælling."
    }
  };
  public static final String[] CLUBS = {
    "Sundhavn FK",
    "Havneby IF",
    "Frederiksdal",
    "Vestereng",
    "Rosenlund",
    "Nørrebro BK",
    "Skovby 09",
    "Amager Atletik",
    "Kystens IF",
    "Lindevang",
    "Valby Union",
    "Østerport",
    "Sydkysten",
    "Holme FK",
    "Broen Boldklub",
    "Fjordhavn"
  };
  static final String[] NAMES = {
    "M. Birk",
    "N. Aagaard",
    "E. Amini",
    "L. Kappel",
    "V. Nyholm",
    "O. Said",
    "A. Lind",
    "T. Sørensen",
    "A. Holm",
    "K. Møller",
    "S. Diallo",
    "J. Stage",
    "F. Bak",
    "I. Mensah",
    "P. Berg",
    "M. Ali",
    "T. Voss",
    "H. Dal"
  };
  static final String[] SCOUTS = {
    "M. Falk", "R. Alvarez", "A. Isaksen", "B. Larsen", "S. Okafor", "Y. Jensen"
  };
  static final String[] FOCUS = {"Teknik", "Udholdenhed", "Restitution"};
  public int role,
      story,
      season = 1,
      division = 10,
      round,
      week,
      cupRound,
      points,
      budget,
      morale,
      trust,
      fans,
      pressure,
      reputation,
      facilities = 1;
  public int form = 6,
      personalGoals,
      personalAssists,
      cleanSheets,
      careerWins,
      pressWins,
      seasonGoals,
      trophies,
      seasonBest,
      contract = 2,
      wage = 850,
      awards,
      trainingSessions,
      matchPasses;
  public int formerClub, matchObjectives, seasonObjectiveWins, withdrawn, formSamples;
  public final int[] lastFive = new int[5];
  public int formation,
      press = 1,
      mentality = 1,
      training = -1,
      decisionWeek = -1,
      marketWeek = -1,
      newsIndex,
      earned,
      personalShirt = 9;
  public boolean cupAlive = true, cupDue, sound;
  public String id = UUID.randomUUID().toString(),
      clubName = CLUBS[0],
      lastReport = "Sæsonkortet er klar.",
      headline = "Første dag i klubben";
  public final int[] table = new int[16],
      goalDiff = new int[16],
      grade = new int[18],
      fitness = new int[18],
      injury = new int[18],
      lineup = new int[11];
  public final String[] names = NAMES.clone();
  public final ArrayList<String> history = new ArrayList<>(), honours = new ArrayList<>();
  public Motor12 match;

  public Career(int role, int story) {
    this.role = role;
    this.story = story;
    trust = (new int[] {38, 66, 50, 55})[story];
    fans = (new int[] {40, 63, 80, 50})[story];
    pressure = (new int[] {34, 47, 80, 48})[story];
    morale = (role == 1 && story == 2) ? 36 : 56;
    reputation = (new int[] {26, 39, 62, 38})[story];
    budget = role == 1 ? (new int[] {145000, 98000, 185000, 200000})[story] : 145000;
    if (role == 1 && story == 2) division = 9;
    for (int n = 0; n < 18; n++) {
      grade[n] = 56 + (n * 7 % 14);
      fitness[n] = 91 + n % 9;
      if (n < 11) lineup[n] = n;
    }
    grade[8] = role == 0 ? (new int[] {56, 61, 74, 64})[story] : 65;
    if (role == 0 && story == 1) {
      wage = 590;
      lineup[8] = 7;
      lineup[7] = 8;
    }
    if (role == 0 && story == 2) {
      lineup[8] = 9;
      lineup[9] = 8;
    }
    if (role == 1 && story == 1) morale = 74;
    if (role == 0 && story == 2) wage = 1750;
  }

  public String storyName() {
    return STORIES[role][story];
  }

  public String team(int n) {
    return n == 0 ? clubName : formerClub != 0 && n == formerClub ? CLUBS[0] : CLUBS[n];
  }

  public String name(int index) {
    return role == 0 && index == personalShirt - 1 ? "A. Holm · dig" : names[index];
  }

  public int position() {
    int rank = 1;
    for (int n = 1; n < 16; n++)
      if (table[n] > table[0] || table[n] == table[0] && goalDiff[n] > goalDiff[0]) rank++;
    return rank;
  }

  public int[] order() {
    Integer[] list = new Integer[16];
    for (int i = 0; i < 16; i++) list[i] = i;
    Arrays.sort(
        list,
        (a, b) ->
            table[a] != table[b]
                ? Integer.compare(table[b], table[a])
                : Integer.compare(goalDiff[b], goalDiff[a]));
    int[] result = new int[16];
    for (int i = 0; i < 16; i++) result[i] = list[i];
    return result;
  }

  static int[][] pairs(int r) {
    int[] wheel = new int[16];
    for (int i = 0; i < 16; i++) wheel[i] = i;
    for (int turn = 0; turn < r; turn++) {
      int end = wheel[15];
      System.arraycopy(wheel, 1, wheel, 2, 14);
      wheel[1] = end;
    }
    int[][] out = new int[8][2];
    for (int i = 0; i < 8; i++) {
      out[i][0] = wheel[i];
      out[i][1] = wheel[15 - i];
    }
    return out;
  }

  public int opposition() {
    if (cupDue) return 1 + Math.floorMod(season * 7 + cupRound * 3, 15);
    for (int[] p : pairs(round)) if (p[0] == 0 || p[1] == 0) return p[0] + p[1];
    throw new IllegalStateException();
  }

  public String competition() {
    return cupDue
        ? "Landspokal · " + new String[] {"Kvartfinale", "Semifinale", "Finale"}[cupRound]
        : "League " + division + " · " + (round + 1) + "/15";
  }

  public boolean playerAvailable() {
    return injury[personalShirt - 1] == 0;
  }

  public boolean window() {
    return round < 3 || round == 7 || round == 8 || (role == 0 && contract == 0);
  }

  public int focusPlayer() {
    return role == 0 ? personalShirt - 1 : (week * 3 + 4) % 18;
  }

  public String train(int choice) {
    if (match != null || training >= 0) return "Der er allerede lagt en plan for denne kamp.";
    int k = focusPlayer();
    training = choice;
    trainingSessions++;
    if (choice == 2) {
      for (int i = 0; i < 18; i++) fitness[i] = Math.min(100, fitness[i] + 7 + facilities);
    } else if (choice == 0) {
      grade[k] = Math.min(94, grade[k] + 1 + (facilities >= 4 ? 1 : 0));
      fitness[k] = Math.max(45, fitness[k] - 4);
    } else for (int i = 0; i < 18; i++) fitness[i] = Math.min(100, fitness[i] + 3 + facilities);
    return FOCUS[choice] + " gennemført · " + name(k);
  }

  public boolean hasDecision() {
    return story < 3 && week % 3 == 0 && decisionWeek != week;
  }

  public String question() {
    String[][] questions =
        role == 0
            ? new String[][] {
              {
                "Træneren tilbyder ekstra tekniktræning før holdudtagelsen.",
                "Din mentor vil træne førsteberøringer, mens pressen venter.",
                "Akademiet inviterer dig hjem inden næste kamp."
              },
              {
                "Din gamle klub vil have dig med til en ungdomstræning.",
                "Agenten foreslår en prøvetræning før næste kontrakt.",
                "Holdkammeraterne vil høre om din vej fra gaden."
              },
              {
                "En journalist vil have et målløfte før kampen.",
                "Landsholdsspejderen sidder på tribunen.",
                "Et forsideinterview kolliderer med individuel træning."
              }
            }
            : new String[][] {
              {
                "Bestyrelsen vil høre din plan for presspillet.",
                "Analyseholdet vil teste en ny rolle til en ung spiller.",
                "Pressen spørger til din manglende erfaring."
              },
              {
                "Anføreren beder om mere ansvar i omklædningsrummet.",
                "Din tidligere makker kritiserer din holdudtagelse.",
                "Akademiet ønsker en plads på førsteholdet."
              },
              {
                "Fansene kræver svar efter en svær periode.",
                "Bestyrelsen vil se en klar vej til overlevelse.",
                "Pressen vil vide, om du fortsat har truppens tillid."
              }
            };
    return story < 3 ? questions[story][(week / 3) % 3] : "Fri karriere";
  }

  public String standing() {
    if (role == 1)
      return trust >= 75
          ? "Bestyrelsens nøglefigur"
          : trust < 40 ? "Under bestyrelsens lup" : "Cheftræner";
    return grade[8] >= 82 && trust >= 72
        ? "Klubprofil"
        : trust >= 67
            ? "Fast starter"
            : trust >= 48 ? "Førsteholdsspiller" : "Akademiets udfordrer";
  }

  public String choice(boolean publicChoice) {
    if (role == 0) {
      if (story == 0) return publicChoice ? "Fortæl om dit gennembrud" : "Træn med mentoren";
      if (story == 1)
        return publicChoice ? "Repræsentér din gamle klub" : "Arbejd med relationerne";
      return publicChoice ? "Tag forventningerne på dig" : "Skærm holdet for pressen";
    }
    if (story == 0) return publicChoice ? "Fremlæg en offensiv plan" : "Forankr planen i truppen";
    if (story == 1) return publicChoice ? "Tag ansvaret udadtil" : "Giv kaptajnen ansvar";
    return publicChoice ? "Lov fansene en reaktion" : "Saml truppen bag lukkede døre";
  }

  public String decide(boolean publicChoice) {
    if (!hasDecision()) return "Næste beslutning kommer efter flere kampe.";
    decisionWeek = week;
    newsIndex++;
    if (publicChoice) {
      fans = cap(fans + 6);
      pressure = cap(pressure + 5);
      reputation = cap(reputation + 2);
      headline = "Pressen tager imod udmeldingen";
    } else {
      trust = cap(trust + 5);
      morale = cap(morale + 4);
      pressure = cap(pressure - 3);
      headline = "Omklædningsrummet bakker op";
    }
    if (!publicChoice && role == 0 && story == 0) grade[8] = Math.min(94, grade[8] + 1);
    if (publicChoice && role == 1 && story == 0 && match == null) {
      press = 2;
      mentality = 2;
    }
    if (!publicChoice && role == 1 && story == 1) morale = cap(morale + 2);
    return headline;
  }

  public String offerClub() {
    return CLUBS[offerIndex()];
  }

  private int offerIndex() {
    int k = 1 + Math.floorMod(season * 7 + story, 15);
    return k == formerClub ? 1 + k % 15 : k;
  }

  public boolean canTransfer() {
    return role == 0
        && season > 1
        && round < 3
        && match == null
        && marketWeek != week
        && reputation >= 32;
  }

  public String transfer() {
    if (!canTransfer()) return "Der er ingen klub med et åbent tilbud.";
    int target = offerIndex();
    int p = table[target], gd = goalDiff[target];
    table[target] = table[0];
    goalDiff[target] = goalDiff[0];
    table[0] = points = p;
    goalDiff[0] = gd;
    clubName = CLUBS[target];
    formerClub = target;
    contract = 3;
    marketWeek = week;
    wage += 250 + reputation * 4;
    trust = 49;
    honour("Kontrakt med " + clubName);
    return "Du er præsenteret i " + clubName;
  }

  public String formGuide() {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < formSamples; i++) {
      if (i > 0) out.append("  ");
      out.append(lastFive[i] > 0 ? "V" : lastFive[i] < 0 ? "T" : "U");
    }
    return formSamples == 0 ? "Sæsondebut" : out.toString();
  }

  public String matchObjective() {
    return role == 0
        ? "Gennemfør fire afleveringer eller bidrag til et mål"
        : press == 2 ? "Vind med højt pres" : "Hold nullet eller skab tre afslutninger";
  }

  public String seasonObjective() {
    return role == 0
        ? "Bidrag med seks ligamål i denne sæson"
        : story == 2 ? "Slut uden for nedrykningspladserne" : "Slut blandt de fem bedste";
  }

  public String market() {
    if (match != null || !window() || marketWeek == week)
      return "Vinduet er lukket for nye aftaler.";
    if (role == 0) {
      if (trust < 35) return "Træneren kræver mere tillid før en forhandling.";
      contract = 3;
      wage += 100 + reputation * 5;
      marketWeek = week;
      return "Ny treårig aftale · " + wage + " kr./uge";
    }
    int cost = 31000 + season * 2300;
    if (budget < cost) return "Klubkassen dækker ikke købet.";
    int reserve = 11;
    for (int i = 12; i < 18; i++) if (grade[i] < grade[reserve]) reserve = i;
    budget -= cost;
    grade[reserve] = Math.min(89, 64 + season + facilities * 2);
    names[reserve] = SCOUTS[(week + season) % SCOUTS.length];
    fitness[reserve] = 98;
    injury[reserve] = 0;
    marketWeek = week;
    return "Ny kontrakt · " + names[reserve] + " · trøje " + (reserve + 1);
  }

  public String upgrade() {
    int cost = 45000 * facilities;
    if (role != 1 || facilities >= 5 || budget < cost || match != null)
      return "Anlægget kan ikke udvides nu.";
    budget -= cost;
    facilities++;
    return "Træningsanlæg niveau " + facilities;
  }

  public Motor12 start(boolean play) {
    if (match != null) return match;
    withdrawn = 0;
    match = new Motor12(13 + season * 199 + week * 907 + story * 7 + role);
    match.manual = play;
    match.formations[0] = formation;
    match.press[0] = press;
    match.approach[0] = mentality;
    boolean[] used = new boolean[18];
    for (int i = 0; i < 11; i++) {
      if (injury[lineup[i]] == 0) used[lineup[i]] = true;
    }
    for (int i = 0; i < 11; i++) {
      int k = lineup[i];
      if (injury[k] > 0) {
        for (int r = 0; r < 18; r++)
          if (!used[r] && injury[r] == 0 && (i == 0) == (r == 0 || r == 11)) {
            k = r;
            break;
          }
      }
      used[k] = true;
      Motor12.Player p = match.players[i];
      p.shirt = k + 1;
      p.energy = fitness[k];
      p.skill = grade[k] + (morale - 50) * .035;
      match.players[11 + i].skill += 2 * (10 - division) + (opposition() % 5 - 2);
      if (role == 0 && k + 1 == personalShirt) match.locked = i;
    }
    if (role == 0 && match.locked < 0) match.manual = false;
    match.tactics(formation, press, mentality);
    return match;
  }

  public boolean sub(int out, int reserve) {
    if (role != 1 || out < 0 || out >= 11 || reserve < 0 || reserve >= 18 || injury[reserve] > 0)
      return false;
    if (match == null) {
      int other = -1;
      for (int j = 0; j < 11; j++) if (lineup[j] == reserve) other = j;
      if ((out == 0) != (reserve == 0 || reserve == 11)) return false;
      if (other >= 0) {
        int old = lineup[out];
        lineup[other] = old;
      }
      lineup[out] = reserve;
      return true;
    }
    if (match.phase == Motor12.Phase.FULL_TIME
        || match.subCount >= 5
        || out == 0 && reserve != 0 && reserve != 11
        || out != 0 && (reserve == 0 || reserve == 11)) return false;
    for (int i = 0; i < 11; i++) if (match.players[i].shirt == reserve + 1) return false;
    if ((withdrawn & (1 << reserve)) != 0) return false;
    Motor12.Player p = match.players[out];
    fitness[p.shirt - 1] = (int) p.energy;
    withdrawn |= 1 << (p.shirt - 1);
    String change = "Ud " + p.shirt + " · ind " + (reserve + 1);
    Motor12.Player replacement = new Motor12.Player();
    replacement.x = p.x;
    replacement.y = p.y;
    replacement.face = p.face;
    replacement.shirt = reserve + 1;
    replacement.skill = grade[reserve];
    replacement.energy = fitness[reserve];
    match.players[out] = replacement;
    match.subCount++;
    match.log.add(0, match.clock() + "  " + change);
    if (match.log.size() > 30) match.log.remove(30);
    return true;
  }

  static int cap(int n) {
    return Math.max(0, Math.min(100, n));
  }

  private void result(int a, int b, int x, int y) {
    table[a] += x == y ? 1 : x > y ? 3 : 0;
    table[b] += x == y ? 1 : y > x ? 3 : 0;
    goalDiff[a] += x - y;
    goalDiff[b] += y - x;
  }

  private void honour(String s) {
    honours.add(0, "S" + season + " · " + s);
    if (honours.size() > 30) honours.remove(30);
  }

  public String[] missions() {
    return new String[] {
      role == 0 ? "Skab 3 mål eller oplæg" : "Vind 3 gange med højt pres",
      "Hold nullet i 5 kampe",
      "Gennemfør 12 træningspas",
      story == 3
          ? "Nå omdømme 70"
          : (role == 0
                  ? new String[] {
                    "Spil dig til trænerens tillid",
                    "Få fansene med dig",
                    "Lev op til pressens målkrav"
                  }
                  : new String[] {
                    "Vind med analytikerens presplan",
                    "Saml omklædningsrummet",
                    "Indfri bestyrelsens sæsonkrav"
                  })
              [story],
      "Vind din første pokal eller liga"
    };
  }

  public int[] progress() {
    return new int[] {
      role == 0 ? personalGoals + personalAssists : pressWins,
      cleanSheets,
      trainingSessions,
      story == 3
          ? reputation
          : role == 0
              ? (story == 0 ? trust : story == 1 ? fans : personalGoals)
              : story == 0 ? pressWins : story == 1 ? morale : seasonObjectiveWins,
      trophies
    };
  }

  public int[] targets() {
    return new int[] {
      3,
      5,
      12,
      story == 3
          ? 70
          : role == 0
              ? (story == 0 ? 80 : story == 1 ? 85 : 10)
              : story == 0 ? 8 : story == 1 ? 85 : 2,
      1
    };
  }

  public void checkMissions() {
    int[] p = progress(), t = targets();
    for (int n = 0; n < t.length; n++)
      if (p[n] >= t[n] && (earned & (1 << n)) == 0) {
        earned |= 1 << n;
        reputation = cap(reputation + 3);
        if (role == 1) budget += 6000;
        honour(missions()[n]);
      }
  }

  public boolean settle() {
    if (match == null || match.phase != Motor12.Phase.FULL_TIME) return false;
    int h = match.goals[0], a = match.goals[1], opp = opposition();
    boolean cup = cupDue;
    System.arraycopy(lastFive, 0, lastFive, 1, 4);
    lastFive[0] = Integer.compare(h, a);
    formSamples = Math.min(5, formSamples + 1);
    String result = team(0) + " " + h + "–" + a + " " + team(opp);
    form = Math.max(1, Math.min(10, form + (h > a ? 1 : h < a ? -1 : 0)));
    morale = cap(morale + (h > a ? 4 : h == a ? 1 : -3));
    trust = cap(trust + (h >= a ? 2 : -2));
    fans = cap(fans + (h >= a ? 2 : -1));
    pressure = cap(pressure + (h >= a ? -2 : 3));
    if (h > a) {
      careerWins++;
      if (match.press[0] == 2) pressWins++;
    }
    if (a == 0) cleanSheets++;
    int contributed = 0, completedPersonalPasses = 0;
    for (int i = 0; i < 18; i++) {
      if (injury[i] > 0) injury[i]--;
      fitness[i] = Math.min(100, fitness[i] + 10);
    }
    for (int i = 0; i < 11; i++) {
      Motor12.Player p = match.players[i];
      int k = p.shirt - 1;
      fitness[k] = Math.min(100, (int) p.energy + 12 + facilities);
      if (k + 1 == personalShirt) {
        personalGoals += p.goals;
        personalAssists += p.assists;
        contributed = p.goals + p.assists;
        if (!cup) seasonGoals += p.goals;
        matchPasses += p.complete;
        completedPersonalPasses = p.complete;
      }
    }
    boolean objective =
        role == 0
            ? completedPersonalPasses >= 4 || contributed > 0
            : match.press[0] == 2 ? h > a : a == 0 || match.shots[0] >= 3;
    if (objective) {
      matchObjectives++;
      trust = cap(trust + 2);
      if (role == 1) budget += 2100;
    }
    if (role == 0 && contributed > 0) {
      grade[personalShirt - 1] = Math.min(95, grade[personalShirt - 1] + 1);
      trust = cap(trust + 3);
      reputation = cap(reputation + 2);
    }
    budget += role == 1 ? 8300 + fans * 25 - (1500 + facilities * 300) : wage;
    int tired = -1;
    for (int i = 0; i < 11; i++) {
      int k = match.players[i].shirt - 1;
      if (k != 0 && (tired < 0 || fitness[k] < fitness[tired])) tired = k;
    }
    if (tired >= 0 && fitness[tired] < 80 && (week + story) % 5 == 3) {
      injury[tired] = 2;
      result += " · " + names[tired] + " ude i 2 kampe";
    }
    if (cup) {
      boolean won = h > a;
      if (h == a) {
        int homePens = 3 + Math.floorMod(season + week + formation, 3),
            awayPens = homePens + (match.shots[0] + trust / 15 >= match.shots[1] + 3 ? -1 : 1);
        won = homePens > awayPens;
        result += " · str. " + homePens + "–" + awayPens;
      }
      cupDue = false;
      if (!won) cupAlive = false;
      else if (++cupRound == 3) {
        trophies++;
        honour("Landspokalen");
        budget += 30000;
        cupAlive = false;
      }
    } else {
      for (int[] pair : pairs(round)) {
        if (pair[0] == 0 || pair[1] == 0) result(0, opp, h, a);
        else {
          int seed = season * 977 + round * 89 + pair[0] * 13 + pair[1] * 19;
          Random r = new Random(seed);
          result(pair[0], pair[1], r.nextInt(4), r.nextInt(4));
        }
      }
      points = table[0];
      round++;
      cupDue = cupAlive && (round == 4 || round == 8 || round == 12);
    }
    lastReport =
        result
            + "\nSkud "
            + match.shots[0]
            + "–"
            + match.shots[1]
            + "   ·   xG "
            + String.format(Locale.ROOT, "%.2f–%.2f", match.xg[0], match.xg[1])
            + "\nAfleveringer "
            + match.passes[0]
            + "–"
            + match.passes[1]
            + "   ·   Redninger "
            + match.saves[0]
            + "–"
            + match.saves[1];
    lastReport +=
        "\nKampmål " + (objective ? "opfyldt" : "missedes") + "   ·   Form " + form + "/10";
    history.add(0, result);
    if (history.size() > 20) history.remove(20);
    week++;
    training = -1;
    match = null;
    if (round == 15) {
      int pos = position();
      if (role == 0 ? seasonGoals >= 6 : pos <= (story == 2 ? 13 : 5)) {
        seasonObjectiveWins++;
        reputation = cap(reputation + 4);
        honour("Sæsonmålet opnået");
      }
      honour("League " + division + " · nr. " + pos + " · " + points + " point");
      if (pos == 1) {
        trophies++;
        honour("Ligamester");
      }
      if (pos <= 3 && division > 1) {
        division--;
        reputation = cap(reputation + 9);
        headline = "Oprykning!";
      } else if (pos >= 14 && division < 10) {
        division++;
        headline = "Nedrykning";
      } else headline = "Sæsonen afsluttet";
      if (seasonGoals >= 8 || role == 1 && pos <= 3) {
        awards++;
        honour(role == 0 ? "Årets klubprofil" : "Sæsonens træner");
      }
      seasonBest = Math.max(seasonBest, seasonGoals);
      seasonGoals = 0;
      contract = Math.max(0, contract - 1);
      round = points = cupRound = 0;
      season++;
      cupAlive = true;
      cupDue = false;
      Arrays.fill(table, 0);
      Arrays.fill(goalDiff, 0);
    } else
      headline = h > a ? "Sejr på kampdagen" : h == a ? "Pointdeling" : "Nederlag på kampdagen";
    checkMissions();
    return true;
  }

  public void write(DataOutput o) throws IOException {
    o.writeUTF(id);
    o.writeUTF(clubName);
    o.writeUTF(lastReport);
    o.writeUTF(headline);
    for (int v :
        new int[] {
          role,
          story,
          season,
          division,
          round,
          week,
          cupRound,
          points,
          budget,
          morale,
          trust,
          fans,
          pressure,
          reputation,
          facilities,
          form,
          personalGoals,
          personalAssists,
          cleanSheets,
          careerWins,
          pressWins,
          seasonGoals,
          trophies,
          seasonBest,
          contract,
          wage,
          awards,
          trainingSessions,
          matchPasses,
          formation,
          press,
          mentality,
          training,
          decisionWeek,
          marketWeek,
          newsIndex,
          earned,
          personalShirt
        }) o.writeInt(v);
    for (int v :
        new int[] {formerClub, matchObjectives, seasonObjectiveWins, withdrawn, formSamples})
      o.writeInt(v);
    for (int v : lastFive) o.writeInt(v);
    o.writeBoolean(cupAlive);
    o.writeBoolean(cupDue);
    o.writeBoolean(sound);
    for (int[] a : new int[][] {table, goalDiff, grade, fitness, injury, lineup})
      for (int v : a) o.writeInt(v);
    for (String s : names) o.writeUTF(s);
    for (ArrayList<String> list : Arrays.asList(history, honours)) {
      o.writeInt(list.size());
      for (String s : list) o.writeUTF(s);
    }
    o.writeBoolean(match != null);
    if (match != null) match.write(o);
  }

  public static Career read(DataInput i) throws IOException {
    Career c = new Career(0, 0);
    c.id = i.readUTF();
    c.clubName = i.readUTF();
    c.lastReport = i.readUTF();
    c.headline = i.readUTF();
    c.role = i.readInt();
    c.story = i.readInt();
    c.season = i.readInt();
    c.division = i.readInt();
    c.round = i.readInt();
    c.week = i.readInt();
    c.cupRound = i.readInt();
    c.points = i.readInt();
    c.budget = i.readInt();
    c.morale = i.readInt();
    c.trust = i.readInt();
    c.fans = i.readInt();
    c.pressure = i.readInt();
    c.reputation = i.readInt();
    c.facilities = i.readInt();
    c.form = i.readInt();
    c.personalGoals = i.readInt();
    c.personalAssists = i.readInt();
    c.cleanSheets = i.readInt();
    c.careerWins = i.readInt();
    c.pressWins = i.readInt();
    c.seasonGoals = i.readInt();
    c.trophies = i.readInt();
    c.seasonBest = i.readInt();
    c.contract = i.readInt();
    c.wage = i.readInt();
    c.awards = i.readInt();
    c.trainingSessions = i.readInt();
    c.matchPasses = i.readInt();
    c.formation = i.readInt();
    c.press = i.readInt();
    c.mentality = i.readInt();
    c.training = i.readInt();
    c.decisionWeek = i.readInt();
    c.marketWeek = i.readInt();
    c.newsIndex = i.readInt();
    c.earned = i.readInt();
    c.personalShirt = i.readInt();
    if (c.role < 0
        || c.role > 1
        || c.story < 0
        || c.story > 3
        || c.round < 0
        || c.round >= 15
        || c.division < 1
        || c.division > 10
        || c.personalShirt != 9
        || c.season < 1
        || c.cupRound < 0
        || c.cupRound > 3
        || c.week < 0
        || c.formation < 0
        || c.formation > 2
        || c.press < 0
        || c.press > 2
        || c.mentality < 0
        || c.mentality > 2) throw new IOException("Karrieredata");
    c.formerClub = i.readInt();
    c.matchObjectives = i.readInt();
    c.seasonObjectiveWins = i.readInt();
    c.withdrawn = i.readInt();
    c.formSamples = i.readInt();
    if (c.formSamples < 0 || c.formSamples > 5 || c.formerClub < 0 || c.formerClub >= 16)
      throw new IOException("Formdata");
    for (int k = 0; k < 5; k++) c.lastFive[k] = i.readInt();
    c.cupAlive = i.readBoolean();
    c.cupDue = i.readBoolean();
    c.sound = i.readBoolean();
    if (c.cupDue && c.cupRound >= 3) throw new IOException("Pokaldata");
    for (int[] a : new int[][] {c.table, c.goalDiff, c.grade, c.fitness, c.injury, c.lineup})
      for (int n = 0; n < a.length; n++) a[n] = i.readInt();
    for (int k : c.lineup) if (k < 0 || k >= 18) throw new IOException("Trupdata");
    for (int n = 0; n < c.names.length; n++) c.names[n] = i.readUTF();
    for (ArrayList<String> list : Arrays.asList(c.history, c.honours)) {
      int count = i.readInt();
      if (count < 0 || count > 30) throw new IOException("Historik");
      for (int n = 0; n < count; n++) list.add(i.readUTF());
    }
    if (i.readBoolean()) c.match = Motor12.read(i);
    return c;
  }
}
