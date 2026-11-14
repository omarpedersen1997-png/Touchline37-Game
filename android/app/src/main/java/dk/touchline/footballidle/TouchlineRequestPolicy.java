package dk.touchline.footballidle;

import java.util.regex.Pattern;

/** Native transport envelope limits; endpoint-specific validation stays on the server. */
public final class TouchlineRequestPolicy {
    public static final int DEFAULT_BODY_BYTES = 8192;
    public static final int GAME_BODY_BYTES = 16384;
    private static final Pattern PATH = Pattern.compile(
        "/api/(auth/(me|register|login|logout|delete|capabilities|change-password|change-email|request-verification|verify-email|request-reset|reset-password)|game|contact)"
    );

    private TouchlineRequestPolicy() {}

    public static boolean allowedRoute(String path, String method) {
        return path != null && PATH.matcher(path).matches() &&
            ("GET".equals(method) || "POST".equals(method));
    }

    public static int bodyLimit(String path, String method) {
        return "/api/game".equals(path) && "POST".equals(method) ? GAME_BODY_BYTES : DEFAULT_BODY_BYTES;
    }

    public static boolean allowedBody(String path, String method, byte[] body) {
        return body == null || body.length <= bodyLimit(path, method);
    }
}
