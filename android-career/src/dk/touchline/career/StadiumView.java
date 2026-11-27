package dk.touchline.career;

import android.content.Context;
import android.graphics.*;
import android.view.*;

/** Pitch state is interpolated independently of CPU speed and Android refresh cadence. */
final class StadiumView extends View implements Choreographer.FrameCallback {
  interface Listener {
    void hud();

    void checkpoint();

    void whistle(boolean goal);
  }

  private final Motor12 game;
  final Motor12.Input input = new Motor12.Input();
  private final Listener listener;
  private final Bitmap kits, crowd;
  private final BitmapShader turf;
  private final Matrix turfTransform = new Matrix();
  private LinearGradient floodlight;

  @Override
  protected void onSizeChanged(int w, int h, int oldW, int oldH) {
    super.onSizeChanged(w, h, oldW, oldH);
    if (w > 0 && h > 0)
      floodlight =
          new LinearGradient(
              0,
              0,
              w,
              h,
              new int[] {0x2ce1f2c5, 0x00edefd2, 0x0710261c, 0x3110241b},
              new float[] {0f, .35f, .7f, 1f},
              Shader.TileMode.CLAMP);
  }

  static final String[] CAMERAS = {"Broadcast", "Spiller / bold", "Taktisk oversigt", "Målkamera"};
  private int camera;
  private double perspective, tilt, heading;
  private long lastProjection;
  private boolean initialized;

  private float density() {
    return getResources().getDisplayMetrics().density;
  }

  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
  private final Path path = new Path();
  private final Rect src = new Rect();
  private final RectF dst = new RectF();
  private final int[] order = new int[22];
  private final float[] px = new float[22], py = new float[22], height = new float[22];
  private long last, lastHud, lastSave;
  private boolean running, attached, queued;
  private float w, h, focusX, focusY, joyX, joyY, joyR, joyDX, joyDY;
  private int finger = -1, signal;
  private long signalAt;
  private double viewX, viewY, forwardX, forwardY, zoom;
  int speed = 1;

  StadiumView(
      Context ctx, Motor12 game, Bitmap kits, Bitmap grandstand, Bitmap grass, Listener listener) {
    super(ctx);
    this.game = game;
    this.kits = kits;
    this.listener = listener;
    setContentDescription("Fodboldbane og styrepude");
    crowd = grandstand;
    turf = new BitmapShader(grass, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
    for (int i = 0; i < 22; i++) order[i] = i;
    focusX = (float) game.bx;
    focusY = (float) game.by;
  }

  void startPlay() {
    if (game.phase == Motor12.Phase.FULL_TIME || game.awaitingKickoff()) return;
    running = true;
    last = 0;
    game.resetClock();
    schedule();
    listener.hud();
  }

  void pausePlay() {
    running = false;
    last = 0;
    input.clear();
    finger = -1;
    joyDX = joyDY = 0;
    game.resetClock();
    invalidate();
  }

  boolean isPlaying() {
    return running;
  }

  void setCamera(int choice) {
    camera = choice;
    invalidate();
  }

  void action(int cmd) {
    if (running) input.action = cmd;
  }

  private void schedule() {
    if (attached && !queued && running) {
      queued = true;
      Choreographer.getInstance().postFrameCallback(this);
    }
  }

  @Override
  protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    attached = true;
    schedule();
  }

  @Override
  protected void onDetachedFromWindow() {
    attached = false;
    Choreographer.getInstance().removeFrameCallback(this);
    queued = false;
    pausePlay();
    super.onDetachedFromWindow();
  }

  @Override
  public void doFrame(long ns) {
    queued = false;
    if (!attached || !running) return;
    double dt = last == 0 ? 0 : Math.min(.1, (ns - last) / 1e9);
    last = ns;
    Motor12.Phase previous = game.phase;
    int score = game.goals[0] + game.goals[1];
    for (int s = 0; s < speed; s++) game.advance(dt, input);
    if (previous != game.phase
        && (game.phase == Motor12.Phase.FULL_TIME || game.phase == Motor12.Phase.KICKOFF_READY)) {
      signal = game.goals[0] + game.goals[1] > score ? 1 : 2;
      signalAt = ns;
      pausePlay();
      listener.whistle(signal == 1);
      listener.checkpoint();
    }

    if (previous != game.phase || ns - lastHud > 150000000L || !running) {
      listener.hud();
      lastHud = ns;
    }
    if (running && ns - lastSave > 6000000000L) {
      listener.checkpoint();
      lastSave = ns;
    }
    invalidate();
    schedule();
  }

