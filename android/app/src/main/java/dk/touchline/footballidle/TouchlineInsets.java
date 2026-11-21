package dk.touchline.footballidle;

import android.view.View;
import android.view.ViewTreeObserver;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;

/** Publish only system insets overlapping the WebView; do not double-pad a
 * WebView which Android has already placed below the status/navigation bars. */
final class TouchlineInsets {
    private final Bridge bridge;
    private final WebView web;
    private final View decor;
    private final int[] webPosition = new int[2], decorPosition = new int[2];
    private String previous = "";
    private boolean disposed;
    private final ViewTreeObserver.OnGlobalLayoutListener layout = this::publish;
    private final WebViewListener pages = new WebViewListener() {
        @Override public void onPageLoaded(WebView view) { previous = ""; publish(); }
    };
    TouchlineInsets(Bridge bridge) {
        this.bridge = bridge; web = bridge.getWebView(); decor = web.getRootView();
        decor.getViewTreeObserver().addOnGlobalLayoutListener(layout);
        bridge.addWebViewListener(pages); web.post(this::publish);
    }
    private void publish() {
        if (disposed) return;
        WindowInsetsCompat root = ViewCompat.getRootWindowInsets(web);
        if (root == null || web.getWidth() == 0 || decor.getWidth() == 0) return;
        Insets insets = root.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        web.getLocationOnScreen(webPosition); decor.getLocationOnScreen(decorPosition);
        int left = webPosition[0] - decorPosition[0], top = webPosition[1] - decorPosition[1];
        float density = web.getResources().getDisplayMetrics().density;
        int[] values = {
            Math.max(0, insets.top - top),
            Math.max(0, insets.right - (decor.getWidth() - left - web.getWidth())),
            Math.max(0, insets.bottom - (decor.getHeight() - top - web.getHeight())),
            Math.max(0, insets.left - left)
        };
        String[] sides = {"top", "right", "bottom", "left"};
        StringBuilder js = new StringBuilder("(function(){const s=document.documentElement.style;");
        for (int i = 0; i < 4; i++) js.append("s.setProperty('--tl-native-safe-").append(sides[i]).append("','").append(Math.round(values[i] / density)).append("px');");
        js.append("})()");
        String script = js.toString(); if (script.equals(previous)) return;
        previous = script; web.evaluateJavascript(script, null);
    }
    void dispose() {
        disposed = true;
        if (decor.getViewTreeObserver().isAlive()) decor.getViewTreeObserver().removeOnGlobalLayoutListener(layout);
        bridge.removeWebViewListener(pages);
    }
}
