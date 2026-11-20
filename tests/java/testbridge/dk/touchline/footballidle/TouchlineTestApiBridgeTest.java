package dk.touchline.footballidle;

import com.getcapacitor.PluginCall;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/** Real native plugin and JSON parser; HTTPS is fully intercepted, never networked. */
public final class TouchlineTestApiBridgeTest {
    private static final String BASE = "https://touchline37-engine11-test.glowingconch1.chatgpt.site";
    private static final String ENVIRONMENT = "{\"isolated\":true,\"engine\":11,\"engineRevision\":2,\"environment\":\"touchline37-engine11-test\"}";
    private static final String SESSION = "__Host-touchline=" + "a".repeat(64);
    private static final String LOGIN = "{\"email\":\"test1@touchline.invalid\",\"password\":\"only-local-fixture\"}";
    private static final ConcurrentLinkedQueue<Reply> replies = new ConcurrentLinkedQueue<>();
    private static final List<FakeConnection> connections = new CopyOnWriteArrayList<>();
    private record Reply(int status, String body, String type) {}

    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    private static final class FakeConnection extends HttpsURLConnection {
        final Reply reply;
        final ByteArrayOutputStream sent = new ByteArrayOutputStream();
        final Map<String, String> headers = new java.util.LinkedHashMap<>();
        final CountDownLatch disconnected = new CountDownLatch(1);
        FakeConnection(URL url, Reply reply) { super(url); this.reply = reply; }
        @Override public void setRequestProperty(String name, String value) { headers.put(name, value); }
        @Override public OutputStream getOutputStream() { return sent; }
        @Override public int getResponseCode() throws IOException {
            if (reply.status() == -1) throw new IOException("Simulated connection failure");
            return reply.status();
        }
        @Override public Map<String, List<String>> getHeaderFields() {
            // A handshake must never accept cookies or follow this redirect.
            return Map.of("Set-Cookie", List.of("__Host-touchline=" + "b".repeat(64) + "; Max-Age=3600"),
                "Location", List.of("https://playtouchline.dk/api/auth/login"));
        }
        @Override public String getContentType() { return reply.type(); }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(reply.body().getBytes(StandardCharsets.UTF_8)); }
        @Override public InputStream getErrorStream() { return getInputStream(); }
        @Override public void disconnect() { disconnected.countDown(); }
        @Override public boolean usingProxy() { return false; }
        @Override public void connect() { throw new AssertionError("No real network allowed"); }
        @Override public String getCipherSuite() { return "NO_NETWORK_TEST"; }
        @Override public Certificate[] getLocalCertificates() { return null; }
        @Override public Certificate[] getServerCertificates() { return new Certificate[0]; }
        void awaitDisconnect() throws Exception { check(disconnected.await(5, TimeUnit.SECONDS), "connection was not disconnected"); }
    }

    private static TouchlineApiPlugin plugin() {
        SessionVault.cookie = SESSION;
        TouchlineApiPlugin plugin = new TouchlineApiPlugin(); plugin.load(); return plugin;
    }

    private static PluginCall call(TouchlineApiPlugin plugin, String path, String method, String body) throws Exception {
        PluginCall call = new PluginCall(body == null ? Map.of("path", path, "method", method) : Map.of("path", path, "method", method, "body", body));
        plugin.request(call); call.await();
        for (FakeConnection connection : connections) connection.awaitDisconnect();
        return call;
    }

    private static void assertHandshake(FakeConnection connection) {
        check(connection.getURL().toString().equals(BASE + "/api/test-environment"), "only the internal test handshake may precede login");
        check(connection.getRequestMethod().equals("GET"), "handshake must be GET");
        check(!connection.getDoOutput() && connection.sent.size() == 0, "no credentials or body during handshake");
        check(!connection.headers.containsKey("Cookie") && !connection.headers.containsKey("Authorization"), "no session or auth during handshake");
        check("11".equals(connection.headers.get("X-Touchline-Test-Engine")), "handshake identifies engine11");
        check("https://localhost".equals(connection.headers.get("Origin")), "unchanged native Origin");
        check(!connection.getInstanceFollowRedirects(), "handshake redirects must be disabled");
        check(connection.getConnectTimeout() == 15000 && connection.getReadTimeout() == 20000, "handshake has bounded timeouts");
    }

    private static void invalidHandshakes() throws Exception {
        Reply[] invalid = {
            new Reply(302, ENVIRONMENT, "application/json"),
            new Reply(307, ENVIRONMENT, "application/json"),
            new Reply(401, ENVIRONMENT, "application/json"),
            new Reply(503, ENVIRONMENT, "application/json"),
            new Reply(-1, "", "application/json"),
            new Reply(200, ENVIRONMENT, "text/html"),
            new Reply(200, ENVIRONMENT, null),
            new Reply(200, "not JSON", "application/json"),
            new Reply(200, "[]", "application/json"),
            new Reply(200, "null", "application/json"),
            new Reply(200, ENVIRONMENT + " {}", "application/json"),
            new Reply(200, " ".repeat(4097) + ENVIRONMENT, "application/json"),
            new Reply(200, ENVIRONMENT.replace("true", "false"), "application/json"),
            new Reply(200, ENVIRONMENT.replace("true", "\"true\""), "application/json"),
            new Reply(200, ENVIRONMENT.replace("11", "10"), "application/json"),
            new Reply(200, ENVIRONMENT.replace("\"engine\":11", "\"engine\":\"11\""), "application/json"),
            new Reply(200, ENVIRONMENT.replace("touchline37-engine11-test", "production"), "application/json"),
            new Reply(200, ENVIRONMENT.replace("\"engineRevision\":2,", ""), "application/json"),
            new Reply(200, ENVIRONMENT.replace("\"engineRevision\":2", "\"engineRevision\":1"), "application/json"),
            new Reply(200, ENVIRONMENT.replace("\"engineRevision\":2", "\"engineRevision\":\"2\""), "application/json"),
            new Reply(200, "{}", "application/json")
        };
        for (Reply invalidReply : invalid) {
            TouchlineApiPlugin plugin = plugin();
            int before = connections.size();
            try {
                replies.add(invalidReply);
                PluginCall denied = call(plugin, "/api/auth/login", "POST", LOGIN);
                check(denied.result == null && "TEST_ENVIRONMENT_UNVERIFIED".equals(denied.code), "invalid environment must reject before login: " + invalidReply);
                check(connections.size() == before + 1, "failed handshake must not open an API connection");
                assertHandshake(connections.get(before));
                check(SESSION.equals(SessionVault.cookie), "handshake must not read/replace the session from Set-Cookie");
                check(replies.isEmpty(), "all and only expected handshakes run");
            } finally { plugin.handleOnDestroy(); }
        }
        System.out.println("Rejected " + invalid.length + " invalid/redirect/error handshakes before credentials.");
    }

    private static void successfulHandshakeAndCache() throws Exception {
        TouchlineApiPlugin plugin = plugin();
        int before = connections.size();
        try {
            replies.add(new Reply(200, " { \"environment\": \"touchline37-engine11-test\", \"engine\": 11, \"engineRevision\": 2, \"isolated\": true }\n", "Application/JSON; charset=utf-8"));
            replies.add(new Reply(200, "{\"user\":{\"id\":\"test\"}}", "application/json"));
            PluginCall login = call(plugin, "/api/auth/login", "POST", LOGIN);
            check(login.error == null && login.result != null, "valid isolated handshake must allow login");
            check(connections.size() == before + 2, "handshake must run exactly once before login");
            assertHandshake(connections.get(before));
            FakeConnection loginConnection = connections.get(before + 1);
            check(loginConnection.getURL().toString().equals(BASE + "/api/auth/login"), "login stays at the same test endpoint");
            check(SESSION.equals(loginConnection.headers.get("Cookie")), "handshake Set-Cookie must be ignored");
            check(LOGIN.equals(loginConnection.sent.toString(StandardCharsets.UTF_8)), "verified login body remains intact");
            check("11".equals(loginConnection.headers.get("X-Touchline-Test-Engine")), "test API sends engine11 header");
            check("https://localhost".equals(loginConnection.headers.get("Origin")), "API Origin remains unchanged");
            check(!loginConnection.getInstanceFollowRedirects(), "API redirects remain disabled");

            replies.add(new Reply(200, "{\"state\":{}}", "application/json"));
            PluginCall game = call(plugin, "/api/game", "GET", null);
            check(game.error == null && game.result != null, "verified session can read test game");
            check(connections.size() == before + 3, "successful handshake is cached within this plugin only");
            check("11".equals(connections.get(before + 2).headers.get("X-Touchline-Test-Engine")), "cached requests still select test engine11");

            replies.add(new Reply(302, "{}", "application/json"));
            PluginCall redirected = call(plugin, "/api/game", "GET", null);
            check(redirected.result == null && redirected.error != null, "API redirect is rejected after verification too");
            check(connections.size() == before + 4, "API redirect must not cause an extra connection");

            int routeBefore = connections.size();
            PluginCall internal = call(plugin, "/api/test-environment", "GET", null);
            check(internal.error != null && connections.size() == routeBefore, "internal handshake route must not expand the JS allowlist");
        } finally { plugin.handleOnDestroy(); }

        // A new plugin lifetime must verify again instead of inheriting persisted trust.
        TouchlineApiPlugin fresh = plugin();
        before = connections.size();
        try {
            replies.add(new Reply(200, ENVIRONMENT.replace("true", "false"), "application/json"));
            PluginCall denied = call(fresh, "/api/game", "GET", null);
            check("TEST_ENVIRONMENT_UNVERIFIED".equals(denied.code), "verification must not survive a new plugin lifetime");
            check(connections.size() == before + 1, "new lifetime only attempts handshake");
            assertHandshake(connections.get(before));

            replies.add(new Reply(200, ENVIRONMENT, "application/json"));
            replies.add(new Reply(200, "{\"state\":{}}", "application/json"));
            PluginCall retry = call(fresh, "/api/game", "GET", null);
            check(retry.error == null && retry.result != null, "failed handshake is not cached and can recover");
            check(connections.size() == before + 3, "retry must handshake again before API");
        } finally { fresh.handleOnDestroy(); }
        check(replies.isEmpty(), "no unconsumed network expectations");
        System.out.println("Verified native engine11 headers, process-local cache, reset/recovery and redirect isolation.");
    }

    public static void main(String[] args) throws Exception {
        URL.setURLStreamHandlerFactory(protocol -> "https".equals(protocol) ? new URLStreamHandler() {
            @Override protected URLConnection openConnection(URL url) {
                check(url.toString().startsWith(BASE + "/api/"), "no connection outside the isolated endpoint");
                Reply reply = replies.poll();
                if (reply == null) throw new AssertionError("Unexpected request: " + url);
                FakeConnection connection = new FakeConnection(url, reply); connections.add(connection); return connection;
            }
        } : null);
        invalidHandshakes();
        successfulHandshakeAndCache();
    }
}
