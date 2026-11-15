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
        // Kun https.
        for (String bad : new String[]{null, "", "http://test.example.org", "https://", "ftp://x"}) {
            check(TouchlineEndpoint.resolve(bad, true) == null, "ugyldig adresse: " + bad);
            check(TouchlineEndpoint.resolve(bad, false) == null, "ugyldig adresse (produktion): " + bad);
        }
        System.out.println("TouchlineEndpoint spærrer produktionen for testappen");
    }
}
