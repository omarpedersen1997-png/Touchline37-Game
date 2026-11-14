package dk.touchline.footballidle;

import com.getcapacitor.PluginCall;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/**
 * JVM regression harness around the unmodified production plugin class.
 * Android/Capacitor/vault surfaces are test-only stubs; all HTTPS URLs are
 * intercepted by the JVM URL handler. No real DNS, TLS or network is used.
 */
public final class TouchlineApiBridgeTest {
    private static final String BASE = "https://touchline-idle-club.glowingconch1.chatgpt.site";
    private static final ConcurrentLinkedQueue<Reply> replies = new ConcurrentLinkedQueue<>();
    private static final List<FakeConnection> connections = new ArrayList<>();
    private record Reply(int status, String body, String contentType, String cookie) {}

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private static final class FakeConnection extends HttpsURLConnection {
        final Reply reply;
        final ByteArrayOutputStream sent = new ByteArrayOutputStream();
        final Map<String, String> requestHeaders = new LinkedHashMap<>();
        final CountDownLatch disconnected = new CountDownLatch(1);
        FakeConnection(URL url, Reply reply) { super(url); this.reply = reply; }
        @Override public void setRequestProperty(String name, String value) { requestHeaders.put(name, value); }
        @Override public OutputStream getOutputStream() { return sent; }
        @Override public int getResponseCode() { return reply.status(); }
        @Override public Map<String, List<String>> getHeaderFields() {
            return reply.cookie() == null ? Map.of() : Map.of("sEt-CoOkIe", List.of(reply.cookie()));
        }
        @Override public String getContentType() { return reply.contentType(); }
        @Override public InputStream getInputStream() {
            return new ByteArrayInputStream(reply.body().getBytes(StandardCharsets.UTF_8));
        }
        @Override public InputStream getErrorStream() { return getInputStream(); }
        @Override public void disconnect() { disconnected.countDown(); }
        @Override public boolean usingProxy() { return false; }
        @Override public void connect() { throw new AssertionError("No real connection may be attempted"); }
        @Override public String getCipherSuite() { return "TEST_ONLY_NO_TLS"; }
        @Override public Certificate[] getLocalCertificates() { return null; }
        @Override public Certificate[] getServerCertificates() { return new Certificate[0]; }
        int fixedLength() { return fixedContentLength; }
        void awaitDisconnect() throws Exception {
            check(disconnected.await(5, TimeUnit.SECONDS), "connection must be released in finally");
        }
    }

    private static PluginCall call(TouchlineApiPlugin plugin, String path, String method, String body) throws Exception {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("path", path); values.put("method", method);
        if (body != null) values.put("body", body);
        PluginCall call = new PluginCall(values); plugin.request(call); call.await(); return call;
    }
    private static FakeConnection latest() { return connections.get(connections.size() - 1); }
    private static void assertDenied(TouchlineApiPlugin plugin, String path, String method, String body, String code) throws Exception {
        int before = connections.size();
        PluginCall rejected = call(plugin, path, method, body);
        check(rejected.result == null && rejected.error != null, "request must reject");
        check(code == null || code.equals(rejected.code), "expected rejection code: " + code);
        check(connections.size() == before, "denied request must not open HTTPS");
    }
    private static void assertResolved(PluginCall call, int status, String body) {
        check(call.error == null && call.result != null, "request must resolve, got " + call.error);
        check(Integer.valueOf(status).equals(call.result.get("status")), "response status must round-trip");
        check(body.equals(call.result.get("body")), "response bytes must round-trip as UTF8");
    }

