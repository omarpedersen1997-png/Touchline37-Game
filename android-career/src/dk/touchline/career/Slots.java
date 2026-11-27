package dk.touchline.career;

import android.content.Context;
import android.util.AtomicFile;
import java.io.*;

final class Slots {
  static final int COUNT = 4;
  private final Context context;

  Slots(Context context) {
    this.context = context;
  }

  private AtomicFile file(int i) {
    if (i < 0 || i >= COUNT) throw new IllegalArgumentException("Gemmeplads");
    return new AtomicFile(new File(context.getFilesDir(), "career12-" + i + ".tls"));
  }

  boolean exists(int i) {
    File base = file(i).getBaseFile();
    return base.exists() || new File(base.getPath() + ".bak").exists();
  }

  int free() {
    for (int i = 0; i < COUNT; i++) if (!exists(i)) return i;
    return -1;
  }

  Career load(int i) throws IOException {
    try (InputStream in = file(i).openRead()) {
      return SaveFormat.decode(in);
    }
  }

  void save(int i, Career c) throws IOException {
    byte[] bytes = SaveFormat.encode(c);
    AtomicFile dest = file(i);
    FileOutputStream out = dest.startWrite();
    try {
      out.write(bytes);
      dest.finishWrite(out);
    } catch (IOException e) {
      dest.failWrite(out);
      throw e;
    }
  }

  void remove(int i) {
    file(i).delete();
  }

  int active() {
    return context.getSharedPreferences("native-careers", 0).getInt("slot", -1);
  }

  void select(int i) {
    context.getSharedPreferences("native-careers", 0).edit().putInt("slot", i).commit();
  }
}
