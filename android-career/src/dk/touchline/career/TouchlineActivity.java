package dk.touchline.career;

import android.app.*;
import android.content.*;
import android.content.res.AssetFileDescriptor;
import android.graphics.*;
import android.graphics.drawable.*;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class TouchlineActivity extends Activity implements StadiumView.Listener {
  private static final int WHITE = 0xfff3f3e7,
      GOLD = 0xfff2c363,
      INK = 0xff10251e,
      PANEL = 0xf223392d,
      MUTED = 0xffbfd1bf;
  private static final int F = -1, C = -2, EXPORT = 41, IMPORT = 42;
  private FrameLayout root, scene;
  private LinearLayout shell, body;
  private Bitmap night, cover, playerArt, kits, grandstand, grass;
  private Typeface display;
  private Career career;
  private Slots slots;
  private int slot = -1, roleChoice = 0, page = 0, tab = 0, storyIndex = 0;
  private String screen = "";
  private StadiumView pitch;
  private Motor12 practice;

  private Motor12 activeGame() {
    return practice == null ? career.match : practice;
  }

  private TextView score, ticker, active;
  private Button startButton, a, b, c, sprint;
  private FrameLayout matchOverlay;
  private String menuPage = "";
  private boolean resumeAfterMenu;
  private int effectStream;
  private SoundPool sound;
  private int whistle, cheer, kick, hum, crowdStream, previousKicks;
  private final ExecutorService documents = Executors.newSingleThreadExecutor();
  private boolean storageWarning;
  private float matchRate;

  private int dp(float v) {
    return (int) (getResources().getDisplayMetrics().density * v + .5f);
  }

  private boolean small() {
    return getResources().getConfiguration().screenHeightDp < 375;
  }

  private Bitmap bitmap(String name) throws IOException {
    try (InputStream in = getAssets().open(name)) {
      return BitmapFactory.decodeStream(in);
    }
  }

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    getWindow().setStatusBarColor(INK);
    getWindow().setNavigationBarColor(INK);
    root = new FrameLayout(this);
    root.setBackgroundColor(INK);
    setContentView(root);
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController bars = getWindow().getInsetsController();
      if (bars != null) {
        bars.hide(WindowInsets.Type.systemBars());
        bars.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else getWindow().getDecorView().setSystemUiVisibility(5894);
    root.setOnApplyWindowInsetsListener(
        (v, i) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets a =
                i.getInsets(
                    WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.systemBars()
                        | WindowInsets.Type.mandatorySystemGestures());
            v.setPadding(a.left, a.top, a.right, a.bottom);
          } else {
            int left = i.getSystemWindowInsetLeft(),
                top = i.getSystemWindowInsetTop(),
                right = i.getSystemWindowInsetRight(),
                bottom = i.getSystemWindowInsetBottom();
            if (Build.VERSION.SDK_INT >= 28 && i.getDisplayCutout() != null) {
              DisplayCutout cut = i.getDisplayCutout();
              left = Math.max(left, cut.getSafeInsetLeft());
              top = Math.max(top, cut.getSafeInsetTop());
              right = Math.max(right, cut.getSafeInsetRight());
              bottom = Math.max(bottom, cut.getSafeInsetBottom());
            }
            if (Build.VERSION.SDK_INT >= 29) {
              android.graphics.Insets gestures = i.getMandatorySystemGestureInsets();
              left = Math.max(left, gestures.left);
              right = Math.max(right, gestures.right);
              bottom = Math.max(bottom, gestures.bottom);
            }
            v.setPadding(left, top, right, bottom);
          }
          return i;
        });
    try {
      night = bitmap("stadium.webp");
      cover = bitmap("cover.webp");
      playerArt = bitmap("player.webp");
      kits = bitmap("kits.webp");
      grandstand = bitmap("tribune.webp");
      grass = bitmap("turf.webp");
      display = Typeface.createFromAsset(getAssets(), "display.ttf");
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
    AudioAttributes audio =
        new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();
    sound = new SoundPool.Builder().setMaxStreams(4).setAudioAttributes(audio).build();
    whistle = clip("whistle");
    cheer = clip("crowd-goal");
    kick = clip("kick-soft");
    hum = clip("ambience");
    setVolumeControlStream(AudioManager.STREAM_MUSIC);
    slots = new Slots(this);
    slot = slots.active();
    if (slot >= 0 && slot < Slots.COUNT) {
      try {
        career = slots.load(slot);
      } catch (IOException e) {
        message("Gemmepladsen kunne ikke læses. Vælg en plads eller hent en backup.");
      }
    }
    if (career == null) chooseRole();
    else if (career.match != null) matchScreen();
    else hub();
  }

  private int clip(String name) {
    try (AssetFileDescriptor f = getAssets().openFd(name + ".ogg")) {
      return sound.load(f, 1);
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  private void refresh(boolean live) {
    if (live && matchRate == 0) {
      Display screen = getWindowManager().getDefaultDisplay();
      Display.Mode current = screen.getMode();
      for (Display.Mode mode : screen.getSupportedModes())
        if (mode.getPhysicalWidth() == current.getPhysicalWidth()
            && mode.getPhysicalHeight() == current.getPhysicalHeight()
            && mode.getRefreshRate() <= 120.5f)
          matchRate = Math.max(matchRate, mode.getRefreshRate());
    }
    WindowManager.LayoutParams lp = getWindow().getAttributes();
    float rate = live ? matchRate : 0;
    if (lp.preferredRefreshRate != rate) {
      lp.preferredRefreshRate = rate;
      getWindow().setAttributes(lp);
    }
  }

  private void atmosphere(boolean on) {
    refresh(on);
    if (crowdStream != 0) {
      sound.stop(crowdStream);
      crowdStream = 0;
    }
    if (on && career.sound) crowdStream = sound.play(hum, level(.17f), level(.17f), 1, -1, 1);
  }

  private float level(float gain) {
    return gain * career.volume / 100f;
  }

  private void effect(int clip, float gain) {
    if (career.sound && career.volume > 0)
      effectStream = sound.play(clip, level(gain), level(gain), 2, 0, 1);
  }

  @Override
  public void whistle(boolean goal) {
    effect(goal ? cheer : whistle, .55f);
    if (!pitch.isPlaying()) atmosphere(false);
  }

  @Override
  public void checkpoint() {
    save();
  }

  private boolean save() {
    if (career == null || slot < 0) return true;
    try {
      slots.save(slot, career);
      storageWarning = false;
      return true;
    } catch (IOException e) {
      if (!storageWarning) {
        storageWarning = true;
        message("Kunne ikke gemme. Kontrollér ledig plads.");
      }
      return false;
    }
  }

  private void message(String s) {
    Toast.makeText(this, s, Toast.LENGTH_LONG).show();
  }

  private void note(String title, String text) {
    new AlertDialog.Builder(this)
        .setTitle(title)
        .setMessage(text)
        .setPositiveButton("Luk", null)
        .show();
  }

  private void options(String title, String[] values, java.util.function.IntConsumer choose) {
    new AlertDialog.Builder(this)
        .setTitle(title)
        .setItems(values, (d, n) -> choose.accept(n))
        .setNegativeButton("Tilbage", null)
        .show();
  }

  private GradientDrawable background(int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(radius));
    return d;
  }

  private TextView text(String s, int size, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextColor(color);
    t.setTextSize(size);
    t.setIncludeFontPadding(false);
    t.setTypeface(bold ? display : Typeface.create("sans-serif", Typeface.NORMAL));
    t.setGravity(Gravity.CENTER_VERTICAL);
    return t;
  }

  private Button button(String label, boolean gold, Runnable action) {
    Button btn = new Button(this);
    btn.setText(label);
    btn.setContentDescription(label);
    btn.setAllCaps(false);
    btn.setTextSize(small() ? 14 : 16);
    btn.setTypeface(display);
    btn.setTextColor(gold ? INK : WHITE);
    btn.setPadding(dp(10), 0, dp(10), 0);
    btn.setMinWidth(0);
    btn.setMinimumWidth(0);
    btn.setMinHeight(0);
    btn.setMinimumHeight(0);
    btn.setBackground(
        new RippleDrawable(
            android.content.res.ColorStateList.valueOf(0x447bcc9c),
            background(gold ? GOLD : PANEL, 5),
            null));
    btn.setOnClickListener(v -> action.run());
    return btn;
  }

  private LinearLayout col() {
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    return l;
  }

  private LinearLayout row() {
    LinearLayout l = new LinearLayout(this);
    l.setGravity(Gravity.CENTER_VERTICAL);
    return l;
  }

  private void cell(LinearLayout row, View v, float weight, int height) {
    LinearLayout.LayoutParams lp =
        new LinearLayout.LayoutParams(0, height < 0 ? height : dp(height), weight);
    lp.setMargins(0, 0, dp(5), 0);
    row.addView(v, lp);
  }

  private void block(LinearLayout col, View v, int height) {
    LinearLayout.LayoutParams lp =
        new LinearLayout.LayoutParams(F, height < 0 ? height : dp(height));
    lp.bottomMargin = dp(4);
    col.addView(v, lp);
  }

  private void flex(LinearLayout col, View v, float weight) {
    col.addView(v, new LinearLayout.LayoutParams(F, 0, weight));
  }

  private void layer(FrameLayout base, View v, int width, int height, int gravity, int x, int y) {
    FrameLayout.LayoutParams lp =
        new FrameLayout.LayoutParams(
            width < 0 ? width : dp(width), height < 0 ? height : dp(height), gravity);
    if ((gravity & Gravity.HORIZONTAL_GRAVITY_MASK) == Gravity.RIGHT) lp.rightMargin = dp(x);
    else lp.leftMargin = dp(x);
    if ((gravity & Gravity.VERTICAL_GRAVITY_MASK) == Gravity.BOTTOM) lp.bottomMargin = dp(y);
    else lp.topMargin = dp(y);
    base.addView(v, lp);
  }

  private void image(FrameLayout dest, Bitmap bmp) {
    ImageView view = new ImageView(this);
    view.setScaleType(ImageView.ScaleType.CENTER_CROP);
    view.setImageBitmap(bmp);
    dest.addView(view, new FrameLayout.LayoutParams(F, F));
  }

  private void shade(FrameLayout dest, int left, int right) {
    View scrim = new View(this);
    scrim.setBackground(
        new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {left, right}));
    dest.addView(scrim, new FrameLayout.LayoutParams(F, F));
  }

  private void mount(String view) {
    if (pitch != null) {
      pitch.pausePlay();
      atmosphere(false);
      pitch = null;
    }
    matchOverlay = null;
    menuPage = "";
    if (!view.equals("match")) practice = null;
    screen = view;
    root.removeAllViews();
    scene = new FrameLayout(this);
    root.addView(scene, new FrameLayout.LayoutParams(F, F));
    if (!"match".equals(view)) {
      image(scene, night);
      shade(scene, 0xf20a1815, 0xbd0e211b);
    }
    if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
      scene.setAlpha(.35f);
      scene.setTranslationX(dp(9));
      scene.animate().alpha(1).translationX(0).setDuration(180).start();
    }
  }

  private void layout(String section) {
    shell = col();
    shell.setPadding(dp(14), dp(7), dp(10), dp(5));
    scene.addView(shell, new FrameLayout.LayoutParams(F, F));
    LinearLayout mast = row();
    TextView word = text("TOUCHLINE", 22, WHITE, true);
    word.setLetterSpacing(.06f);
    cell(mast, word, 1, 30);
    TextView tag = text(section, 14, GOLD, true);
    tag.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
    cell(mast, tag, 2, 30);
    block(shell, mast, 31);
    View rule = new View(this);
    rule.setBackgroundColor(0xff528362);
    block(shell, rule, 1);
    body = col();
    flex(shell, body, 1);
  }

  private FrameLayout tile(Bitmap bmp) {
    FrameLayout box = new FrameLayout(this);
    box.setBackground(background(INK, 7));
    box.setClipToOutline(true);
    image(box, bmp);
    shade(box, 0xe30e211c, 0x330d211b);
    return box;
  }

  private LinearLayout inset(FrameLayout f) {
    LinearLayout l = col();
    l.setPadding(dp(14), dp(9), dp(11), dp(9));
    l.setGravity(Gravity.CENTER_VERTICAL);
    f.addView(l, new FrameLayout.LayoutParams(F, F));
    return l;
  }

  private void chooseRole() {
    mount("roles");
    layout("KARRIEREVALG");
    block(body, text("Din vej ind i fodbolden", small() ? 25 : 33, WHITE, true), small() ? 32 : 43);
    LinearLayout r = row();
    flex(body, r, 1);
    for (int k = 0; k < 2; k++) {
      final int role = k;
      FrameLayout f = tile(k == 0 ? cover : night);
      cell(r, f, 1, F);
      LinearLayout l = inset(f);
      block(l, text(k == 0 ? "PÅ BANEN" : "VED SIDELINJEN", 13, GOLD, true), 19);
      block(l, text(Career.FORMS[k], small() ? 25 : 33, WHITE, true), 44);
      block(
          l,
          text(
              k == 0 ? "Styr din spiller. Kæmp for en plads." : "Sæt holdet. Styr taktikken.",
              14,
              WHITE,
              false),
          C);
      block(
          l,
          button(
              "Vælg " + Career.FORMS[k].toLowerCase(Locale.ROOT),
              true,
              () -> {
                roleChoice = role;
                storyIndex = 0;
                stories();
              }),
          40);
    }
    block(body, button("Mine gemmepladser · backup", false, this::slotsPage), 36);
  }

  private void stories() {
    mount("stories");
    layout(Career.FORMS[roleChoice].toUpperCase(Locale.ROOT));
    LinearLayout r = row();
    flex(body, r, 1);
    LinearLayout choices = col();
    cell(r, choices, 1, F);
    for (int i = 0; i < 4; i++) {
      int n = i;
      flex(
          choices,
          button(
              Career.STORIES[roleChoice][i],
              i == storyIndex,
              () -> {
                storyIndex = n;
                stories();
              }),
          1);
    }
    FrameLayout f = tile(roleChoice == 0 ? playerArt : night);
    cell(r, f, 1.6f, F);
    LinearLayout l = inset(f);
    block(l, text(Career.STORIES[roleChoice][storyIndex], small() ? 23 : 32, WHITE, true), C);
    block(l, text(Career.BRIEFS[roleChoice][storyIndex], 15, WHITE, false), C);
    block(
        l,
        button(
            "Start karriere",
            true,
            () -> {
              int free =
                  preferredSlot >= 0 && !slots.exists(preferredSlot) ? preferredSlot : slots.free();
              preferredSlot = -1;
              if (free < 0) {
                note(
                    "Alle pladser er i brug",
                    "Åbn Mine gemmepladser for at eksportere eller frigøre en plads.");
                return;
              }
              Career previous = career;
              int previousSlot = slot;
              career = new Career(roleChoice, storyIndex);
              slot = free;
              if (!save()) {
                career = previous;
                slot = previousSlot;
                return;
              }
              slots.select(slot);
              tab = 0;
              page = 0;
              hub();
            }),
        42);
    block(body, button("Tilbage", false, this::chooseRole), 34);
  }

  private void hub() {
    mount("hub");
    layout(Career.FORMS[career.role] + "   /   SÆSON " + career.season);
    LinearLayout tabs = row();
    String[] labels = {"Kampdag", "Træning", "Trup", "Karriere", "Gemmepladser"};
    for (int i = 0; i < labels.length; i++) {
      int n = i;
      cell(
          tabs,
          button(
              labels[i],
              i == tab,
              () -> {
                if (n == 4) slotsPage();
                else {
                  tab = n;
                  page = 0;
                  hub();
                }
              }),
          1,
          35);
    }
    block(shell, tabs, 38);
    switch (tab) {
      case 0:
        matchday();
        break;
      case 1:
        training();
        break;
      case 2:
        squad();
        break;
      default:
        careerDesk();
    }
  }

  private LinearLayout panel() {
    LinearLayout l = col();
    l.setPadding(dp(11), dp(7), dp(10), dp(6));
    l.setBackground(background(PANEL, 6));
    l.setGravity(Gravity.CENTER_VERTICAL);
    return l;
  }

  private void matchday() {
    LinearLayout r = row();
    flex(body, r, 1);
    FrameLayout f = tile(cover);
    cell(r, f, 1.45f, F);
    LinearLayout l = inset(f);
    block(l, text(career.competition().toUpperCase(Locale.ROOT), 14, GOLD, true), 22);
    block(
        l,
        text(
            career.clubName + "  /  " + career.team(career.opposition()),
            small() ? 24 : 33,
            WHITE,
            true),
        C);
    block(
        l,
        text(
            career.match == null ? "Klar til kamp" : career.match.clock() + "   ·   Aktiv kamp",
            14,
            WHITE,
            false),
        22);
    LinearLayout actions = row();
    if (career.match != null)
      cell(actions, button("Fortsæt kampen", true, this::matchScreen), 1, 43);
    else {
      cell(actions, button("Spil selv", true, this::chooseControl), 1, 43);
      cell(actions, button("Simulér kampen", false, () -> begin(Career.Control.SIMULATION)), 1, 43);
    }
    block(l, actions, 46);
    LinearLayout side = panel();
    cell(r, side, .9f, F);
    block(side, text("Omklædningsrummet", 22, WHITE, true), C);
    block(
        side,
        text(
            "Nr. "
                + career.position()
                + " i ligaen   ·   "
                + career.points
                + " point\n"
                + career.formGuide()
                + "   ·   Moral "
                + career.morale
                + "/100",
            15,
            MUTED,
            false),
        C);
    block(side, button("Ligatabel", false, this::table), 35);
    block(
        side,
        button(
            "Kampbriefing",
            false,
            () ->
                note(
                    "Kampbriefing",
                    career.matchObjective()
                        + "\n\nSæsonmål · "
                        + career.seasonObjective()
                        + "\n\nSeneste rapport\n"
                        + career.lastReport)),
        35);
    if (career.hasDecision())
      block(side, button("Beslutning før kampen", true, this::decision), 35);
  }

  private void chooseControl() {
    if (career.role == 1) {
      begin(Career.Control.TEAM);
      return;
    }
    boolean fit = career.playerAvailable();
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle("Hvem vil du styre?")
            .setMessage(
                fit
                    ? "Følg din egen spiller, eller skift mellem holdets spillere i denne kamp."
                    : "Din spiller er skadet. Du kan stadig spille kampen med resten af holdet.")
            .setPositiveButton("Min spiller", (d, n) -> begin(Career.Control.PLAYER))
            .setNegativeButton("Hele holdet", (d, n) -> begin(Career.Control.TEAM))
            .setNeutralButton("Tilbage", null)
            .show();
    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(fit);
  }

  private void begin(Career.Control control) {
    career.start(control);
    if (save()) matchScreen();
  }

  private void training() {
    LinearLayout r = row();
    flex(body, r, 1);
    LinearLayout l = panel();
    cell(r, l, 1, F);
    block(l, text("Træningsbanen", 26, WHITE, true), C);
    block(
        l,
        text(
            "Fokusspiller · " + career.name(career.focusPlayer()) + "\nVælg ét pas før hver kamp.",
            15,
            MUTED,
            false),
        C);
    for (int k = 0; k < 3; k++) {
      final int n = k;
      Button btn =
          button(
              Career.FOCUS[k],
              career.training == k,
              () -> {
                message(career.train(n));
                career.checkMissions();
                save();
                hub();
              });
      btn.setEnabled(career.match == null && career.training < 0);
      block(l, btn, 34);
    }
    FrameLayout f = tile(night);
    cell(r, f, 1, F);
    LinearLayout info = inset(f);
    block(info, text(career.role == 1 ? "Klubbens anlæg" : "Spillerprofil", 26, WHITE, true), C);
    block(
        info,
        text(
            career.role == 1
                ? "Træningsanlæg " + career.facilities + "/5\nKlubkasse " + career.budget + " kr."
                : "Rating "
                    + career.grade[8]
                    + "   ·   Kondition "
                    + career.fitness[8]
                    + " %\n"
                    + career.personalGoals
                    + " mål   ·   "
                    + career.personalAssists
                    + " oplæg\n"
                    + (career.injury[8] > 0
                        ? "Skadet i " + career.injury[8] + " kampe"
                        : "Klar til udtagelse"),
            16,
            WHITE,
            false),
        C);
    block(
        info,
        button(
            "Dødboldstræning",
            false,
            () ->
                options(
                    "Træningsbanen",
                    new String[] {"Frispark · 22 meter", "Målspark · kort eller langt"},
                    i -> {
                      practice = Motor12.practice(i == 0);
                      matchScreen();
                    })),
        35);
    if (career.role == 1) {
      Button b =
          button(
              "Udvid anlæg · " + (45000 * career.facilities) + " kr.",
              false,
              () -> {
                message(career.upgrade());
                save();
                hub();
              });
      b.setEnabled(
          career.match == null
              && career.budget >= 45000 * career.facilities
              && career.facilities < 5);
      block(info, b, 38);
    }
  }

  private void squad() {
    int count = small() ? 3 : 4, total = (18 + count - 1) / count;
    page = Math.floorMod(page, total);
    LinearLayout header = row();
    cell(header, text("Trup og kondition", 23, WHITE, true), 2, 32);
    cell(
        header,
        button(
            "‹",
            false,
            () -> {
              page--;
              hub();
            }),
        .45f,
        32);
    cell(header, text((page + 1) + " / " + total, 15, GOLD, true), .5f, 32);
    cell(
        header,
        button(
            "›",
            false,
            () -> {
              page++;
              hub();
            }),
        .45f,
        32);
    block(body, header, 36);
    for (int j = page * count; j < Math.min(18, (page + 1) * count); j++) {
      final int k = j;
      LinearLayout rr = row();
      rr.setBackground(background(PANEL, 4));
      cell(rr, text("  " + (j + 1) + "   " + career.name(j), 17, WHITE, true), 1.6f, F);
      cell(
          rr,
          text("RAT " + career.grade[j] + "   ·   " + career.fitness[j] + " %", 14, MUTED, false),
          1,
          F);
      cell(
          rr,
          text(
              career.injury[j] > 0
                  ? "Skadet · " + career.injury[j] + " kampe"
                  : starting(j) ? "Startellever" : "Reserve",
              14,
              GOLD,
              true),
          1,
          F);
      flex(body, rr, 1);
    }
    LinearLayout ops = row();
    if (career.role == 1) {
      cell(ops, button("Holdudtagelse", false, () -> substitute(false)), 1, 34);
      cell(ops, button("Taktiktavle", false, this::board), 1, 34);
    }
    cell(
        ops,
        button(career.role == 0 ? "Forhandl kontrakt" : "Transfermarked", false, this::market),
        1,
        34);
    block(body, ops, 35);
  }

  private void board() {
    LinearLayout content = col();
    TacticsBoard view = new TacticsBoard(this, career);
    content.addView(view, new LinearLayout.LayoutParams(F, dp(small() ? 126 : 164)));
    new AlertDialog.Builder(this)
        .setTitle("Taktiktavle · " + Career.FORMATIONS[career.formation])
        .setView(content)
        .setPositiveButton("Ændr plan", (d, n) -> plan())
        .setNegativeButton("Luk", null)
        .show();
  }

  private boolean starting(int k) {
    for (int i : career.lineup) if (i == k) return true;
    return false;
  }

  private void market() {
    String text =
        career.window()
            ? "Transfervinduet er åbent."
            : "Næste vindue åbner ved sæsonstart eller efter syv ligakampe.";
    text +=
        career.role == 0
            ? "\nKontrakt · "
                + career.contract
                + " sæsoner\nUgeløn · "
                + career.wage
                + " kr.\nTilbud · 3 sæsoner på forbedrede vilkår."
            : "\nSpejderrapport · "
                + Career.SCOUTS[(career.week + career.season) % 6]
                + "\nTransfersum · "
                + (31000 + career.season * 2300)
                + " kr.\nAftalen besætter den lavest ratede reserveplads.";
    AlertDialog.Builder dialog =
        new AlertDialog.Builder(this)
            .setTitle(career.role == 0 ? "Kontraktbordet" : "Transferkontoret")
            .setMessage(text)
            .setNegativeButton("Luk", null);
    if (career.canTransfer())
      dialog.setNeutralButton(
          "Til " + career.offerClub(),
          (d, n) -> {
            message(career.transfer());
            save();
            hub();
          });
    if (career.window() && career.marketWeek != career.week && career.match == null)
      dialog.setPositiveButton(
          "Indgå aftale",
          (d, n) -> {
            message(career.market());
            save();
            hub();
          });
    dialog.show();
  }

  private void careerDesk() {
    LinearLayout r = row();
    flex(body, r, 1);
    LinearLayout l = panel();
    cell(r, l, 1, F);
    block(l, text(career.standing() + " · " + career.storyName(), 25, WHITE, true), C);
    block(
        l,
        text(
            "Omdømme "
                + career.reputation
                + "   ·   Tillid "
                + career.trust
                + "\nFans "
                + career.fans
                + "   ·   Mediepres "
                + career.pressure
                + "\n"
                + career.headline,
            15,
            MUTED,
            false),
        C);
    if (career.hasDecision())
      block(
          l,
          button(
              "Svar på " + (career.role == 0 ? "forespørgslen" : "klubbens spørgsmål"),
              true,
              this::decision),
          36);
    block(
        l,
        button(
            "Trofæskab · " + career.trophies,
            false,
            () ->
                note(
                    "Priser og milepæle",
                    career.honours.isEmpty()
                        ? "Dine titler, sæsonplaceringer og priser gemmes her."
                        : android.text.TextUtils.join("\n", career.honours))),
        35);
    block(
        l,
        button(
            "Kampjournal",
            false,
            () ->
                note(
                    "Kampjournal",
                    career.history.isEmpty()
                        ? "Første rapport kommer efter slutfløjt."
                        : android.text.TextUtils.join("\n", career.history))),
        35);
    LinearLayout m = panel();
    cell(r, m, 1.2f, F);
    block(m, text("Missioner", 24, WHITE, true), C);
    int[] progress = career.progress(), targets = career.targets();
    String[] missions = career.missions();
    for (int i = 0; i < missions.length; i++) {
      TextView t =
          text(
              ((career.earned & (1 << i)) != 0 ? "✓  " : "")
                  + missions[i]
                  + "   "
                  + Math.min(progress[i], targets[i])
                  + "/"
                  + targets[i],
              14,
              (career.earned & (1 << i)) != 0 ? GOLD : WHITE,
              false);
      flex(m, t, 1);
    }
  }

  private void decision() {
    new AlertDialog.Builder(this)
        .setTitle(career.storyName())
        .setMessage(career.question())
        .setPositiveButton(career.choice(true), (d, n) -> answer(true))
        .setNegativeButton(career.choice(false), (d, n) -> answer(false))
        .show();
  }

  private void answer(boolean press) {
    message(career.decide(press));
    career.checkMissions();
    save();
    hub();
  }

  private void table() {
    StringBuilder s = new StringBuilder();
    int pos = 0;
    for (int n : career.order())
      s.append(++pos)
          .append("   ")
          .append(career.team(n))
          .append("   ·   ")
          .append(career.table[n])
          .append(" p   /   ")
          .append(career.goalDiff[n])
          .append("\n");
    note(
        "League "
            + career.division
            + (career.division == 1 ? " · mesterskab" : " · top 3 rykker op"),
        s.toString());
  }

  private void slotsPage() {
    mount("slots");
    layout("KARRIERER  /  LOKAL LAGRING");
    LinearLayout grid = col();
    flex(body, grid, 1);
    for (int row = 0; row < 2; row++) {
      LinearLayout rr = row();
      flex(grid, rr, 1);
      for (int col = 0; col < 2; col++) {
        final int i = row * 2 + col;
        String label = "Plads " + (i + 1) + " · Ny karriere";
        if (slots.exists(i))
          try {
            Career cs = slots.load(i);
            label =
                cs.storyName()
                    + " · S"
                    + cs.season
                    + " / L"
                    + cs.division
                    + "\n"
                    + Career.FORMS[cs.role]
                    + " · "
                    + cs.week
                    + " kampe";
          } catch (IOException e) {
            label = "Plads " + (i + 1) + " · Kan ikke læses";
          }
        cell(rr, button(label, i == slot, () -> slotOptions(i)), 1, F);
      }
    }
    LinearLayout bar = row();
    cell(
        bar,
        button(
            "Tilbage",
            false,
            () -> {
              if (career == null) chooseRole();
              else hub();
            }),
        1,
        38);
    cell(bar, button("Cloud og backup", false, this::cloud), 1.2f, 38);
    block(body, bar, 40);
  }

  private int preferredSlot = -1;

  private void slotOptions(int i) {
    if (!slots.exists(i)) {
      preferredSlot = i;
      chooseRole();
      return;
    }
    options(
        "Gemmeplads " + (i + 1),
        new String[] {"Fortsæt karrieren", "Slet denne plads"},
        n -> {
          if (n == 0) {
            try {
              Career loaded = slots.load(i);
              career = loaded;
              slot = i;
              slots.select(i);
              tab = page = 0;
              if (career.match != null) matchScreen();
              else hub();
            } catch (IOException e) {
              message("Denne fil kunne ikke indlæses.");
            }
          } else
            new AlertDialog.Builder(this)
                .setTitle("Slet gemmeplads " + (i + 1) + "?")
                .setMessage("Din lokale karriere slettes permanent. Eksporterede kopier bevares.")
                .setNegativeButton("Behold", null)
                .setPositiveButton(
                    "Slet",
                    (d, j) -> {
                      slots.remove(i);
                      if (slot == i) {
                        slot = -1;
                        career = null;
                        slots.select(-1);
                      }
                      slotsPage();
                    })
                .show();
        });
  }

  private void cloud() {
    String[] items =
        career == null
            ? new String[] {"Hent en backup", "Tilføj cloudkonto på Android"}
            : new String[] {
              "Gem en kopi af denne karriere", "Hent en backup", "Tilføj cloudkonto på Android"
            };
    new AlertDialog.Builder(this)
        .setTitle("Valgfri cloudbackup")
        .setItems(
            items,
            (d, n) -> {
              int choice = career == null ? n + 1 : n;
              if (choice == 2) {
                try {
                  startActivity(new Intent(Settings.ACTION_ADD_ACCOUNT));
                } catch (ActivityNotFoundException e) {
                  note(
                      "Cloudkonto",
                      "Åbn din cloudapp og log ind. Dens filer kan derefter vælges i Androids"
                          + " filvælger.");
                }
                return;
              }
              if (choice == 1 && slots.free() < 0) {
                note(
                    "Ingen ledig plads",
                    "Frigør en gemmeplads før gendannelse. Dine eksisterende karrierer bevares.");
                return;
              }
              Intent picker =
                  new Intent(
                          choice == 0 ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT)
                      .addCategory(Intent.CATEGORY_OPENABLE);
              picker.setType(choice == 0 ? "application/octet-stream" : "*/*");
              if (choice == 0) {
                if (!save()) return;
                picker.putExtra(
                    Intent.EXTRA_TITLE,
                    "Touchline-S"
                        + career.season
                        + "-K"
                        + career.week
                        + "-"
                        + System.currentTimeMillis()
                        + ".tls");
              }
              try {
                startActivityForResult(picker, choice == 0 ? EXPORT : IMPORT);
              } catch (ActivityNotFoundException e) {
                message("Androids filvælger er utilgængelig.");
              }
            })
        .setNegativeButton("Luk", null)
        .setNeutralButton(
            "Sådan virker det",
            (d, n) ->
                note(
                    "Backup på din konto",
                    "Spillet gemmer automatisk på mobilen. Vælg f.eks. Google Drev i Androids"
                        + " filvælger for at gemme en kopi på din egen konto. På en anden telefon"
                        + " vælger du Hent en backup. Hver kopi får sit eget navn og gendannes på"
                        + " en ledig plads."))
        .show();
  }

  @Override
  protected void onActivityResult(int req, int res, Intent data) {
    super.onActivityResult(req, res, data);
    if ((req != IMPORT && req != EXPORT)
        || res != RESULT_OK
        || data == null
        || data.getData() == null) return;
    Uri uri = data.getData();
    final byte[] snapshot;
    try {
      snapshot = req == EXPORT ? SaveFormat.encode(career) : null;
    } catch (Exception e) {
      message("Karrieren kunne ikke eksporteres.");
      return;
    }
    documents.execute(
        () -> {
          try {
            if (req == EXPORT) {
              try (OutputStream s = getContentResolver().openOutputStream(uri, "wt")) {
                if (s == null) throw new IOException();
                s.write(snapshot);
              }
              runOnUiThread(() -> message("Kopien er skrevet til den valgte udbyder."));
            } else {
              final Career imported;
              try (InputStream s = getContentResolver().openInputStream(uri)) {
                if (s == null) throw new IOException();
                imported = SaveFormat.decode(s);
              }
              runOnUiThread(
                  () -> {
                    if (isFinishing() || isDestroyed()) return;
                    int free = slots.free();
                    if (free < 0) {
                      message("Ingen ledig plads.");
                      return;
                    }
                    try {
                      slots.save(free, imported);
                      message("Backup gendannet på plads " + (free + 1));
                      slotsPage();
                    } catch (IOException e) {
                      message("Der kunne ikke gemmes lokalt.");
                    }
                  });
            }
          } catch (Exception e) {
            runOnUiThread(
                () -> message("Backup mislykkedes. Kontrollér udbyder, forbindelse og filformat."));
          }
        });
  }

  private void matchScreen() {

    mount("match");
    Motor12 m = activeGame();
    if (m == null) {
      hub();
      return;
    }
    pitch = new StadiumView(this, m, kits, grandstand, grass, this);
    pitch.setCamera(career.camera);
    scene.addView(pitch, new FrameLayout.LayoutParams(F, F));
    scene.setMotionEventSplittingEnabled(true);
    score = text("", 19, WHITE, true);
    score.setSingleLine(true);
    score.setPadding(dp(10), 0, dp(10), 0);
    score.setBackground(background(0xf0183128, 4));
    layer(scene, score, C, 32, Gravity.TOP | Gravity.LEFT, 8, 6);
    ticker = text("", 13, WHITE, true);
    ticker.setPadding(dp(7), 0, dp(7), 0);
    ticker.setBackground(background(0xcc16281f, 3));
    layer(scene, ticker, C, 22, Gravity.TOP | Gravity.LEFT, 8, 42);
    Button menu = button("Kampmenu", false, this::matchMenu);
    layer(scene, menu, 87, 36, Gravity.TOP | Gravity.RIGHT, 8, 6);
    startButton = button("", true, this::togglePlay);
    startButton.setPadding(dp(3), 0, dp(3), 0);
    layer(scene, startButton, 83, 36, Gravity.TOP | Gravity.RIGHT, 101, 6);
    active = text("", 13, WHITE, true);
    active.setGravity(Gravity.CENTER);
    active.setBackground(background(0xbc112d22, 2));
    layer(scene, active, C, 22, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL, 0, 7);
    if (m.manual) {
      a = command("A", Motor12.SHOOT, 8, 10);
      b = command("B", Motor12.PASS, 77, 12);
      c = command("C", Motor12.THROUGH, 33, 81);
      sprint = button("Sprint", false, () -> {});
      sprint.setBackground(controlBackground());
      sprint.setTextSize(13);
      sprint.setOnTouchListener(
          (v, e) -> {
            int ev = e.getActionMasked();
            if (ev == MotionEvent.ACTION_DOWN) {
              if (!pitch.isPlaying()) return false;
              pitch.input.sprint = true;
              v.setPressed(true);
            }
            if (ev == MotionEvent.ACTION_UP || ev == MotionEvent.ACTION_CANCEL) {
              pitch.input.sprint = false;
              v.setPressed(false);
            }
            return true;
          });
      layer(
          scene,
          sprint,
          51,
          42,
          Gravity.BOTTOM | Gravity.LEFT,
          Math.max(95, Math.min(150, getResources().getConfiguration().screenHeightDp / 3)),
          12);
    }
    previousKicks = m.kicks;
    hud();
    if (practice != null && m.phase != Motor12.Phase.FULL_TIME) {
      pitch.startPlay();
      atmosphere(true);
    }
  }

  private boolean defence() {
    Motor12 m = activeGame();
    return m.phase == Motor12.Phase.RESTART
        ? m.restartSide == 1
        : (m.owner >= 0 ? m.owner : m.last) >= 11;
  }

  private Button command(String letter, int attack, int right, int bottom) {
    Button btn = button(letter, false, () -> {});
    btn.setBackground(controlBackground());
    final double[] power = {.45};
    btn.setOnClickListener(
        v -> {
          if (pitch == null || !pitch.isPlaying()) return;
          int cmd = attack;
          if (defence())
            cmd =
                attack == Motor12.PASS
                    ? Motor12.PRESS_BALL
                    : attack == Motor12.THROUGH && activeGame().locked < 0
                        ? Motor12.SWITCH
                        : Motor12.TACKLE;
          pitch.input.power = power[0];
          pitch.action(cmd);
          power[0] = .45;
          v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
        });
    btn.setOnTouchListener(
        (v, e) -> {
          if (!v.isEnabled()) return false;
          switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
              v.setPressed(true);
              return true;
            case MotionEvent.ACTION_UP:
              v.setPressed(false);
              power[0] = Motor12.clamp(.22 + (e.getEventTime() - e.getDownTime()) / 720., .22, 1);
              v.performClick();
              return true;
            case MotionEvent.ACTION_CANCEL:
              v.setPressed(false);
              return true;
            default:
              return true;
          }
        });
    btn.setPadding(0, 0, 0, 0);
    btn.setTextSize(15);
    int size = attack == Motor12.SHOOT ? 65 : 55;
    layer(scene, btn, size, size, Gravity.BOTTOM | Gravity.RIGHT, right, bottom);
    return btn;
  }

  private StateListDrawable controlBackground() {
    StateListDrawable state = new StateListDrawable();
    state.addState(new int[] {android.R.attr.state_pressed}, background(0xeb927029, 40));
    state.addState(new int[] {}, background(0xb0183429, 40));
    return state;
  }

  private void buttonText(Button btn, String s) {
    if (!s.contentEquals(btn.getText())) {
      btn.setText(s);
      btn.setContentDescription(s.replace('\n', ' '));
    }
  }

  @Override
  public void hud() {
    if (pitch == null) return;
    Motor12 m = activeGame();
    String away =
        practice != null
            ? "TRÆ"
            : career.team(career.opposition()).substring(0, 3).toUpperCase(Locale.ROOT);
    score.setText(
        career.clubName.substring(0, 3).toUpperCase(Locale.ROOT)
            + "    "
            + m.goals[0]
            + " – "
            + m.goals[1]
            + "    "
            + away
            + "     "
            + m.clock()
            + "   ·   "
            + (m.phase == Motor12.Phase.FULL_TIME ? "FT" : m.half + ". HL"));
    ticker.setText(
        m.phase == Motor12.Phase.PRE_KICKOFF
            ? "Klar til afspark"
            : m.phase == Motor12.Phase.RESTART ? m.restartName() : m.newest());
    String control =
        m.phase == Motor12.Phase.FULL_TIME
            ? "Kamprapport"
            : m.awaitingKickoff() ? "KICK OFF" : pitch.isPlaying() ? "Pause" : "Genoptag";
    buttonText(startButton, control);
    if (m.manual) {
      boolean def = defence();
      String playB =
          m.locked >= 0 && m.owner >= 0 && m.owner < 11 && m.owner != m.locked ? "Kald" : "Aflever";
      buttonText(
          a,
          def
              ? "A\nTackl"
              : m.phase == Motor12.Phase.RESTART && m.restartType == 2 ? "A\nLangt" : "A\nSkyd");
      buttonText(b, def ? "B\nPres" : "B\n" + playB);
      buttonText(c, def ? (m.locked < 0 ? "C\nSkift" : "C\nTackl") : "C\nStikning");
      boolean live = pitch.isPlaying();
      a.setEnabled(live);
      b.setEnabled(live);
      c.setEnabled(live);
      sprint.setEnabled(live);
      if (!live) sprint.setPressed(false);
      Motor12.Player p = m.players[m.selected];
      active.setText(
          "  #"
              + p.shirt
              + " "
              + career.name(p.shirt - 1)
              + " · "
              + (m.locked == m.selected ? "dig" : m.selected == 0 ? "målmand" : "styret")
              + "   "
              + (int) p.energy
              + " % · "
              + (p.energy < 40
                  ? "Træt"
                  : pitch.input.sprint
                      ? "Sprint"
                      : "Kampform "
                          + String.format(
                              Locale.getDefault(),
                              "%.1f",
                              Motor12.clamp(
                                  6
                                      + p.goals * .9
                                      + p.assists * .65
                                      + p.complete * .04
                                      + p.tackles * .10
                                      - p.cards * .6,
                                  1,
                                  10)))
              + "  ");
      active.setTextColor(p.energy < 40 ? 0xffffa180 : pitch.input.sprint ? GOLD : WHITE);
    } else
      active.setText(
          "  "
              + Career.FORMATIONS[m.formations[0]]
              + "   ·   "
              + Career.PRESS[m.press[0]]
              + "   ·   "
              + pitch.speed
              + "×  ");
    if (career.sound && pitch.isPlaying() && m.kicks > previousKicks) effect(kick, .24f);
    previousKicks = m.kicks;
  }

  private void togglePlay() {
    if (pitch == null) return;
    Motor12 m = activeGame();
    if (m.phase == Motor12.Phase.FULL_TIME) {
      if (practice != null) {
        tab = 1;
        hub();
        return;
      }
      career.settle();
      save();
      tab = 0;
      hub();
      note("Kamprapport", career.lastReport);
      return;
    }
    if (pitch.isPlaying()) {
      pauseMatch();
      return;
    }
    boolean kickoff = m.kickOff();
    pitch.startPlay();
    if (kickoff) whistle(false);
    atmosphere(true);
    save();
  }

  private void pauseMatch() {
    if (pitch != null) {
      pitch.pausePlay();
      atmosphere(false);
      hud();
      save();
    }
  }

  private void matchMenu() {
    resumeAfterMenu = pitch != null && pitch.isPlaying();
    pauseMatch();
    if (practice != null) {
      boolean free = practice.log.stream().anyMatch(e -> e.contains("Frispark"));
      options(
          "Træningsbanen",
          new String[] {"Genoptag", "Gentag sparket", "Afslut træningen"},
          n -> {
            if (n == 0) togglePlay();
            else if (n == 1) {
              practice = Motor12.practice(free);
              matchScreen();
            } else {
              tab = 1;
              hub();
            }
          });
      return;
    }
    showMatchPanel("Kampmenu");
  }

  private void closeMatchPanel(boolean resume) {
    if (matchOverlay != null) scene.removeView(matchOverlay);
    matchOverlay = null;
    menuPage = "";
    for (int n = 0; n < scene.getChildCount(); n++)
      scene.getChildAt(n).setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
    if (resume
        && resumeAfterMenu
        && pitch != null
        && !activeGame().awaitingKickoff()
        && activeGame().phase != Motor12.Phase.FULL_TIME) {
      pitch.startPlay();
      atmosphere(true);
    }
    resumeAfterMenu = false;
  }

  private void showMatchPanel(String title) {
    if (matchOverlay != null) scene.removeView(matchOverlay);
    menuPage = title;
    Motor12 m = activeGame();
    matchOverlay = new FrameLayout(this);
    matchOverlay.setBackgroundColor(0x36091813);
    matchOverlay.setClickable(true);
    matchOverlay.setElevation(dp(24));
    for (int n = 0; n < scene.getChildCount(); n++)
      scene
          .getChildAt(n)
          .setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    scene.addView(matchOverlay, new FrameLayout.LayoutParams(F, F));
    LinearLayout sheet = col();
    sheet.setPadding(dp(13), dp(8), dp(9), dp(8));
    GradientDrawable surface =
        new GradientDrawable(
            GradientDrawable.Orientation.TL_BR, new int[] {0xff244336, 0xff0b211b});
    surface.setStroke(dp(1), 0xff698474);
    surface.setCornerRadius(dp(7));
    sheet.setBackground(surface);
    View stripe = new View(this);
    stripe.setBackgroundColor(GOLD);
    block(sheet, stripe, 2);
    int width =
        Math.min(415, Math.max(250, (int) (getResources().getConfiguration().screenWidthDp * .52)));
    FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(width), F, Gravity.RIGHT);
    lp.setMargins(dp(6), dp(6), dp(6), dp(6));
    matchOverlay.addView(sheet, lp);
    LinearLayout heading = row();
    block(sheet, heading, 36);
    cell(heading, text(title, 24, WHITE, true), 2, 35);
    boolean main = title.equals("Kampmenu");
    cell(
        heading,
        button(
            main ? "Luk" : "Tilbage",
            false,
            () -> {
              if (main) closeMatchPanel(true);
              else showMatchPanel("Kampmenu");
            }),
        .8f,
        32);
    block(
        sheet,
        text(
            career.clubName
                + "   "
                + m.goals[0]
                + " – "
                + m.goals[1]
                + "   "
                + career.team(career.opposition())
                + "    ·    "
                + m.clock(),
            14,
            GOLD,
            true),
        24);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(false);
    flex(sheet, scroll, 1);
    LinearLayout content = col();
    scroll.addView(content);
    switch (title) {
      case "Kampmenu":
        ArrayList<String> actions =
            new ArrayList<>(
                Arrays.asList("Kampstatistik", "Kamptidslinje", "Skift kamera", "Lydkontrol"));
        if (career.role == 1) {
          actions.add("Kampplan");
          actions.add("Udskiftning");
        }
        if (!m.manual) actions.add("Hastighed");
        actions.add("Til klubhuset");
        for (int j = 0; j < actions.size(); j += 2) {
          LinearLayout pair = row();
          block(content, pair, 40);
          for (String item : actions.subList(j, Math.min(j + 2, actions.size()))) {
            cell(
                pair,
                button(
                    item,
                    false,
                    () -> {
                      switch (item) {
                        case "Til klubhuset":
                          if (save()) {
                            closeMatchPanel(false);
                            tab = 0;
                            hub();
                          }
                          break;
                        case "Kampplan":
                          plan();
                          break;
                        case "Udskiftning":
                          substitute(true);
                          break;
                        default:
                          showMatchPanel(item);
                      }
                    }),
                1,
                38);
          }
        }
        block(content, text("Seneste hændelse", 14, MUTED, true), 20);
        block(content, text(m.newest(), 18, WHITE, true), 25);
        LinearLayout summary = row();
        block(content, summary, 29);
        cell(summary, text("Skud  " + m.shots[0] + " – " + m.shots[1], 16, GOLD, true), 1, 28);
        cell(
            summary,
            text(
                String.format(Locale.getDefault(), "xG  %.2f – %.2f", m.xg[0], m.xg[1]),
                16,
                WHITE,
                true),
            1.2f,
            28);
        break;
      case "Kampstatistik":
        if (m.partialStats)
          block(
              content,
              text("Kampen er fra TEST75. Nye hændelsestal er delvise.", 14, MUTED, false),
              32);
        int total = m.possession[0] + m.possession[1],
            home = total == 0 ? 0 : Math.round(100f * m.possession[0] / total);
        String[] labels = {
          "Mål",
          "Forventede mål (xG)",
          "Store chancer",
          "Skud",
          "På mål",
          "Boldbesiddelse",
          "Afleveringer",
          "Hjørnespark",
          "Gule kort",
          "Redninger"
        };
        int[][] values = {
          m.goals, null, m.chances, m.shots, m.onTarget, null, m.passes, m.corners, m.cards, m.saves
        };
        for (int j = 0; j < labels.length; j++) {
          String left, right;
          if (j == 1) {
            left = String.format(Locale.getDefault(), "%.2f", m.xg[0]);
            right = String.format(Locale.getDefault(), "%.2f", m.xg[1]);
          } else if (j == 5) {
            left = total == 0 ? "—" : home + " %";
            right = total == 0 ? "—" : (100 - home) + " %";
          } else {
            left = String.valueOf(values[j][0]);
            right = String.valueOf(values[j][1]);
          }
          LinearLayout line = row();
          block(content, line, 22);
          cell(line, text(left, 16, GOLD, true), .5f, 22);
          TextView label = text(labels[j], 15, WHITE, false);
          label.setGravity(Gravity.CENTER);
          cell(line, label, 2, 22);
          TextView value = text(right, 16, WHITE, true);
          value.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
          cell(line, value, .5f, 22);
        }
        break;
      case "Kamptidslinje":
        if (m.log.isEmpty())
          block(content, text("Holdene er klar ved midterlinjen", 16, MUTED, false), 34);
        for (int i = m.log.size() - 1; i >= 0; i--)
          block(content, text(m.log.get(i), 16, WHITE, false), 29);
        break;
      case "Skift kamera":
        for (int i = 0; i < StadiumView.CAMERAS.length; i++) {
          final int selected = i;
          block(
              content,
              button(
                  StadiumView.CAMERAS[i] + (i == career.camera ? "  ✓" : ""),
                  i == career.camera,
                  () -> {
                    career.camera = selected;
                    pitch.setCamera(selected);
                    save();
                    showMatchPanel(title);
                  }),
              38);
        }
        break;
      case "Lydkontrol":
        block(
            content,
            button(
                career.sound ? "Lyd til · slå fra" : "Lyd fra · slå til",
                career.sound,
                () -> {
                  career.sound = !career.sound;
                  if (!career.sound) {
                    sound.autoPause();
                    if (effectStream != 0) sound.stop(effectStream);
                  } else effect(whistle, .55f);
                  save();
                  showMatchPanel(title);
                }),
            40);
        TextView volume =
            text("Stadion, dommer og spark · " + career.volume + " %", 16, WHITE, false);
        block(content, volume, 32);
        SeekBar fader = new SeekBar(this);
        fader.setContentDescription("Lydstyrke");
        fader.setMax(100);
        fader.setProgress(career.volume);
        fader.setOnSeekBarChangeListener(
            new SeekBar.OnSeekBarChangeListener() {
              public void onStartTrackingTouch(SeekBar bar) {}

              public void onProgressChanged(SeekBar bar, int n, boolean user) {
                career.volume = n;
                volume.setText("Stadion, dommer og spark · " + n + " %");
                if (crowdStream != 0) sound.setVolume(crowdStream, level(.17f), level(.17f));
                if (effectStream != 0) sound.setVolume(effectStream, level(.55f), level(.55f));
              }

              public void onStopTrackingTouch(SeekBar bar) {
                effect(kick, .35f);
                save();
              }
            });
        block(content, fader, 42);
        break;
      case "Hastighed":
        for (int speed : new int[] {1, 2, 4})
          block(
              content,
              button(
                  speed + "×",
                  pitch.speed == speed,
                  () -> {
                    pitch.speed = speed;
                    hud();
                    showMatchPanel(title);
                  }),
              38);
        break;
    }
  }

  private void plan() {
    options(
        "Kampplan",
        new String[] {
          "Formation · " + Career.FORMATIONS[career.formation],
          "Preshøjde · " + Career.PRESS[career.press],
          "Mentalitet · " + Career.STYLE[career.mentality]
        },
        n -> {
          String[] list = n == 0 ? Career.FORMATIONS : n == 1 ? Career.PRESS : Career.STYLE;
          options(
              "Vælg " + new String[] {"formation", "preshøjde", "mentalitet"}[n],
              list,
              i -> {
                if (n == 0) career.formation = i;
                else if (n == 1) career.press = i;
                else career.mentality = i;
                if (career.match != null) {
                  career.match.tactics(career.formation, career.press, career.mentality);
                  if (pitch != null) {
                    pitch.invalidate();
                    hud();
                  }
                }
                save();
                if (pitch == null) board();
              });
        });
  }

  private void substitute(boolean live) {
    if (!live && career.match != null) {
      message("Åbn Kampmenu → Udskiftning i den aktive kamp.");
      return;
    }
    String[] out = new String[11];
    for (int i = 0; i < 11; i++) {
      int k = live ? career.match.players[i].shirt - 1 : career.lineup[i];
      out[i] =
          career.name(k)
              + " · "
              + (live ? (int) career.match.players[i].energy : career.fitness[k])
              + " %";
    }
    options(
        "Vælg spiller ud",
        out,
        i -> {
          ArrayList<Integer> indices = new ArrayList<>();
          ArrayList<String> labels = new ArrayList<>();
          for (int k = 0; k < 18; k++) {
            boolean used = starting(k);
            if (live) {
              used = false;
              for (int j = 0; j < 11; j++) if (career.match.players[j].shirt == k + 1) used = true;
            }
            if (used
                || (live && (career.withdrawn & (1 << k)) != 0)
                || career.injury[k] > 0
                || (i == 0) != (k == 0 || k == 11)) continue;
            indices.add(k);
            labels.add(career.name(k) + " · " + career.fitness[k] + " %");
          }
          if (indices.isEmpty()) {
            message("Ingen disponible reserver på positionen.");
            return;
          }
          options(
              "Vælg spiller ind",
              labels.toArray(new String[0]),
              j -> {
                if (career.sub(i, indices.get(j))) {
                  save();
                  if (live) {
                    hud();
                    pitch.invalidate();
                  } else hub();
                } else message("Udskiftningen er ikke mulig.");
              });
        });
  }

  @Override
  protected void onPause() {
    resumeAfterMenu = false;
    pauseMatch();
    if (sound != null) sound.autoPause();
    save();
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    documents.shutdown();
    if (sound != null) sound.release();
    super.onDestroy();
  }

  @Override
  public void onBackPressed() {
    switch (screen) {
      case "match":
        if (matchOverlay == null) matchMenu();
        else if (menuPage.equals("Kampmenu")) closeMatchPanel(true);
        else showMatchPanel("Kampmenu");
        break;
      case "stories":
        chooseRole();
        break;
      case "hub":
        save();
        super.onBackPressed();
        break;
      case "slots":
        if (career != null) {
          tab = 0;
          hub();
        } else chooseRole();
        break;
      default:
        if (career != null) {
          hub();
        } else super.onBackPressed();
    }
  }
}