    public static void main(String[] args) throws Exception {
        URL.setURLStreamHandlerFactory(protocol -> "https".equals(protocol) ? new URLStreamHandler() {
            @Override protected URLConnection openConnection(URL url) {
                Reply reply = replies.poll();
                if (reply == null) throw new AssertionError("Unexpected HTTPS request: " + url);
                FakeConnection fake = new FakeConnection(url, reply); connections.add(fake); return fake;
            }
        } : null);
        String packet = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        check(packet.contains("\"type\":\"manual-match-finish\""), "Node must provide a real finish envelope");
        byte[] original = packet.getBytes(StandardCharsets.UTF_8);
        check(original.length > 8192 && original.length < 16384, "fixture reproduces the original 8KiB bridge rejection");
        TouchlineApiPlugin plugin = new TouchlineApiPlugin(); plugin.load();
        try {
            String acknowledgement = "{\"result\":{\"id\":\"bridge-match\",\"home\":5,\"away\":1},\"state\":{\"active\":null}}";
            replies.add(new Reply(200, acknowledgement, "application/json; charset=utf-8", "__Host-touchline=" + "b".repeat(64) + "; Path=/; Secure; Max-Age=3600"));
            PluginCall club = call(plugin, "/api/game", "POST", packet); FakeConnection first = latest(); first.awaitDisconnect();
            assertResolved(club, 200, acknowledgement);
            check(Arrays.equals(original, first.sent.toByteArray()), "native upload must preserve the entire encoded match byte-for-byte");
            check(first.fixedLength() == original.length, "Content-Length must match UTF8 bytes");
            check((BASE + "/api/game").equals(first.getURL().toString()), "fixed API origin/path must remain unchanged");
            check("POST".equals(first.getRequestMethod()), "method must remain POST");
            check("https://localhost".equals(first.requestHeaders.get("Origin")), "native Origin must remain fixed");
            check(("__Host-touchline=" + "a".repeat(64)).equals(first.requestHeaders.get("Cookie")), "existing session cookie must be sent");
            check("TouchlineNativeJvmTest/1.0".equals(first.requestHeaders.get("User-Agent")), "WebView user agent must be sent");
            check("application/json".equals(first.requestHeaders.get("Content-Type")), "JSON content type");
            check("application/json".equals(first.requestHeaders.get("Accept")), "JSON accept header");
            check(!first.getInstanceFollowRedirects(), "redirects must remain disabled");
            check(first.getConnectTimeout() == 15000 && first.getReadTimeout() == 20000, "native timeouts stay bounded");
            check(("__Host-touchline=" + "b".repeat(64)).equals(SessionVault.cookie), "response session rotation must reach the vault");
            check(SessionVault.maxAge == 3600, "session lifetime must be preserved");

            String career = packet.replace("manual-match-finish", "player-career-manual-finish");
            String personalAck = "{\"result\":null,\"state\":{\"playerCareer\":{\"active\":null,\"history\":[{\"id\":\"bridge-match\"}]}}}";
            replies.add(new Reply(200, personalAck, "application/json", null));
            PluginCall personal = call(plugin, "/api/game", "POST", career); FakeConnection second = latest(); second.awaitDisconnect();
            assertResolved(personal, 200, personalAck);
            check(Arrays.equals(career.getBytes(StandardCharsets.UTF_8), second.sent.toByteArray()), "personal recording bytes remain intact");
            check(("__Host-touchline=" + "b".repeat(64)).equals(second.requestHeaders.get("Cookie")), "next request must use rotated cookie");

            assertDenied(plugin, "/api/game", "POST", "x".repeat(16385), "REQUEST_TOO_LARGE");
            assertDenied(plugin, "/api/game", "POST", "\u00e9".repeat(8193), "REQUEST_TOO_LARGE");
            assertDenied(plugin, "/api/auth/login", "POST", "x".repeat(8193), "REQUEST_TOO_LARGE");
            assertDenied(plugin, "/api/contact", "POST", "\u20ac".repeat(2731), "REQUEST_TOO_LARGE");
            assertDenied(plugin, "/api/game", "GET", "x".repeat(8193), "REQUEST_TOO_LARGE");
            for (String path : new String[]{"https://evil.test/api/game", "/api/game?x=1", "/api/game/../contact", "/api/admin"})
                assertDenied(plugin, path, "POST", "{}", null);
            for (String method : new String[]{"PUT", "DELETE", "post"}) assertDenied(plugin, "/api/game", method, "{}", null);

            String serverError = "{\"error\":\"Kampen er ikke færdigspillet endnu.\"}";
            replies.add(new Reply(400, serverError, "application/json", null));
            PluginCall failed = call(plugin, "/api/game", "POST", packet); latest().awaitDisconnect();
            assertResolved(failed, 400, serverError);

            String htmlError = "{\"error\":\"Spilserveren svarer ikke som forventet. Prøv igen om lidt.\"}";
            replies.add(new Reply(200, "<html>not JSON</html>", "text/html", null));
            PluginCall html = call(plugin, "/api/game", "POST", packet); latest().awaitDisconnect();
            assertResolved(html, 503, htmlError);

            replies.add(new Reply(200, "{\"ok\":true}", "application/json", "__Host-touchline=; Path=/; Max-Age=0"));
            PluginCall logout = call(plugin, "/api/auth/logout", "POST", null); FakeConnection last = latest(); last.awaitDisconnect();
            assertResolved(logout, 200, "{\"ok\":true}");
            check(Arrays.equals("{}".getBytes(StandardCharsets.UTF_8), last.sent.toByteArray()), "absent POST body remains an empty JSON object");
            check(SessionVault.cookie == null, "logout must clear native vault");
            check(replies.isEmpty(), "all and only expected network interactions must execute");
            System.out.println("Actual native bridge passed engine8 club/career uploads, response/session round-trip and pre-network limits.");
        } finally { plugin.handleOnDestroy(); }
    }
}
