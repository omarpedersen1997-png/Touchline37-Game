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
      draw(a, i == 0 ? "Touchline-Frispark-TEST75" : "Touchline-Maalspark-TEST75");
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
  public void nativeMatchPixelsAndTouch() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    draw(a, "Touchline-Karriere-TEST75");
    AndroidFlowTest.click(a, "Vælg spillerkarriere");
    AndroidFlowTest.click(a, "Start karriere");
    AndroidFlowTest.click(a, "Spil selv");
    draw(a, "Touchline-Afspark-TEST75");
    AndroidFlowTest.click(a, "KICK OFF");
    StadiumView pitch = find(a.getWindow().getDecorView(), StadiumView.class);
    assertNotNull(pitch);
    long t = android.os.SystemClock.uptimeMillis();
    MotionEvent e = MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, 95, 310, 0);
    pitch.dispatchTouchEvent(e);
    e.recycle();
    assertTrue(Math.abs(pitch.input.x) + Math.abs(pitch.input.y) > .12);
    AndroidFlowTest.click(a, "C\nStikning");
    assertEquals(Motor12.THROUGH, pitch.input.action);
    for (int i = 0; i < 55; i++) pitch.doFrame(1000000000L + i * 16666667L);
    draw(a, "Touchline-Kamp-TEST75");
    ctl.pause().stop().destroy();
  }
}
