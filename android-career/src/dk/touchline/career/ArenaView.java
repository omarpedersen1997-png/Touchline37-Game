package dk.touchline.career;

import android.app.Activity;
import android.net.Uri;
import android.webkit.*;
import java.io.ByteArrayInputStream;
import java.io.InputStream;

/** Private, offline graphics surface. Java owns the career, inputs, match and saves. */
final class ArenaView extends WebView {
  interface Host { void frame(); void fallback(); }
  private final Host host;
  boolean ready, suspended, closed;
  private static final String ORIGIN = "https://touchline.invalid";
  ArenaView(Activity activity, Host host) {
    super(activity);
    this.host = host;
    setFocusable(false);
    setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    getSettings().setJavaScriptEnabled(true);
    getSettings().setAllowFileAccess(false);
    getSettings().setAllowContentAccess(false);
    setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String path = uri.getPath();
        if (ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority()) && path!=null && path.matches("/(index\\.html|arena\\.js|player-auto\\.glb|keeper-auto\\.glb|grass-color-1024\\.png|tribune\\.webp)")) {
          try {
            String name=path.substring(1);
            InputStream in = getContext().getAssets().open(name.equals("tribune.webp") ? name : "arena/"+name);
            String mime=name.endsWith(".js")?"application/javascript":name.endsWith(".html")?"text/html":name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":"model/gltf-binary";
            return new WebResourceResponse(mime,null,in);
          } catch(java.io.IOException ignored) { }
        }
        return new WebResourceResponse("text/plain","utf-8",404,"Not found",null,new ByteArrayInputStream(new byte[0]));
      }
    });
    addJavascriptInterface(new Object() {
      @JavascriptInterface public void frame() { post(() -> { if(!closed && !suspended){ ready=true; host.frame(); } }); }
      @JavascriptInterface public void failed() { post(() -> { ready=false; if(!closed) host.fallback(); }); }
    }, "ArenaHost");
    loadUrl(ORIGIN+"/index.html");
  }
  void present(String js) { if (!closed) evaluateJavascript(js,null); }
  void rest(boolean pause) {
    suspended=pause;
    if(pause) { present("window.restArena&&restArena(true)"); onPause(); }
    else { onResume(); present("window.restArena&&restArena(false)"); }
  }
  void closeArena() { closed=true; removeJavascriptInterface("ArenaHost"); destroy(); }
}
