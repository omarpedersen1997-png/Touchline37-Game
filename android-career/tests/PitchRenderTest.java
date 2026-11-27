package dk.touchline.career;

import static org.junit.Assert.*;

import android.graphics.*;
import android.view.*;
import java.io.*;
import java.lang.reflect.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(
    sdk = 34,
    manifest = Config.NONE,
    qualifiers = "w844dp-h390dp-land-mdpi",
    application = AndroidFlowTest.Assets.class)
public class PitchRenderTest {
  static void draw(TouchlineActivity a, String name) throws Exception {
    View v = a.findViewById(android.R.id.content);
    v.measure(
        View.MeasureSpec.makeMeasureSpec(844, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(390, View.MeasureSpec.EXACTLY));
    v.layout(0, 0, 844, 390);
    FrameLayoutAccess.finishTransition(v);
    Bitmap image = Bitmap.createBitmap(844, 390, Bitmap.Config.ARGB_8888);
    v.draw(new Canvas(image));
    java.util.HashSet<Integer> colors = new java.util.HashSet<>();
    for (int y = 5; y < 390; y += 11)
      for (int x = 5; x < 844; x += 13) colors.add(image.getPixel(x, y));
    assertTrue("Synlige grafikdetaljer", colors.size() > 35);
    String dir = System.getProperty("touchline.capture");
    if (dir != null)
      try (OutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
        assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, out));
      }
  }

  static class FrameLayoutAccess {
    static void finishTransition(View v) {
      v.animate().cancel();
      v.setTranslationX(0);
      v.setAlpha(1);
      if (v instanceof ViewGroup) {
        ViewGroup g = (ViewGroup) v;
        for (int i = 0; i < g.getChildCount(); i++) finishTransition(g.getChildAt(i));
      }
    }
  }

  static <T> T find(View v, Class<T> clazz) {
    if (clazz.isInstance(v)) return clazz.cast(v);
    if (v instanceof ViewGroup) {
      ViewGroup g = (ViewGroup) v;
      for (int i = 0; i < g.getChildCount(); i++) {
        T hit = find(g.getChildAt(i), clazz);
        if (hit != null) return hit;
      }
    }
    return null;
  }

  private static void touch(
      View root, long down, long now, int action, int n, float[] xs, float[] ys) {
    MotionEvent.PointerProperties[] props = new MotionEvent.PointerProperties[n];
    MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[n];
    for (int i = 0; i < n; i++) {
      props[i] = new MotionEvent.PointerProperties();
      props[i].id = 2 + i;
      props[i].toolType = MotionEvent.TOOL_TYPE_FINGER;
      coords[i] = new MotionEvent.PointerCoords();
      coords[i].x = xs[i];
      coords[i].y = ys[i];
      coords[i].pressure = 1;
      coords[i].size = 1;
    }
    MotionEvent event =
        MotionEvent.obtain(
            down,
            now,
            action,
            n,
            props,
            coords,
            0,
            0,
            1,
            1,
            0,
            0,
            InputDevice.SOURCE_TOUCHSCREEN,
            0);
    try {
      assertTrue(root.dispatchTouchEvent(event));
    } finally {
      event.recycle();
    }
  }

  @Test
  public void nativeFreeKickAndGoalKick() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    AndroidFlowTest.click(a, "Vælg trænerkarriere");
    AndroidFlowTest.click(a, "Start karriere");
    AndroidFlowTest.click(a, "Træning");
    for (int i = 0; i < 2; i++) {
      AndroidFlowTest.click(a, "Dødboldstræning");
      android.app.AlertDialog pick =
          org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();
      pick.getListView().performItemClick(null, i, i);
      draw(a, i == 0 ? "Touchline-Frispark-TEST76" : "Touchline-Maalspark-TEST76");
      AndroidFlowTest.click(a, i == 0 ? "A\nSkyd" : "A\nLangt");
      StadiumView pitch = find(a.getWindow().getDecorView(), StadiumView.class);
      for (int f = 0; f < 24; f++) pitch.doFrame(1000000000L + f * 16666667L);
      assertEquals(0, pitch.input.action);
      assertNull(new Slots(a).load(0).match);
      AndroidFlowTest.click(a, "Kampmenu");
      android.app.AlertDialog menu =
          org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();
      menu.getListView().performItemClick(null, 2, 2);
    }
    ctl.pause().stop().destroy();
  }

  @Test
  public void goalAndHalfWaitForButtonOnPitch() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    AndroidFlowTest.click(a, "Vælg trænerkarriere");
    AndroidFlowTest.click(a, "Start karriere");
    AndroidFlowTest.click(a, "Spil selv");
    AndroidFlowTest.click(a, "KICK OFF");
    StadiumView pitch = find(a.getWindow().getDecorView(), StadiumView.class);
    java.lang.reflect.Field field = StadiumView.class.getDeclaredField("game");
    field.setAccessible(true);
    Motor12 m = (Motor12) field.get(pitch);
    long ns = 1000000000L;
    for (int i = 0; i < 32; i++) pitch.doFrame(ns += 16666667L);
    m.owner = -1;
    m.last = 9;
    m.bx = 52.49;
    m.by = 0;
    m.bz = .45;
    m.bvx = 25;
    m.bvy = 0;
    m.bvz = 0;
    pitch.doFrame(ns += 16666667L);
    assertEquals(1, m.goals[0]);
    assertFalse(pitch.isPlaying());
    AndroidFlowTest.get(a, "KICK OFF");
    int stopped = m.tick;
    pitch.doFrame(ns += 10000000000L);
    assertEquals(stopped, m.tick);
    assertEquals(0, m.bx, 0);
    AndroidFlowTest.click(a, "KICK OFF");
    for (int i = 0; i < 32; i++) pitch.doFrame(ns += 16666667L);
    m.tick = Motor12.HALF - 1;
    pitch.doFrame(ns += 16666667L);
    assertFalse(pitch.isPlaying());
    assertEquals("45:00", m.clock());
    AndroidFlowTest.get(a, "KICK OFF");
    ctl.pause().stop().destroy();
  }

  @Test
  public void fourCameraProjectionsKeepFocusOnPitch() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    AndroidFlowTest.click(a, "Vælg trænerkarriere");
    AndroidFlowTest.click(a, "Start karriere");
    AndroidFlowTest.click(a, "Spil selv");
    StadiumView p = find(a.getWindow().getDecorView(), StadiumView.class);
    p.layout(0, 0, 844, 390);
    Bitmap bitmap = Bitmap.createBitmap(844, 390, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(bitmap);
    Field time = StadiumView.class.getDeclaredField("lastProjection");
    time.setAccessible(true);
    Field zoom = StadiumView.class.getDeclaredField("zoom");
    zoom.setAccessible(true);
    Field heading = StadiumView.class.getDeclaredField("heading");
    heading.setAccessible(true);
    Method project = StadiumView.class.getDeclaredMethod("x", double.class, double.class);
    project.setAccessible(true);
    p.draw(canvas);
    double broadcast = zoom.getDouble(p);
    java.util.Set<String> signatures = new java.util.HashSet<>();
    for (int i = 0; i < 4; i++) {
      p.setCamera(i);
      for (int j = 0; j < 25; j++) {
        time.setLong(p, System.nanoTime() - 50000000);
        p.draw(canvas);
      }
      float cx = (float) project.invoke(p, 0., 0.);
      assertTrue(cx > 100 && cx < 744);
      signatures.add(
          Math.round(zoom.getDouble(p) * 100) + "/" + Math.round(heading.getDouble(p) * 100));
      if (i == 2) assertTrue(zoom.getDouble(p) < broadcast * .62);
    }
    assertEquals(4, signatures.size());
    assertEquals(0, new Slots(a).load(0).match.tick);
    ctl.pause().stop().destroy();
  }

  @Test
  public void nativeMatchPixelsAndTouch() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    draw(a, "Touchline-Karriere-TEST76");
    AndroidFlowTest.click(a, "Vælg spillerkarriere");
    AndroidFlowTest.click(a, "Start karriere");
    AndroidFlowTest.click(a, "Spil selv");
    AndroidFlowTest.selectControl(false);
    draw(a, "Touchline-Afspark-TEST76");
    AndroidFlowTest.click(a, "KICK OFF");
    StadiumView pitch = find(a.getWindow().getDecorView(), StadiumView.class);
    assertNotNull(pitch);
    long t = android.os.SystemClock.uptimeMillis();
    ViewGroup scene = (ViewGroup) pitch.getParent();
    View sprint = AndroidFlowTest.get(a, "Sprint"), shoot = AndroidFlowTest.get(a, "A\nSkyd");
    float sx = sprint.getLeft() + sprint.getWidth() / 2f,
        sy = sprint.getTop() + sprint.getHeight() / 2f;
    float ax = shoot.getLeft() + shoot.getWidth() / 2f,
        ay = shoot.getTop() + shoot.getHeight() / 2f;
    float radius = Math.min(pitch.getHeight() * .129f, pitch.getWidth() * .072f);
    float jx = radius * 1.55f, jy = pitch.getHeight() - radius * 1.48f;
    float[] xs = {jx + radius * .07f, sx, ax}, ys = {jy, sy, ay};
    touch(scene, t, t, MotionEvent.ACTION_DOWN, 1, xs, ys);
    assertEquals(0, pitch.input.x, 0);
    xs[0] = jx + radius * .8f;
    touch(scene, t, t + 20, MotionEvent.ACTION_MOVE, 1, xs, ys);
    assertTrue(pitch.input.x > .65);
    touch(scene, t, t + 30, MotionEvent.ACTION_POINTER_DOWN | (1 << 8), 2, xs, ys);
    assertTrue(pitch.input.sprint && sprint.isPressed());
    touch(scene, t, t + 55, MotionEvent.ACTION_POINTER_DOWN | (2 << 8), 3, xs, ys);
    assertTrue(shoot.isPressed());
    touch(scene, t, t + 640, MotionEvent.ACTION_POINTER_UP | (2 << 8), 3, xs, ys);
    assertEquals(Motor12.SHOOT, pitch.input.action);
    assertTrue(pitch.input.power > .8 && pitch.input.sprint && pitch.input.x > .65);
    touch(scene, t, t + 660, MotionEvent.ACTION_POINTER_UP | (1 << 8), 2, xs, ys);
    assertFalse(pitch.input.sprint);
    touch(scene, t, t + 680, MotionEvent.ACTION_UP, 1, xs, ys);
    assertEquals(0, pitch.input.x, 0);
    AndroidFlowTest.click(a, "C\nStikning");
    assertEquals(Motor12.THROUGH, pitch.input.action);
    for (int i = 0; i < 55; i++) pitch.doFrame(1000000000L + i * 16666667L);
    draw(a, "Touchline-Kamp-TEST76");
    AndroidFlowTest.click(a, "Kampmenu");
    draw(a, "Touchline-Kampmenu-TEST76");
    AndroidFlowTest.click(a, "Skift kamera");
    AndroidFlowTest.click(a, "Taktisk oversigt");
    AndroidFlowTest.click(a, "Tilbage");
    AndroidFlowTest.click(a, "Luk");
    // Render the settled saved camera through a fresh view, as on a process restart.
    ctl.pause().stop().destroy();
    ctl = Robolectric.buildActivity(TouchlineActivity.class).setup();
    a = ctl.get();
    draw(a, "Touchline-Taktisk-TEST76");
    ctl.pause().stop().destroy();
  }
}
