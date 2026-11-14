package android.webkit;

/** Test-only Android surface used to compile the production bridge on a JVM. */
public final class WebSettings {
    public static String getDefaultUserAgent(Object context) { return "TouchlineNativeJvmTest/1.0"; }
}
