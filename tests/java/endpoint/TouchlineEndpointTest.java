package dk.touchline.footballidle;

/** JVM-test af TouchlineEndpoint: testappen kan aldrig få en produktionsadresse. */
public final class TouchlineEndpointTest {
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }

    public static void main(String[] args) {
        String production = "https://touchline-idle-club.glowingconch1.chatgpt.site";
        // Produktionsvarianter: uændret adresse.
        check(production.equals(TouchlineEndpoint.resolve(production, false)), "produktion skal beholde sin adresse");
        check(production.equals(TouchlineEndpoint.resolve(production + "/", false)), "afsluttende skråstreg fjernes");
        // Testvariant: produktionslignende adresser spærres.
        for (String blocked : new String[]{
            production, "https://playtouchline.dk", "https://PLAYTOUCHLINE.DK/api", "https://x.chatgpt.site",
            "https://git.chatgpt-team.site", "https://glowingconch1.example"}) {
            check(TouchlineEndpoint.resolve(blocked, true) == null, "testappen må ikke få " + blocked);
        }
        // Testvariant: separate https-testservere tilladt.
        check("https://touchline-test.invalid".equals(TouchlineEndpoint.resolve("https://touchline-test.invalid", true)), "standard-testadresse");
        check("https://test.example.org".equals(TouchlineEndpoint.resolve("https://test.example.org/", true)), "separat testserver");
        // This single separately created Sites test project is explicitly allowed.
        // Match before general trailing-slash normalization, so no URL variants can
        // widen the exception. The native bridge still verifies its handshake.
        String isolated = "https://touchline37-engine11-test.glowingconch1.chatgpt.site";
        check(isolated.equals(TouchlineEndpoint.resolve(isolated, true)), "præcis separat Sites-testserver");
        check(isolated.equals(TouchlineEndpoint.resolve("  " + isolated + "  ", true)), "omgivende mellemrum fjernes");
        for (String blocked : new String[]{
            isolated + "/", isolated + "//", isolated + "/api", isolated + "/../", isolated + "?x=1", isolated + "#x",
            isolated + ":443", isolated + ":443/", isolated + ":8443", isolated + ".evil.invalid",
            isolated + "@evil.invalid", isolated.replace("https://", "https://user@"),
            isolated.replace("https://", "https://user:password@"), isolated.replace("https://", "http://"),
            isolated.replace("touchline37-engine11-test", "touchline37-engine11-test2"),
            isolated.replace("touchline37-engine11-test", "prefix.touchline37-engine11-test"),
            isolated.replace("glowingconch1", "glowingconch2"), isolated.toUpperCase(java.util.Locale.ROOT),
            "https://other-test.glowingconch1.chatgpt.site", "https://another-test.chatgpt.site"
        }) check(TouchlineEndpoint.resolve(blocked, true) == null, "Sites-undtagelsen må ikke udvides: " + blocked);
        // Kun https.
        for (String bad : new String[]{null, "", "http://test.example.org", "https://", "ftp://x"}) {
            check(TouchlineEndpoint.resolve(bad, true) == null, "ugyldig adresse: " + bad);
            check(TouchlineEndpoint.resolve(bad, false) == null, "ugyldig adresse (produktion): " + bad);
        }
        System.out.println("TouchlineEndpoint spærrer produktionen for testappen");
    }
}
