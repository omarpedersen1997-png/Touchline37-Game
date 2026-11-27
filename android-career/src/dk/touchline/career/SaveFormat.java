package dk.touchline.career;

import java.io.*;
import java.security.*;
import java.util.Arrays;

/** Same versioned envelope for the local atomic file and user-selected cloud snapshots. */
public final class SaveFormat {
  public static final int MAX = 128 * 1024;

  private static byte[] hash(byte[] b) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(b);
    } catch (NoSuchAlgorithmException e) {
      throw new AssertionError(e);
    }
  }

  public static byte[] encode(Career c) throws IOException {
    ByteArrayOutputStream payload = new ByteArrayOutputStream();
    c.write(new DataOutputStream(payload));
    byte[] body = payload.toByteArray();
    ByteArrayOutputStream result = new ByteArrayOutputStream();
    DataOutputStream out = new DataOutputStream(result);
    out.writeInt(0x544c3132);
    out.writeInt(1);
    out.writeInt(body.length);
    out.write(hash(body));
    out.write(body);
    return result.toByteArray();
  }

  public static Career decode(InputStream stream) throws IOException {
    DataInputStream in = new DataInputStream(stream);
    if (in.readInt() != 0x544c3132 || in.readInt() != 1) throw new IOException("Ukendt saveformat");
    int size = in.readInt();
    if (size < 0 || size > MAX) throw new IOException("Forkert filstørrelse");
    byte[] digest = new byte[32], body = new byte[size];
    in.readFully(digest);
    in.readFully(body);
    if (in.read() != -1 || !Arrays.equals(hash(body), digest))
      throw new IOException("Filen er ufuldstændig");
    try {
      DataInputStream data = new DataInputStream(new ByteArrayInputStream(body));
      Career c = Career.read(data);
      if (data.available() != 0) throw new IOException("Ekstra data");
      return c;
    } catch (RuntimeException e) {
      throw new IOException("Ugyldige karrieredata", e);
    }
  }
}
