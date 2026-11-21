package dk.touchline.footballidle;
import android.os.Bundle;
import android.content.pm.ActivityInfo;
import android.os.Build;
import android.graphics.Color;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    private TouchlineInsets safeArea;
    @Override public void onCreate(Bundle savedInstanceState) {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        registerPlugin(TouchlineApiPlugin.class);
        registerPlugin(TouchlineMatchDisplayPlugin.class);
        registerPlugin(TouchlineExportPlugin.class);
        super.onCreate(savedInstanceState);
        keepClubhouseColors();
        if (getBridge() != null) safeArea = new TouchlineInsets(getBridge());
    }
    @Override public void onDestroy() {
        if (safeArea != null) safeArea.dispose();
        super.onDestroy();
    }
    @SuppressWarnings("deprecation")
    private void keepClubhouseColors() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.setBackgroundColor(Color.rgb(11, 37, 58));
        WebSettings settings = webView.getSettings();
        if (Build.VERSION.SDK_INT >= 33) {
            settings.setAlgorithmicDarkeningAllowed(false);
        } else if (Build.VERSION.SDK_INT >= 29) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
    }
}
