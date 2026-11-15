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
import org.json.JSONObject;
import org.json.JSONTokener;

@CapacitorPlugin(name = "TouchlineApi")
public class TouchlineApiPlugin extends Plugin {
    // Produktionsvarianterne får produktionsadressen fra BuildConfig (android/app/build.gradle).
    // Testvarianten får sin egen adresse og spærres, hvis den peger på produktionen.
    private static final String API = TouchlineEndpoint.resolve(BuildConfig.TOUCHLINE_API, BuildConfig.TOUCHLINE_TEST_BUILD);
    private static final String COOKIE = "__Host-touchline";
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private SessionVault vault;
    private String userAgent;
    // Accessed only by the single-threaded request queue. Never persisted or shared
    // with the production app: every new plugin instance verifies its own endpoint.
    private boolean testEnvironmentVerified;

    private void verifyTestEnvironment() throws Exception {
        if (!BuildConfig.TOUCHLINE_TEST_BUILD || testEnvironmentVerified) return;
        HttpsURLConnection check = null;
        try {
            check = (HttpsURLConnection) new URL(API + "/api/test-environment").openConnection();
            check.setInstanceFollowRedirects(false);
            check.setConnectTimeout(15000); check.setReadTimeout(20000);
            check.setRequestMethod("GET");
            check.setRequestProperty("Accept", "application/json");
            check.setRequestProperty("User-Agent", userAgent);
            check.setRequestProperty("Origin", "https://localhost");
            check.setRequestProperty("X-Touchline-Test-Engine", "11");
            // No session, authentication header or request body is sent during the
            // handshake. Its Set-Cookie headers must not reach the session vault.
            if (check.getResponseCode() != 200) throw new IllegalStateException("Test handshake status");
            String contentType = check.getContentType();
            if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).split(";", 2)[0].trim().equals("application/json"))
                throw new IllegalStateException("Test handshake content type");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream stream = check.getInputStream()) {
                byte[] chunk = new byte[1024]; int count;
                while ((count = stream.read(chunk)) != -1) {
                    if (bytes.size() + count > 4096) throw new IllegalStateException("Test handshake too large");
                    bytes.write(chunk, 0, count);
                }
            }
            JSONTokener json = new JSONTokener(bytes.toString(StandardCharsets.UTF_8.name()));
            Object parsed = json.nextValue();
            if (!(parsed instanceof JSONObject) || json.nextClean() != 0) throw new IllegalStateException("Test handshake JSON");
            JSONObject result = (JSONObject) parsed;
            if (!Boolean.TRUE.equals(result.opt("isolated")) || !Integer.valueOf(11).equals(result.opt("engine")) ||
                !"touchline37-engine11-test".equals(result.opt("environment")))
                throw new IllegalStateException("Test environment not isolated");
            testEnvironmentVerified = true;
        } finally { if (check != null) check.disconnect(); }
    }
    @Override public void load() { vault = new SessionVault(getContext()); userAgent = WebSettings.getDefaultUserAgent(getContext()); }
    @PluginMethod public void request(PluginCall call) {
        String path = call.getString("path", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body");
        if (!TouchlineRequestPolicy.allowedRoute(path, method)) {
            call.reject("Ukendt apphandling."); return;
        }
        if (API == null) {
            call.reject("Testappen er spærret mod produktionsserveren. Byg den med en separat testserver.", "TEST_ENDPOINT_BLOCKED"); return;
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
                if (BuildConfig.TOUCHLINE_TEST_BUILD) {
                    try { verifyTestEnvironment(); }
                    catch (Exception error) {
                        call.reject("Testmiljøet kunne ikke verificeres. Ingen loginoplysninger eller spilhandlinger er sendt.", "TEST_ENVIRONMENT_UNVERIFIED");
                        return;
                    }
                }
                connection = (HttpsURLConnection) new URL(API + path).openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", userAgent);
                connection.setRequestProperty("Origin", "https://localhost");
                if (BuildConfig.TOUCHLINE_TEST_BUILD) connection.setRequestProperty("X-Touchline-Test-Engine", "11");
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
