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
    DataOutputStream state = new DataOutputStream(payload);
    c.write(state);
    state.writeByte(c.camera);
    state.writeByte(c.volume);
    if (c.match != null)
      for (int[] pair :
          new int[][] {c.match.onTarget, c.match.corners, c.match.cards, c.match.chances})
        for (int value : pair) state.writeInt(value);
    if (c.match != null) {
      state.writeBoolean(c.match.openingPass);
      state.writeBoolean(c.match.shotInFlight);
      state.writeBoolean(c.match.partialStats);
      c.match.writeMotion(state);
    }
    byte[] body = payload.toByteArray();
    ByteArrayOutputStream result = new ByteArrayOutputStream();
    DataOutputStream out = new DataOutputStream(result);
    out.writeInt(0x544c3132);
    out.writeInt(3);
    out.writeInt(body.length);
    out.write(hash(body));
    out.write(body);
    return result.toByteArray();
  }

  public static Career decode(InputStream stream) throws IOException {
    DataInputStream in = new DataInputStream(stream);
    if (in.readInt() != 0x544c3132) throw new IOException("Ukendt saveformat");
    int version = in.readInt();
    if (version < 1 || version > 3) throw new IOException("Ukendt saveformat");
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
      if (version < 3 && c.match != null) {
        c.match.upgradeClock();
        if (c.match.tick > 0) c.match.partialStats = true;
      }
      if (version == 1 && c.match != null) {
        c.match.restoreLegacyKickoff();
        c.match.partialStats = c.match.tick > 0;
        for (int side = 0; side < 2; side++) {
          c.match.onTarget[side] =
              Math.min(c.match.shots[side], c.match.goals[side] + c.match.saves[1 - side]);
          for (int j = 0; j < 11; j++) c.match.cards[side] += c.match.players[side * 11 + j].cards;
        }
      }
      if (version >= 2) {
        c.camera = data.readUnsignedByte();
        c.volume = data.readUnsignedByte();
        if (c.camera >= 4 || c.volume > 100) throw new IOException("Kampindstillinger");
        if (c.match != null)
          for (int[] pair :
              new int[][] {c.match.onTarget, c.match.corners, c.match.cards, c.match.chances})
            for (int side = 0; side < 2; side++) {
              pair[side] = data.readInt();
              if (pair[side] < 0) throw new IOException("Kampstatistik");
            }
      }
      if (version >= 2 && c.match != null) {
        c.match.openingPass = data.readBoolean();
        c.match.shotInFlight = data.readBoolean();
        c.match.partialStats = data.readBoolean();
      }
      if (version >= 3 && c.match != null) c.match.readMotion(data);
      if (data.available() != 0) throw new IOException("Ekstra data");
      return c;
    } catch (RuntimeException e) {
      throw new IOException("Ugyldige karrieredata", e);
    }
  }
}