  private void ink(int color) {
    paint.setColor(color);
    paint.setStyle(Paint.Style.FILL);
  }

  private float scale(double x, double y) {
    double depth = (x - viewX) * forwardX + (y - viewY) * forwardY;
    return (float) (zoom / Math.max(.28, 1 + depth * perspective));
  }

  private float x(double x, double y) {
    return (float) (w * .5 + ((x - viewX) * -forwardY + (y - viewY) * forwardX) * scale(x, y));
  }

  private float y(double x, double y, double z) {
    double depth = (x - viewX) * forwardX + (y - viewY) * forwardY;
    return (float) (h * .56 - (depth * tilt + z) * scale(x, y));
  }

  private void poly(
      Canvas c,
      double x1,
      double y1,
      double x2,
      double y2,
      double x3,
      double y3,
      double x4,
      double y4,
      int color) {
    path.rewind();
    path.moveTo(x(x1, y1), y(x1, y1, 0));
    path.lineTo(x(x2, y2), y(x2, y2, 0));
    path.lineTo(x(x3, y3), y(x3, y3, 0));
    path.lineTo(x(x4, y4), y(x4, y4, 0));
    path.close();
    ink(color);
    c.drawPath(path, paint);
  }

  private void line(
      Canvas c,
      double ax,
      double ay,
      double az,
      double bx,
      double by,
      double bz,
      int col,
      float width) {
    ink(col);
    paint.setStrokeWidth(width);
    c.drawLine(x(ax, ay), y(ax, ay, az), x(bx, by), y(bx, by, bz), paint);
  }

  private void line(Canvas c, double ax, double ay, double bx, double by) {
    line(c, ax, ay, 0, bx, by, 0, 0xe1f3f6db, Math.max(1.4f, w / 650));
  }

  private void goal(Canvas c, int d) {
    double g = d * 52.5, back = d * 54.3;
    for (int n = 0; n <= 14; n++) {
      double lane = -3.66 + n * .523;
      line(c, back, lane, 0, back, lane, 2.44, 0x91f5f1de, 1);
      line(c, g, lane, 2.44, back, lane, 2.44, 0x91f5f1de, 1);
    }
    for (int n = 0; n <= 6; n++)
      line(c, back, -3.66, n * .405, back, 3.66, n * .405, 0x91f5f1de, 1);
    for (int s = -1; s <= 1; s += 2) line(c, g, s * 3.66, 0, g, s * 3.66, 2.44, 0xfff7f7ec, 2.5f);
    line(c, g, -3.66, 2.44, g, 3.66, 2.44, 0xfff7f7ec, 2.5f);
  }

