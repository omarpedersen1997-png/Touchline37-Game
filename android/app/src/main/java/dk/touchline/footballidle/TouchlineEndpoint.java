package dk.touchline.footballidle;

import java.util.Locale;

/**
 * Bestemmer den server, appens native API-bro må kontakte.
 *
 * Produktionsvarianterne (release, sideload, debug) bruger uændret produktionsadressen
 * fra BuildConfig. Testvarianten (touchlineTest) får sin egen adresse og må ALDRIG
 * pege på produktionen: en produktionslignende adresse giver null, og broen afviser
 * så alle forespørgsler. Gradle-bygningen har en tilsvarende spærre.
 */
final class TouchlineEndpoint {
    // One separately created test project, never the production Sites project.
    // Exact trimmed origin only: no path, port, userinfo, query or fragment.
    static final String ISOLATED_TEST_ORIGIN = "https://touchline37-engine11-test.glowingconch1.chatgpt.site";
    /** Kendetegn for produktionsværter, som testappen aldrig må kontakte. */
    static final String[] PRODUCTION_MARKERS = {
        "chatgpt.site", "chatgpt-team.site", "glowingconch1", "playtouchline.dk"
    };

    private TouchlineEndpoint() {}

    /** @return den tilladte HTTPS-adresse uden afsluttende skråstreg, eller null hvis den er spærret. */
    static String resolve(String configured, boolean testBuild) {
        if (configured == null) return null;
        String origin = configured.trim();
        String base = origin;
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (!base.startsWith("https://") || base.length() <= "https://".length()) return null;
        if (testBuild && isProduction(base) && !ISOLATED_TEST_ORIGIN.equals(origin)) return null;
        return base;
    }

    static boolean isProduction(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        for (String marker : PRODUCTION_MARKERS) if (lower.contains(marker)) return true;
        return false;
    }
}
