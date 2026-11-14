package dk.touchline.footballidle;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Owns display changes only while a manual match is mounted and foregrounded. */
@CapacitorPlugin(name = "TouchlineMatchDisplay")
public class TouchlineMatchDisplayPlugin extends Plugin {
    private boolean matchRequested;
    private boolean foreground;
    private boolean applied;
    private boolean captured;
    private int previousOrientation;
    private int previousSystemUi;
    private int previousWindowFlags;
    private int previousBarsBehavior;
    private boolean previousStatusVisible;
    private boolean previousNavigationVisible;

    private final WebViewListener navigationListener = new WebViewListener() {
        @Override public void onPageStarted(WebView webView) { finishMatch(); }
        @Override public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
            finishMatch();
            return false;
        }
    };

    @Override public void load() {
        foreground = getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
        getBridge().addWebViewListener(navigationListener);
    }

    @PluginMethod public void enter(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (!matchRequested) captureDisplay();
                matchRequested = true;
                if (foreground) applyDisplay();
                call.resolve();
            } catch (RuntimeException error) {
                finishMatch();
                call.reject("Kampvisningen kunne ikke åbnes.", error);
            }
        });
    }

    @PluginMethod public void exit(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            finishMatch();
            call.resolve();
        });
    }

    @SuppressWarnings("deprecation")
    private void captureDisplay() {
        Window window = getActivity().getWindow();
        View decor = window.getDecorView();
        previousOrientation = getActivity().getRequestedOrientation();
        previousWindowFlags = window.getAttributes().flags;
        previousSystemUi = decor.getSystemUiVisibility();
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
        previousStatusVisible = insets != null
            ? insets.isVisible(WindowInsetsCompat.Type.statusBars())
            : (previousWindowFlags & WindowManager.LayoutParams.FLAG_FULLSCREEN) == 0
                && (previousSystemUi & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0;
        previousNavigationVisible = insets != null
            ? insets.isVisible(WindowInsetsCompat.Type.navigationBars())
            : (previousSystemUi & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0;
        previousBarsBehavior = WindowCompat.getInsetsController(window, decor).getSystemBarsBehavior();
        captured = true;
    }

    private void applyDisplay() {
        if (!matchRequested || !foreground || !captured) return;
        // Mark first so an exception still restores every state already changed.
        applied = true;
        Window window = getActivity().getWindow();
        getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    @SuppressWarnings("deprecation")
    private void restoreDisplay() {
        if (!applied || !captured) return;
        applied = false;
        Window window = getActivity().getWindow();
        View decor = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
        controller.setSystemBarsBehavior(previousBarsBehavior);
        if (previousStatusVisible) controller.show(WindowInsetsCompat.Type.statusBars());
        else controller.hide(WindowInsetsCompat.Type.statusBars());
        if (previousNavigationVisible) controller.show(WindowInsetsCompat.Type.navigationBars());
        else controller.hide(WindowInsetsCompat.Type.navigationBars());
        // Compat changes these flags on Android 7–10; retain the pre-match values.
        int flags = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_FULLSCREEN
            | WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN;
        window.setFlags(previousWindowFlags, flags);
        decor.setSystemUiVisibility(previousSystemUi);
        getActivity().setRequestedOrientation(previousOrientation);
    }

    private void finishMatch() {
        matchRequested = false;
        restoreDisplay();
        captured = false;
    }

    @Override protected void handleOnResume() {
        foreground = true;
        applyDisplay();
    }

    @Override protected void handleOnPause() {
        foreground = false;
        restoreDisplay();
    }

    @Override protected void handleOnStop() { restoreDisplay(); }

    @Override protected void handleOnConfigurationChanged(Configuration configuration) {
        // Reapply after the landscape resize has completed, including on older Android versions.
        getActivity().getWindow().getDecorView().post(this::applyDisplay);
    }

    @Override protected void handleOnDestroy() {
        finishMatch();
        getBridge().removeWebViewListener(navigationListener);
    }
}
