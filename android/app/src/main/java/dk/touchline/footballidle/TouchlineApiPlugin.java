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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
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
    // Annullering må ikke stå bag det netværkskald, den skal stoppe.
    private final ExecutorService disconnects = Executors.newSingleThreadExecutor();
    private final Map<String, PendingRequest> identified = new ConcurrentHashMap<>();
    private final Set<PendingRequest> outstanding = ConcurrentHashMap.newKeySet();
    private final ThreadLocal<PendingRequest> running = new ThreadLocal<>();
    private final AtomicBoolean destroyed = new AtomicBoolean();
    private SessionVault vault;
    private String userAgent;
    // Accessed only by the single-threaded request queue. Never persisted or shared
    // with the production app: every new plugin instance verifies its own endpoint.
    private boolean testEnvironmentVerified;

    private static boolean validRequestId(String id) {
        return id != null && id.matches("[A-Za-z0-9:_-]{1,128}");
    }

    @FunctionalInterface private interface SessionUpdate { void run() throws Exception; }

    private final class PendingRequest {
        final PluginCall call;
        final String id;
        final AtomicBoolean terminal = new AtomicBoolean();
        volatile Future<?> future;
        private HttpsURLConnection connection;

        PendingRequest(PluginCall call, String id) { this.call = call; this.id = id; }
        void setFuture(Future<?> value) {
            future = value;
            if (terminal.get()) value.cancel(true);
        }
        void checkActive() throws InterruptedException {
            if (terminal.get() || Thread.currentThread().isInterrupted()) throw new InterruptedException("Request cancelled");
        }
        synchronized void attach(HttpsURLConnection value) throws InterruptedException {
            if (terminal.get() || Thread.currentThread().isInterrupted()) {
                value.disconnect();
                throw new InterruptedException("Request cancelled");
            }
            connection = value;
        }
        void release(HttpsURLConnection value) {
            synchronized (this) { if (connection == value) connection = null; }
            value.disconnect();
        }
        void cleanup() {
            outstanding.remove(this);
            if (id != null) identified.remove(id, this);
        }
        void reject(String message, String code) {
            if (!terminal.compareAndSet(false, true)) return;
            try { call.reject(message, code); } finally { cleanup(); }
        }
        void resolve(JSObject result, SessionUpdate sessionUpdate) {
            if (!terminal.compareAndSet(false, true)) return;
            try {
                // Et sent svar efter annullering må ikke ændre sessionslageret.
                try { sessionUpdate.run(); }
                catch (Exception error) { call.reject("Sessionen kunne ikke gemmes."); return; }
                call.resolve(result);
            } finally { cleanup(); }
        }
        boolean cancel() {
            if (!terminal.compareAndSet(false, true)) return false;
            Future<?> pending = future;
            if (pending != null) pending.cancel(true);
            final HttpsURLConnection active;
            synchronized (this) { active = connection; }
            if (active != null) {
                try { disconnects.execute(active::disconnect); }
                catch (RejectedExecutionException ignored) { active.disconnect(); }
            }
            try { call.reject("Forespørgslen blev afbrudt.", "REQUEST_CANCELLED"); }
            finally { cleanup(); }
            return true;
        }
    }

    private void verifyTestEnvironment() throws Exception {
        if (!BuildConfig.TOUCHLINE_TEST_BUILD || testEnvironmentVerified) return;
        PendingRequest request = running.get();
        HttpsURLConnection check = null;
        try {
            check = (HttpsURLConnection) new URL(API + "/api/test-environment").openConnection();
            request.attach(check);
            check.setInstanceFollowRedirects(false);
            check.setConnectTimeout(15000); check.setReadTimeout(20000);
            check.setRequestMethod("GET");
            check.setRequestProperty("Accept", "application/json");
            check.setRequestProperty("User-Agent", userAgent);
            check.setRequestProperty("Origin", "https://localhost");
            check.setRequestProperty("X-Touchline-Test-Engine", "11");
            check.setRequestProperty("X-Touchline-Test-Engine-Revision", "3");
            // No session, authentication header or request body is sent during the
            // handshake. Its Set-Cookie headers must not reach the session vault.
            if (check.getResponseCode() != 200) throw new IllegalStateException("Test handshake status");
            request.checkActive();
            String contentType = check.getContentType();
            if (contentType == null || !contentType.toLowerCase(java.util.Locale.ROOT).split(";", 2)[0].trim().equals("application/json"))
                throw new IllegalStateException("Test handshake content type");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream stream = check.getInputStream()) {
                byte[] chunk = new byte[1024]; int count;
                while ((count = stream.read(chunk)) != -1) {
                    request.checkActive();
                    if (bytes.size() + count > 4096) throw new IllegalStateException("Test handshake too large");
                    bytes.write(chunk, 0, count);
                }
            }
            JSONTokener json = new JSONTokener(bytes.toString(StandardCharsets.UTF_8.name()));
            Object parsed = json.nextValue();
            if (!(parsed instanceof JSONObject) || json.nextClean() != 0) throw new IllegalStateException("Test handshake JSON");
            JSONObject result = (JSONObject) parsed;
            if (!Boolean.TRUE.equals(result.opt("isolated")) || !Integer.valueOf(11).equals(result.opt("engine")) ||
                !"touchline37-engine11-test".equals(result.opt("environment")) ||
                !Integer.valueOf(3).equals(result.opt("engineRevision")))
                throw new IllegalStateException("Test environment not isolated");
            request.checkActive();
            testEnvironmentVerified = true;
        } finally { if (check != null) request.release(check); }
    }
    @Override public void load() { vault = new SessionVault(getContext()); userAgent = WebSettings.getDefaultUserAgent(getContext()); }
    @PluginMethod public void cancel(PluginCall call) {
        String id = call.getString("requestId");
        if (!validRequestId(id)) { call.reject("Ukendt forespørgsel.", "REQUEST_ID_INVALID"); return; }
        PendingRequest request = identified.get(id);
        JSObject result = new JSObject();
        result.put("cancelled", request != null && request.cancel());
        call.resolve(result);
    }
    @PluginMethod public void request(PluginCall call) {
        String path = call.getString("path", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body");
        String requestId = call.getString("requestId");
        if (requestId != null && !validRequestId(requestId)) {
            call.reject("Ukendt forespørgsel.", "REQUEST_ID_INVALID"); return;
        }
        if (destroyed.get()) { call.reject("Forbindelsen er lukket.", "REQUEST_CANCELLED"); return; }
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
        PendingRequest pending = new PendingRequest(call, requestId);
        if (requestId != null && identified.putIfAbsent(requestId, pending) != null) {
            call.reject("Forespørgslen findes allerede.", "REQUEST_ID_DUPLICATE"); return;
        }
        outstanding.add(pending);
        if (destroyed.get()) { pending.cancel(); return; }
        try { pending.setFuture(queue.submit(() -> {
            running.set(pending);
            HttpsURLConnection connection = null;
            try {
                pending.checkActive();
                if (BuildConfig.TOUCHLINE_TEST_BUILD) {
                    try { verifyTestEnvironment(); }
                    catch (Exception error) {
                        pending.reject("Testmiljøet kunne ikke verificeres. Ingen loginoplysninger eller spilhandlinger er sendt.", "TEST_ENVIRONMENT_UNVERIFIED");
                        return;
                    }
                }
                pending.checkActive();
                connection = (HttpsURLConnection) new URL(API + path).openConnection();
                pending.attach(connection);
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", userAgent);
                connection.setRequestProperty("Origin", "https://localhost");
                if (BuildConfig.TOUCHLINE_TEST_BUILD) connection.setRequestProperty("X-Touchline-Test-Engine", "11");
                if (BuildConfig.TOUCHLINE_TEST_BUILD) connection.setRequestProperty("X-Touchline-Test-Engine-Revision", "3");
                String cookie = vault.read();
                if (cookie != null) connection.setRequestProperty("Cookie", cookie);
                if (method.equals("POST")) {
                    pending.checkActive();
                    connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                    byte[] data = requestBody == null ? "{}".getBytes(StandardCharsets.UTF_8) : requestBody;
                    connection.setFixedLengthStreamingMode(data.length);
                    try (java.io.OutputStream stream = connection.getOutputStream()) { stream.write(data); }
                }
                int status = connection.getResponseCode();
                pending.checkActive();
                if (status >= 300 && status < 400) throw new IllegalStateException("Unexpected redirect");
                String nextCookie = null;
                long nextAge = 0;
                boolean updateCookie = false;
                for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                    if (header.getKey() == null || !header.getKey().equalsIgnoreCase("Set-Cookie")) continue;
                    for (String line : header.getValue()) for (HttpCookie item : HttpCookie.parse(line)) {
                        if (item.getName().equals(COOKIE)) {
                            updateCookie = true;
                            nextCookie = !item.getValue().matches("[a-f0-9]{64}") || item.getMaxAge() == 0 ? null : COOKIE + "=" + item.getValue();
                            nextAge = Math.min(2592000L, Math.max(0, item.getMaxAge()));
                        }
                    }
                }
                InputStream source = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (source != null) try (InputStream stream = source) {
                    byte[] chunk = new byte[8192]; int count;
                    while ((count = stream.read(chunk)) != -1) { pending.checkActive(); bytes.write(chunk, 0, count); if (bytes.size() > 1048576) throw new IllegalStateException("Response too large"); }
                }
                String content = bytes.toString(StandardCharsets.UTF_8.name());
                String contentType = connection.getContentType();
                if (contentType == null || !contentType.contains("application/json")) {
                    content = "{\"error\":\"Spilserveren svarer ikke som forventet. Prøv igen om lidt.\"}";
                    if (status < 400) status = 503;
                }
                final boolean shouldUpdate = updateCookie;
                final String cookieValue = nextCookie;
                final long cookieAge = nextAge;
                JSObject result = new JSObject(); result.put("status", status); result.put("body", content);
                pending.resolve(result, () -> { if (shouldUpdate) { if (cookieValue == null) vault.clear(); else vault.save(cookieValue, cookieAge); } });
            } catch (Exception error) { pending.reject("Ingen forbindelse til klubben. Tjek dit internet, og prøv igen.", null); }
            finally { if (connection != null) pending.release(connection); running.remove(); }
        })); } catch (RejectedExecutionException error) { pending.reject("Forbindelsen er lukket.", "REQUEST_CANCELLED"); }
    }
    @Override protected void handleOnDestroy() {
        destroyed.set(true);
        for (PendingRequest request : outstanding) request.cancel();
        queue.shutdownNow(); disconnects.shutdown();
    }
}
