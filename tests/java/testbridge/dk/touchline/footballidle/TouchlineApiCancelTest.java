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
import java.security.cert.Certificate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/** Real queue/connection cancellation. No DNS, TLS or server is contacted. */
public final class TouchlineApiCancelTest {
    private static final String ENV = "{\"isolated\":true,\"engine\":11,\"engineRevision\":2,\"environment\":\"touchline37-engine11-test\"}";
    private static final String COOKIE = "__Host-touchline=" + "a".repeat(64);
    private static final ConcurrentLinkedQueue<Reply> replies = new ConcurrentLinkedQueue<>();
    private static final List<Connection> opened = new CopyOnWriteArrayList<>();
    private static final class Reply {
        final String body; final boolean block; final CountDownLatch entered = new CountDownLatch(1);
        Reply(String body, boolean block) { this.body = body; this.block = block; }
        void awaitEntry() throws Exception { check(entered.await(3, TimeUnit.SECONDS), "connection never entered blocking I/O"); }
    }
    private static final class Connection extends HttpsURLConnection {
        final Reply reply; final CountDownLatch disconnected = new CountDownLatch(1);
        final ByteArrayOutputStream sent = new ByteArrayOutputStream();
        Connection(URL url, Reply reply) { super(url); this.reply = reply; }
        @Override public int getResponseCode() {
            reply.entered.countDown();
            // Ignore Future interruption deliberately: disconnect must run outside
            // the blocked single request executor and release the queue itself.
            while (reply.block && disconnected.getCount() != 0) {
                try { check(disconnected.await(3, TimeUnit.SECONDS), "cancel did not disconnect active I/O"); }
                catch (InterruptedException ignored) {}
            }
            return 200; // An uncooperative late success must never win cancellation.
        }
        @Override public String getContentType() { return "application/json"; }
        @Override public Map<String,List<String>> getHeaderFields() { return reply.block ? Map.of("Set-Cookie", List.of("__Host-touchline=" + "b".repeat(64) + "; Max-Age=3600")) : Map.of(); }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(reply.body.getBytes(StandardCharsets.UTF_8)); }
        @Override public InputStream getErrorStream() { return getInputStream(); }
        @Override public OutputStream getOutputStream() { return sent; }
        @Override public void disconnect() { disconnected.countDown(); }
        @Override public boolean usingProxy() { return false; }
        @Override public void connect() { throw new AssertionError("Real network is forbidden"); }
        @Override public String getCipherSuite() { return "NO_NETWORK"; }
        @Override public Certificate[] getLocalCertificates() { return null; }
        @Override public Certificate[] getServerCertificates() { return new Certificate[0]; }
    }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static TouchlineApiPlugin plugin() { SessionVault.cookie = COOKIE; TouchlineApiPlugin p = new TouchlineApiPlugin(); p.load(); return p; }
    private static void handshake() { if (BuildConfig.TOUCHLINE_TEST_BUILD) replies.add(new Reply(ENV, false)); }
    private static PluginCall request(TouchlineApiPlugin p, String id, boolean post) {
        java.util.HashMap<String,String> data = new java.util.HashMap<>();
        data.put("path", post ? "/api/auth/login" : "/api/game"); data.put("method", post ? "POST" : "GET");
        if (post) data.put("body", "{\"password\":\"queued-local-fixture-only\"}");
        if (id != null) data.put("requestId", id);
        PluginCall call = new PluginCall(data); p.request(call); return call;
    }
    private static PluginCall cancel(TouchlineApiPlugin p, String id) throws Exception {
        PluginCall call = new PluginCall(Map.of("requestId", id)); p.cancel(call); call.await(); return call;
    }
    private static void cancelled(PluginCall call) throws Exception { call.await(); check("REQUEST_CANCELLED".equals(call.code) && call.result == null && call.completions.get() == 1, "cancelled request must terminate exactly once"); }

    private static void activeAndQueued() throws Exception {
        TouchlineApiPlugin p = plugin();
        try {
            handshake(); Reply blocked = new Reply("{\"late\":true}", true); replies.add(blocked);
            PluginCall active = request(p, "active", false); blocked.awaitEntry();
            PluginCall duplicate = request(p, "active", false); duplicate.await(); check("REQUEST_ID_DUPLICATE".equals(duplicate.code), "duplicate id must not replace running request");
            PluginCall queued = request(p, "queued", true); int before = opened.size();
            check(Boolean.TRUE.equals(cancel(p, "queued").result.get("cancelled")), "queued future must be cancellable"); cancelled(queued);
            check(opened.size() == before, "queued credentials must never open a connection");
            check(Boolean.TRUE.equals(cancel(p, "active").result.get("cancelled")), "active I/O must be cancellable"); cancelled(active);
            // Legacy callers without requestId still work after the blocked queue
            // has been released; the cancelled queued POST must not consume this.
            replies.add(new Reply("{\"ok\":true}", false)); PluginCall legacy = request(p, null, false); legacy.await();
            check(legacy.error == null && legacy.result != null, "legacy call must resolve after active cancellation");
            check(opened.size() == before + 1, "only the canary may run after cancellation");
            check(active.completions.get() == 1 && queued.completions.get() == 1, "late network success must not settle again");
            check(COOKIE.equals(SessionVault.cookie), "cancelled late API response cannot overwrite the session vault");
            check(opened.get(before - 1).sent.size() == 0, "cancel fixture is a GET and cannot leak queued body");
            check(Boolean.FALSE.equals(cancel(p, "active").result.get("cancelled")), "repeated cancellation is harmless");
            replies.add(new Reply("{}", false)); PluginCall done = request(p, "completed", false); done.await();
            check(Boolean.FALSE.equals(cancel(p, "completed").result.get("cancelled")), "completed requests cannot be cancelled again");
            check(done.completions.get() == 1, "completed request must remain settled once");
        } finally { p.handleOnDestroy(); }
    }
    private static void cancelledHandshake() throws Exception {
        if (!BuildConfig.TOUCHLINE_TEST_BUILD) return;
        TouchlineApiPlugin p = plugin();
        try {
            Reply blocked = new Reply(ENV, true); replies.add(blocked);
            PluginCall login = request(p, "handshake", true); blocked.awaitEntry(); int before = opened.size();
            cancel(p, "handshake"); cancelled(login);
            check(COOKIE.equals(SessionVault.cookie), "cancelled handshake cannot replace native session");
            replies.add(new Reply(ENV, false)); replies.add(new Reply("{}", false));
            PluginCall next = request(p, "after-handshake", false); next.await();
            check(next.error == null && opened.size() == before + 2, "cancelled handshake must verify afresh before the next API call");
            check(opened.get(before - 1).sent.size() == 0, "cancelled handshake must never upload login body");
            check(login.completions.get() == 1, "late handshake must not settle login twice");
        } finally { p.handleOnDestroy(); }
    }
    private static void destroyPending() throws Exception {
        TouchlineApiPlugin p = plugin();
        handshake(); Reply blocked = new Reply("{}", true); replies.add(blocked);
        PluginCall active = request(p, "destroy-active", false); blocked.awaitEntry();
        PluginCall queued = request(p, "destroy-queued", true); int before = opened.size();
        p.handleOnDestroy(); cancelled(active); cancelled(queued);
        PluginCall after = request(p, "after-destroy", true); cancelled(after);
        check(opened.size() == before, "destroyed plugin must never send queued or new requests");
    }
    public static void main(String[] args) throws Exception {
        URL.setURLStreamHandlerFactory(protocol -> "https".equals(protocol) ? new URLStreamHandler() {
            @Override protected URLConnection openConnection(URL url) {
                check(url.toString().startsWith(BuildConfig.TOUCHLINE_API + "/api/"), "connection must stay at configured endpoint");
                Reply reply = replies.poll(); check(reply != null, "unexpected network request " + url);
                Connection c = new Connection(url, reply); opened.add(c); return c;
            }
        } : null);
        activeAndQueued(); cancelledHandshake(); destroyPending();
        check(replies.isEmpty(), "unexpected leftover replies");
        System.out.println("Native cancellation passed: queued credentials never sent, active/handshake I/O disconnected, lifecycle/legacy preserved, every call settles once.");
    }
}