  @Override
  protected void onDraw(Canvas c) {
    super.onDraw(c);
    w = getWidth();
    h = getHeight();
    if (w < 1 || h < 1) return;
    boolean setPiece =
        game.phase == Motor12.Phase.RESTART && (game.restartType == 1 || game.restartType == 2);
    boolean behind = camera == 3 || camera == 0 && setPiece;
    updateCamera(behind);

    c.drawColor(0xff152825);
    ink(0xffffffff);
    float edge = y(viewX + forwardX * 64, viewY + forwardY * 64, 0);
    edge = Math.max(h * .09f, Math.min(h * .40f, edge));
    float pan = (float) (viewY * .7 * Math.abs(forwardX) + viewX * 1.4 * Math.abs(forwardY));
    dst.set(-64 - pan, edge - Math.max(h * .44f, edge), w + 64 - pan, edge + 2);
    c.drawBitmap(crowd, null, dst, paint);
    ink(0xff3c7546);
    c.drawRect(0, edge + 1, w, h, paint);
    poly(c, -60, -38, 60, -38, 60, 38, -60, 38, 0xff366844);
    for (int n = 0; n < 14; n++) {
      double a = -52.5 + n * 7.5;
      poly(c, a, -34, a + 7.5, -34, a + 7.5, 34, a, 34, n % 2 == 0 ? 0xff498b46 : 0xff59984e);
    }
    turfTransform.setScale(.52f, .30f);
    turfTransform.postTranslate(x(0, 0) % 100, y(0, 0, 0) % 60);
    turf.setLocalMatrix(turfTransform);
    paint.setShader(turf);
    poly(c, -52.5, -34, 52.5, -34, 52.5, 34, -52.5, 34, 0x42ffffff);
    paint.setShader(null);
    for (int sign = -1; sign <= 1; sign += 2) {
      line(c, -52.5, sign * 34, 52.5, sign * 34);
      line(c, sign * 52.5, -34, sign * 52.5, 34);
      for (int area = 0; area < 2; area++) {
        double gx = sign * 52.5,
            ex = gx - sign * (area == 0 ? 16.5 : 5.5),
            width = area == 0 ? 20.16 : 9.16;
        line(c, gx, -width, ex, -width);
        line(c, ex, -width, ex, width);
        line(c, ex, width, gx, width);
      }
      double spot = sign * 41.5;
      ink(0xffe9f1d5);
      c.drawCircle(x(spot, 0), y(spot, 0, 0), Math.max(1.3f, w * .0018f), paint);
      path.rewind();
      for (int n = 0; n <= 24; n++) {
        double theta = (-.928 + n * .0773),
            ax = spot - sign * 9.15 * Math.cos(theta),
            ay = 9.15 * Math.sin(theta);
        if (n == 0) path.moveTo(x(ax, ay), y(ax, ay, 0));
        else path.lineTo(x(ax, ay), y(ax, ay, 0));
      }
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(Math.max(1.4f, w / 650));
      c.drawPath(path, paint);
      paint.setStyle(Paint.Style.FILL);
      goal(c, sign);
    }
    if (floodlight != null) {
      ink(0xffffffff);
      paint.setShader(floodlight);
      c.drawRect(0, 0, w, h, paint);
      paint.setShader(null);
    }
    line(c, 0, -34, 0, 34);
    path.rewind();
    for (int n = 0; n <= 48; n++) {
      double a = n * Math.PI / 24, xx = Math.cos(a) * 9.15, yy = Math.sin(a) * 9.15;
      if (n == 0) path.moveTo(x(xx, yy), y(xx, yy, 0));
      else path.lineTo(x(xx, yy), y(xx, yy, 0));
    }
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(Math.max(1.4f, w / 650));
    paint.setColor(0xe1f3f6db);
    c.drawPath(path, paint);
    paint.setStyle(Paint.Style.FILL);
    double alpha = running ? game.blend() : 1;
    for (int i = 0; i < 22; i++) {
      Motor12.Player p = game.players[i];
      double ix = p.previousX + (p.x - p.previousX) * alpha,
          iy = p.previousY + (p.y - p.previousY) * alpha;
      px[i] = x(ix, iy);
      py[i] = y(ix, iy, 0);
      height[i] = scale(ix, iy) * 2.05f;
    }
    for (int n = 1; n < 22; n++) {
      int id = order[n], j = n;
      while (j > 0 && py[order[j - 1]] > py[id]) {
        order[j] = order[j - 1];
        j--;
      }
      order[j] = id;
    }
    for (int i : order) {
      float a = px[i], b = py[i], sz = height[i];
      if (a < -sz || a > w + sz) continue;
      Motor12.Player p = game.players[i];
      ink(0x750e231a);
      c.drawOval(a - sz * .25f, b - sz * .07f, a + sz * .32f, b + sz * .09f, paint);
      int facing =
          Math.floorMod(
              (int)
                  Math.round(
                      Math.atan2(
                              Math.cos(p.face) * -forwardY + Math.sin(p.face) * forwardX,
                              -Math.cos(p.face) * forwardX - Math.sin(p.face) * forwardY)
                          / (Math.PI / 4)),
              8);
      int pose = p.delay > .27 ? 7 : Math.hypot(p.vx, p.vy) < .45 ? 0 : 1 + (game.tick / 5 + i) % 6;
      int row = ((i % 11 == 0 ? 2 : i / 11) * 8 + pose) * 80;
      src.set(facing * 80, row, (facing + 1) * 80, row + 80);
      dst.set(a - sz * .55f, b - sz * 1.04f, a + sz * .55f, b + sz * .06f);
      ink(0xffffffff);
      c.drawBitmap(kits, src, dst, paint);
      if (game.manual && game.selected == i) {
        ink(0xffb2ffd0);
        path.rewind();
        path.moveTo(a, b - sz * 1.1f);
        path.lineTo(a - 4, b - sz * 1.1f - 7);
        path.lineTo(a + 4, b - sz * 1.1f - 7);
        path.close();
        c.drawPath(path, paint);
      }
    }
    double ibx = game.previousBallX + (game.bx - game.previousBallX) * alpha,
        iby = game.previousBallY + (game.by - game.previousBallY) * alpha,
        ibz = game.previousBallZ + (game.bz - game.previousBallZ) * alpha;
    float radius = Math.max(2.8f, scale(ibx, iby) * .20f),
        ballX = x(ibx, iby),
        ballY = y(ibx, iby, ibz);
    ink(0x68102116);
    c.drawOval(
        ballX - radius * 1.4f,
        y(game.bx, game.by, 0) - radius * .4f,
        ballX + radius * 1.4f,
        y(game.bx, game.by, 0) + radius * .4f,
        paint);
    ink(0xfffaf3c6);
    c.drawCircle(ballX, ballY, radius, paint);
    ink(0xff323d36);
    c.drawCircle(ballX + .12f * radius, ballY - .18f * radius, radius * .41f, paint);
    if (setPiece && game.manual && game.restartSide == 0) {
      double length = game.restartType == 1 ? Motor12.L - game.bx : 45,
          side = game.restartType == 1 ? input.y * 3.25 - game.by : input.y * 24;
      double norm = Math.max(1, Math.hypot(length, side)),
          ax = game.dir(0) * Math.abs(length) / norm * 3,
          ay = side / norm * 3;
      line(
          c,
          game.bx + ax * .2,
          game.by + ay * .2,
          .06,
          game.bx + ax,
          game.by + ay,
          .06,
          0xe7ffd77c,
          3);
    }
    radar(c);
    if (game.manual) joystick(c);
    if (signal != 0 && (game.awaitingKickoff() || game.phase == Motor12.Phase.FULL_TIME)) {
      long age = System.nanoTime() - signalAt;
      if (signal == 1
          && age >= 0
          && age < 850000000L
          && android.animation.ValueAnimator.areAnimatorsEnabled()) {
        float t = age / 850000000f;
        ink(((int) ((1 - t) * 160) << 24) | 0xf7c462);
        for (int i = 0; i < 18; i++) {
          double angle = i * 2.39996;
          float r = h * (.05f + t * .30f);
          c.drawCircle(
              w * .5f + (float) Math.cos(angle) * r,
              h * .29f + (float) Math.sin(angle) * r,
              1 + 3 * (1 - t),
              paint);
        }
        postInvalidateOnAnimation();
      }
      if (age > 1350000000L && game.phase != Motor12.Phase.FULL_TIME) return;
      if (!running && game.phase != Motor12.Phase.FULL_TIME) postInvalidateOnAnimation();
      ink(0xffefd28a);
      paint.setTextAlign(Paint.Align.CENTER);
      paint.setTypeface(Typeface.DEFAULT_BOLD);
      paint.setTextSize(h * .09f);
      c.drawText(
          signal == 1 ? "MÅL" : game.phase == Motor12.Phase.FULL_TIME ? "SLUTFLØJT" : "HALVLEG",
          w * .5f,
          h * .29f,
          paint);
    }
  }

