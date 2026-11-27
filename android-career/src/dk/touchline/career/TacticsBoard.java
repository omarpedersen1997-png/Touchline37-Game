package dk.touchline.career;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;

/** Coach's board uses the same formation coordinates as the match engine. */
final class TacticsBoard extends View {
  final Career career;
  final Paint paint = new Paint(3);
  final long opened = SystemClock.uptimeMillis();

  TacticsBoard(Context ctx, Career c) {
    super(ctx);
    career = c;
    setContentDescription("Taktiktavle · " + Career.FORMATIONS[c.formation]);
  }

  private float x(int n) {
    return getWidth() * (.08f + Motor12.DEPTH[career.formation][n] * .018f);
  }

  private float y(int n) {
    return getHeight() * (.50f + Motor12.LANE[career.formation][n] * .015f);
  }

  @Override
  public void onDraw(Canvas c) {
    int w = getWidth(), h = getHeight();
    c.drawColor(0xff244c38);
    paint.setColor(0x7495ba9d);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(2);
    c.drawRect(3, 3, w - 3, h - 3, paint);
    c.drawCircle(w * .5f, h * .5f, h * .14f, paint);
    c.drawLine(w * .5f, 3, w * .5f, h - 3, paint);
    c.drawRect(3, h * .25f, w * .14f, h * .75f, paint);
    float progress = Math.min(1, (SystemClock.uptimeMillis() - opened) / 420f);
    paint.setColor(0xb7e0c073);
    for (int j = 1; j < 10; j++)
      if (Math.abs(Motor12.DEPTH[career.formation][j] - Motor12.DEPTH[career.formation][j + 1])
          <= 4)
        c.drawLine(
            x(j),
            y(j),
            x(j) + (x(j + 1) - x(j)) * progress,
            y(j) + (y(j + 1) - y(j)) * progress,
            paint);
    paint.setTextAlign(Paint.Align.CENTER);
    paint.setTypeface(Typeface.DEFAULT_BOLD);
    float radius = Math.max(6, h * .053f);
    paint.setTextSize(radius * 1.15f);
    for (int j = 0; j < 11; j++) {
      paint.setStyle(Paint.Style.FILL);
      paint.setColor(j == 0 ? 0xffe0b65c : 0xffb22d39);
      c.drawCircle(x(j), y(j), radius, paint);
      paint.setColor(0xfff9f1db);
      c.drawText(Integer.toString(career.lineup[j] + 1), x(j), y(j) + radius * .35f, paint);
    }
    if (progress < 1) postInvalidateOnAnimation();
  }
}
