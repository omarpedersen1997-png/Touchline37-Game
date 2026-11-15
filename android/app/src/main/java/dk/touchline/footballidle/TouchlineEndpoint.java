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
    /** Kendetegn for produktionsværter, som testappen aldrig må kontakte. */
    static final String[] PRODUCTION_MARKERS = {
        "chatgpt.site", "chatgpt-team.site", "glowingconch1", "playtouchline.dk"
    };

    private TouchlineEndpoint() {}

    /** @return den tilladte HTTPS-adresse uden afsluttende skråstreg, eller null hvis den er spærret. */
    static String resolve(String configured, boolean testBuild) {
        if (configured == null) return null;
        String base = configured.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (!base.startsWith("https://") || base.length() <= "https://".length()) return null;
        if (testBuild && isProduction(base)) return null;
        return base;
    }

    static boolean isProduction(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        for (String marker : PRODUCTION_MARKERS) if (lower.contains(marker)) return true;
        return false;
    }
}
