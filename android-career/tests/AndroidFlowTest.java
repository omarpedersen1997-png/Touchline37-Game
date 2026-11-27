package dk.touchline.career;

import static org.junit.Assert.*;

import android.app.Application;
import android.content.res.AssetManager;
import android.view.*;
import android.widget.*;
import java.lang.reflect.Method;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(
    sdk = {28, 34},
    manifest = Config.NONE,
    qualifiers = "w844dp-h390dp-land",
    application = AndroidFlowTest.Assets.class)
public class AndroidFlowTest {
  public static class Assets extends Application {
    @Override
    public void onCreate() {
      super.onCreate();
      try {
        Method add = AssetManager.class.getMethod("addAssetPath", String.class);
        assertTrue((Integer) add.invoke(getAssets(), System.getProperty("touchline.apk")) > 0);
      } catch (Exception ex) {
        throw new AssertionError(ex);
      }
    }
  }

  static TextView find(View v, String label) {
    if (v instanceof TextView && label.contentEquals(((TextView) v).getText())) return (TextView) v;
    if (v instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) v;
      for (int i = 0; i < group.getChildCount(); i++) {
        TextView hit = find(group.getChildAt(i), label);
        if (hit != null) return hit;
      }
    }
    return null;
  }

  static TextView get(TouchlineActivity a, String s) {
    TextView v = find(a.getWindow().getDecorView(), s);
    assertNotNull(s, v);
    return v;
  }

  static void click(TouchlineActivity a, String s) {
    assertTrue(get(a, s).performClick());
  }

  static void selectControl(boolean personal) {
    android.app.AlertDialog pick = org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();
    pick.getButton(
            personal
                ? android.content.DialogInterface.BUTTON_POSITIVE
                : android.content.DialogInterface.BUTTON_NEGATIVE)
        .performClick();
    org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
  }

  @Test
  public void settingsAndWholeTeamSurviveReopening() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    click(a, "Vælg spillerkarriere");
    click(a, "Start karriere");
    click(a, "Spil selv");
    selectControl(false);
    Slots slots = new Slots(a);
    assertEquals(-1, slots.load(0).match.locked);
    click(a, "Kampmenu");
    click(a, "Kampstatistik");
    get(a, "På mål");
    get(a, "Hjørnespark");
    click(a, "Tilbage");
    click(a, "Kamptidslinje");
    click(a, "Tilbage");
    click(a, "Skift kamera");
    click(a, "Taktisk oversigt");
    get(a, "Taktisk oversigt  ✓");
    click(a, "Tilbage");
    click(a, "Lydkontrol");
    click(a, "Lyd fra · slå til");
    SeekBar volume = PitchRenderTest.find(a.getWindow().getDecorView(), SeekBar.class);
    assertNotNull(volume);
    volume.setProgress(37);
    click(a, "Tilbage");
    click(a, "Til klubhuset");
    click(a, "Fortsæt kampen");
    get(a, "KICK OFF");
    ctl.pause().stop().destroy();
    Career state = slots.load(0);
    assertTrue(state.sound);
    assertEquals(2, state.camera);
    assertEquals(37, state.volume);
    assertEquals(0, state.match.tick);
  }

  static void idleUntil(java.util.function.BooleanSupplier done) throws Exception {
    for (int i = 0; i < 120; i++) {
      org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
      if (done.getAsBoolean()) return;
      Thread.sleep(10);
    }
    fail("Dokumentarbejdet afsluttede ikke");
  }

  @Test
  public void documentBackupUsesAnEmptySlot() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    click(a, "Vælg trænerkarriere");
    click(a, "Start karriere");
    Slots slots = new Slots(a);
    String id = slots.load(0).id;
    android.net.Uri uri = android.net.Uri.parse("content://test.provider/karriere");
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    org.robolectric.Shadows.shadowOf(a.getContentResolver()).registerOutputStream(uri, out);
    a.onActivityResult(41, -1, new android.content.Intent().setData(uri));
    idleUntil(() -> out.size() > 0);
    assertEquals(id, SaveFormat.decode(new java.io.ByteArrayInputStream(out.toByteArray())).id);
    org.robolectric.Shadows.shadowOf(a.getContentResolver())
        .registerInputStream(uri, new java.io.ByteArrayInputStream(out.toByteArray()));
    a.onActivityResult(42, -1, new android.content.Intent().setData(uri));
    idleUntil(() -> slots.exists(1));
    assertEquals(id, slots.load(0).id);
    assertEquals(id, slots.load(1).id);
    assertEquals(0, slots.active());
    ctl.pause().stop().destroy();
  }

  @Test
  public void playerOfflineToPitchAndProcessRestart() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    click(a, "Vælg spillerkarriere");
    click(a, "Landets stortalent");
    click(a, "Start karriere");
    Slots files = new Slots(a);
    assertEquals(1, files.free());
    assertEquals(2, files.load(0).story);
    click(a, "Spil selv");
    org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog().cancel();
    assertNull(files.load(0).match);
    click(a, "Spil selv");
    selectControl(true);
    assertTrue(files.load(0).match.locked >= 0);
    assertEquals("00:00", files.load(0).match.clock());
    get(a, "KICK OFF");
    get(a, "A\nSkyd");
    get(a, "B\nAflever");
    click(a, "KICK OFF");
    get(a, "Pause");
    assertEquals(Motor12.Phase.KICKOFF_RUNUP, files.load(0).match.phase);
    ctl.pause();
    get(a, "Genoptag");
    ctl.stop().destroy();
    ActivityController<TouchlineActivity> again =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    get(again.get(), "Genoptag");
    get(again.get(), "Kampmenu");
    again.pause().stop().destroy();
  }

  @Test
  public void managerSimulationAndTraining() throws Exception {
    ActivityController<TouchlineActivity> ctl =
        Robolectric.buildActivity(TouchlineActivity.class).setup();
    TouchlineActivity a = ctl.get();
    click(a, "Vælg trænerkarriere");
    click(a, "Redningsmanden");
    click(a, "Start karriere");
    click(a, "Træning");
    click(a, "Teknik");
    assertEquals(1, new Slots(a).load(0).trainingSessions);
    click(a, "Kampdag");
    click(a, "Simulér kampen");
    get(a, "KICK OFF");
    assertNull(find(a.getWindow().getDecorView(), "A\nSkyd"));
    click(a, "KICK OFF");
    assertFalse(new Slots(a).load(0).match.manual);
    ctl.pause().stop().destroy();
  }
}