  // Interpolate all projection parameters, including while the simulation is paused.
  private void updateCamera(boolean behind) {
    long now = System.nanoTime();
    double dt = Math.max(0, Math.min(.08, (now - lastProjection) * 1e-9));
    double ease = initialized ? -Math.expm1(-6.5 * dt) : 1;
    lastProjection = now;
    boolean centre = game.awaitingKickoff() || game.phase == Motor12.Phase.KICKOFF_RUNUP;
    Motor12.Player player = game.players[game.selected];
    int attack =
        game.dir(
            game.phase == Motor12.Phase.RESTART
                ? game.restartSide
                : game.last >= 11 ? 1 : game.last >= 0 ? 0 : game.kickSide);
    double tx = game.bx * .86,
        ty = game.by * .68,
        angle = 0,
        fieldWidth = centre ? 47 : 71,
        depth = .011,
        slope = .54;
    if (behind) {
      angle = attack * Math.PI * .5;
      depth = .045;
      slope = .45;
      fieldWidth = 39;
      tx = game.bx + attack * 5;
      ty = game.by;
    } else if (camera == 1) {
      angle = .16 * game.dir(0);
      fieldWidth = 49;
      depth = .017;
      slope = .57;
      double weight = centre || !game.manual ? 0 : .46;
      tx = (1 - weight) * game.bx + weight * player.x + Motor12.clamp(game.bvx * .28, -5, 5);
      ty = (1 - weight) * game.by + weight * player.y + Motor12.clamp(game.bvy * .22, -4, 4);
    } else if (camera == 2) {
      tx = 0;
      ty = 0;
      fieldWidth = 119;
      depth = .001;
      slope = .86;
    }
    tx = Motor12.clamp(tx, -47, 47);
    ty = Motor12.clamp(ty, -29, 29);
    double scaleGoal =
        camera == 2
            ? Math.min(w / fieldWidth, h / 83.)
            : Math.min(w / fieldWidth, h / (behind ? 24. : 28.));
    double turn = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
    heading += turn * ease;
    forwardX = Math.sin(heading);
    forwardY = -Math.cos(heading);
    viewX += (tx - viewX) * ease;
    viewY += (ty - viewY) * ease;
    zoom += (scaleGoal - zoom) * ease;
    perspective += (depth - perspective) * ease;
    tilt += (slope - tilt) * ease;
    focusX = (float) viewX;
    focusY = (float) viewY;
    initialized = true;
    if (!running
        && (Math.abs(tx - viewX) + Math.abs(ty - viewY) + Math.abs(zoom - scaleGoal) > .025
            || Math.abs(turn) > .001
            || Math.abs(slope - tilt) > .001)) postInvalidateOnAnimation();
  }

