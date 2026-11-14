package dk.touchline.footballidle;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Session tokens stay encrypted in app-private storage, outside JavaScript. */
final class SessionVault {
    private static final String ALIAS = "touchline_session_v1";
    private final SharedPreferences prefs;
    SessionVault(Context context) { prefs = context.getSharedPreferences("session_vault", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            gen.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    synchronized String read() {
        String value = prefs.getString("token", null);
        if (value == null || prefs.getLong("expires", 0) <= System.currentTimeMillis()) { clear(); return null; }
        try {
            String[] parts = value.split("\\.");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception error) { clear(); return null; }
    }
    synchronized void save(String cookie, long maxAgeSeconds) throws Exception {
        if (maxAgeSeconds <= 0) { clear(); return; }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." +
            Base64.encodeToString(cipher.doFinal(cookie.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString("token", value).putLong("expires", System.currentTimeMillis() + maxAgeSeconds * 1000).commit())
            throw new IllegalStateException("Session storage failed");
    }
    synchronized void clear() { prefs.edit().clear().commit(); }
}
