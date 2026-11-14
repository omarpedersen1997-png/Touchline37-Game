package dk.touchline.footballidle;

import android.webkit.WebSettings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpCookie;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "TouchlineApi")
public class TouchlineApiPlugin extends Plugin {
    private static final String API = "https://touchline-idle-club.glowingconch1.chatgpt.site";
    private static final String COOKIE = "__Host-touchline";
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private SessionVault vault;
    private String userAgent;
    @Override public void load() { vault = new SessionVault(getContext()); userAgent = WebSettings.getDefaultUserAgent(getContext()); }
    @PluginMethod public void request(PluginCall call) {
        String path = call.getString("path", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body");
        if (!TouchlineRequestPolicy.allowedRoute(path, method)) {
            call.reject("Ukendt apphandling."); return;
        }
        // Every UTF-8 character needs at least one byte. Bound the String
        // before allocating encoded bytes, then enforce the exact byte limit.
        if (body != null && body.length() > TouchlineRequestPolicy.bodyLimit(path, method)) {
            call.reject("Forespørgslen er for stor.", "REQUEST_TOO_LARGE"); return;
        }
        byte[] requestBody = body == null ? null : body.getBytes(StandardCharsets.UTF_8);
        if (!TouchlineRequestPolicy.allowedBody(path, method, requestBody)) {
            call.reject("Forespørgslen er for stor.", "REQUEST_TOO_LARGE"); return;
        }
        queue.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                connection = (HttpsURLConnection) new URL(API + path).openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", userAgent);
                connection.setRequestProperty("Origin", "https://localhost");
                String cookie = vault.read();
                if (cookie != null) connection.setRequestProperty("Cookie", cookie);
                if (method.equals("POST")) {
                    connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                    byte[] data = requestBody == null ? "{}".getBytes(StandardCharsets.UTF_8) : requestBody;
                    connection.setFixedLengthStreamingMode(data.length);
                    try (java.io.OutputStream stream = connection.getOutputStream()) { stream.write(data); }
                }
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) throw new IllegalStateException("Unexpected redirect");
                for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                    if (header.getKey() == null || !header.getKey().equalsIgnoreCase("Set-Cookie")) continue;
                    for (String line : header.getValue()) for (HttpCookie item : HttpCookie.parse(line)) {
                        if (item.getName().equals(COOKIE)) {
                            if (!item.getValue().matches("[a-f0-9]{64}") || item.getMaxAge() == 0) vault.clear();
                            else vault.save(COOKIE + "=" + item.getValue(), Math.min(2592000L, Math.max(0, item.getMaxAge())));
                        }
                    }
                }
                InputStream source = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (source != null) try (InputStream stream = source) {
                    byte[] chunk = new byte[8192]; int count;
                    while ((count = stream.read(chunk)) != -1) { bytes.write(chunk, 0, count); if (bytes.size() > 1048576) throw new IllegalStateException("Response too large"); }
                }
                String content = bytes.toString(StandardCharsets.UTF_8.name());
                String contentType = connection.getContentType();
                if (contentType == null || !contentType.contains("application/json")) {
                    content = "{\"error\":\"Spilserveren svarer ikke som forventet. Prøv igen om lidt.\"}";
                    if (status < 400) status = 503;
                }
                JSObject result = new JSObject(); result.put("status", status); result.put("body", content); call.resolve(result);
            } catch (Exception error) { call.reject("Ingen forbindelse til klubben. Tjek dit internet, og prøv igen."); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }
    @Override protected void handleOnDestroy() { queue.shutdown(); }
}
