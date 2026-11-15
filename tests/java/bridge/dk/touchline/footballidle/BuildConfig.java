package dk.touchline.footballidle;

/**
 * Kun til JVM-testen af den native bro: efterligner den BuildConfig, som Gradle
 * genererer for produktionsvarianterne (release/sideload/debug) ud fra
 * android/app/build.gradle. tests/android-test-variant.test.mjs kontrollerer, at
 * værdierne her er identiske med defaultConfig i build.gradle.
 */
public final class BuildConfig {
    public static final String TOUCHLINE_API = "https://touchline-idle-club.glowingconch1.chatgpt.site";
    public static final boolean TOUCHLINE_TEST_BUILD = false;
    private BuildConfig() {}
}