  private void radar(Canvas c) {
    float rw = Math.min(w * .19f, h * .34f),
        rh = rw * 68 / 105,
        left = (w - rw) / 2,
        top = h - rh - 33 * density();
    ink(0xe4163129);
    c.drawRoundRect(left - 5, top - 4, left + rw + 5, top + rh + 4, 5, 5, paint);
    ink(0xb9c0d7c8);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(Math.max(1f, rw * .008f));
    c.drawRect(left, top, left + rw, top + rh, paint);
    c.drawLine(w / 2, top, w / 2, top + rh, paint);
    c.drawCircle(w / 2, top + rh * .5f, rw * 9.15f / 105, paint);
    for (int end = 0; end < 2; end++) {
      float line = left + end * rw, dir = end == 0 ? 1 : -1;
      float box = line + dir * rw * .157f;
      c.drawRect(
          Math.min(line, box), top + rh * .204f, Math.max(line, box), top + rh * .796f, paint);
      float goal = line - dir * 3;
      c.drawRect(
          Math.min(line, goal), top + rh * .446f, Math.max(line, goal), top + rh * .554f, paint);
    }
    for (int i = 0; i < 22; i++) {
      Motor12.Player p = game.players[i];
      if (i == game.selected && game.manual) {
        ink(0xffffcf62);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.5f * density());
        c.drawCircle(
            left + (float) ((p.x + 52.5) / 105) * rw,
            top + (float) ((p.y + 34) / 68) * rh,
            Math.max(4, rw * .034f),
            paint);
      }
      ink(i < 11 ? 0xffff7771 : 0xffecf3ef);
      c.drawCircle(
          left + (float) ((p.x + 52.5) / 105) * rw,
          top + (float) ((p.y + 34) / 68) * rh,
          Math.max(1.5f, rw * .015f),
          paint);
    }
    ink(0xffffd260);
    c.drawCircle(
        left + (float) ((game.bx + 52.5) / 105) * rw,
        top + (float) ((game.by + 34) / 68) * rh,
        2.7f,
        paint);
  }

  private void joystick(Canvas c) {
    joyR = Math.min(h * .129f, w * .072f);
    joyX = joyR * 1.55f;
    joyY = h - joyR * 1.48f;
    ink(0x5812271c);
    c.drawCircle(joyX, joyY, joyR, paint);
    paint.setColor(0xb2f0f0df);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(2);
    c.drawCircle(joyX, joyY, joyR, paint);
    paint.setStrokeWidth(1);
    c.drawCircle(joyX, joyY, joyR * .15f, paint);
    ink(0xbaf4f1d9);
    c.drawCircle(joyX + joyDX * joyR * .6f, joyY + joyDY * joyR * .6f, joyR * .38f, paint);
  }

  @Override
  public boolean onTouchEvent(MotionEvent e) {
    if (!game.manual || !running) return false;
    int n = e.getActionIndex(), id = e.getPointerId(n), act = e.getActionMasked();
    if (act == MotionEvent.ACTION_DOWN || act == MotionEvent.ACTION_POINTER_DOWN) {
      if (finger == -1 && Math.hypot(e.getX(n) - joyX, e.getY(n) - joyY) < joyR * 1.65) finger = id;
    }
    if (act == MotionEvent.ACTION_CANCEL
        || ((act == MotionEvent.ACTION_UP || act == MotionEvent.ACTION_POINTER_UP)
            && id == finger)) {
      finger = -1;
      input.x = input.y = joyDX = joyDY = 0;
      return true;
    }
    n = e.findPointerIndex(finger);
    if (n >= 0) {
      float dx = (e.getX(n) - joyX) / joyR, dy = (e.getY(n) - joyY) / joyR;
      float len = (float) Math.hypot(dx, dy);
      float gain = len <= .15f ? 0 : Math.min(1, (len - .15f) / .85f) / len;
      joyDX = dx * gain;
      joyDY = dy * gain;
      input.x = -forwardY * joyDX - forwardX * joyDY;
      input.y = forwardX * joyDX - forwardY * joyDY;
    }
    return true;
  }
}
