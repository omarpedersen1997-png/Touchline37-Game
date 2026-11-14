import dk.touchline.footballidle.TouchlineRequestPolicy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Runs against the same transport policy class used by the Capacitor plugin. */
public final class TouchlineRequestPolicyTest {
    private static void check(boolean condition, String description) {
        if (!condition) throw new AssertionError(description);
    }
    private static byte[] bytes(String value) { return value.getBytes(StandardCharsets.UTF_8); }
    public static void main(String[] args) throws Exception {
        String packet = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        check(packet.contains("\"type\":\"manual-match-finish\""), "use real club completion JSON");
        byte[] club = bytes(packet);
        check(club.length > 8192 && club.length < 16384, "recording reproduces old native failure");
        check(TouchlineRequestPolicy.allowedBody("/api/game", "POST", club), "accept real engine7 club packet");
        byte[] career = bytes(packet.replace("manual-match-finish", "player-career-manual-finish"));
        check(TouchlineRequestPolicy.allowedBody("/api/game", "POST", career), "accept real engine7 career packet");
        check(TouchlineRequestPolicy.allowedBody("/api/game", "POST", new byte[16384]), "16KiB inclusive boundary");
        check(!TouchlineRequestPolicy.allowedBody("/api/game", "POST", new byte[16385]), "reject oversized game request");
        check(TouchlineRequestPolicy.allowedBody("/api/auth/login", "POST", new byte[8192]), "other routes retain 8KiB inclusive limit");
        check(!TouchlineRequestPolicy.allowedBody("/api/auth/login", "POST", new byte[8193]), "auth does not gain larger limit");
        check(!TouchlineRequestPolicy.allowedBody("/api/contact", "POST", new byte[8193]), "contact does not gain larger limit");
        check(!TouchlineRequestPolicy.allowedBody("/api/game", "GET", new byte[8193]), "GET does not gain POST envelope");
        String unicode = "\u20ac".repeat(2730) + "aa";
        check(bytes(unicode).length == 8192, "Unicode fixture byte boundary");
        check(TouchlineRequestPolicy.allowedBody("/api/contact", "POST", bytes(unicode)), "Unicode exact boundary");
        check(!TouchlineRequestPolicy.allowedBody("/api/contact", "POST", bytes(unicode + "a")), "UTF8 bytes, not Java character count");
        check(TouchlineRequestPolicy.allowedBody("/api/game", "POST", bytes("\u00e9".repeat(8192))), "game Unicode 16KiB boundary");
        check(!TouchlineRequestPolicy.allowedBody("/api/game", "POST", bytes("\u00e9".repeat(8193))), "game Unicode overflow");
        check(TouchlineRequestPolicy.allowedBody("/api/game", "POST", null), "absent body stays compatible");
        String[] routes = {"me", "register", "login", "logout", "delete", "capabilities", "change-password", "change-email", "request-verification", "verify-email", "request-reset", "reset-password"};
        for (String route : routes) {
            check(TouchlineRequestPolicy.allowedRoute("/api/auth/" + route, "GET"), "retain GET whitelist: " + route);
            check(TouchlineRequestPolicy.allowedRoute("/api/auth/" + route, "POST"), "retain POST whitelist: " + route);
        }
        for (String route : new String[]{"/api/game", "/api/contact"}) {
            check(TouchlineRequestPolicy.allowedRoute(route, "GET"), "retain GET: " + route);
            check(TouchlineRequestPolicy.allowedRoute(route, "POST"), "retain POST: " + route);
        }
        for (String route : new String[]{"https://evil.test/api/game", "//evil.test/api/game", "/api/game?x=1", "/api/game/../contact", "/api/auth/recover", "/api/admin", ""})
            check(!TouchlineRequestPolicy.allowedRoute(route, "POST"), "deny unlisted path: " + route);
        for (String method : new String[]{"DELETE", "PUT", "PATCH", "HEAD", "post", ""})
            check(!TouchlineRequestPolicy.allowedRoute("/api/game", method), "deny unlisted method: " + method);
        check(!TouchlineRequestPolicy.allowedRoute(null, "GET"), "null path denied");
        check(!TouchlineRequestPolicy.allowedRoute("/api/game", null), "null method denied");
        System.out.println("Native request policy passed real engine8 packet, UTF8 limits, and unchanged route/method whitelist.");
    }
}
