package dk.touchline.footballidle;

/** Test-only in-memory vault. Production SessionVault remains unmodified. */
public final class SessionVault {
    static volatile String cookie = "__Host-touchline=" + "a".repeat(64);
    static volatile long maxAge;
    public SessionVault(Object context) {}
    public String read() { return cookie; }
    public void save(String value, long seconds) { cookie = value; maxAge = seconds; }
    public void clear() { cookie = null; maxAge = 0; }
}
