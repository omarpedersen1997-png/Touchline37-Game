// 120 real seconds represent 45 minutes. Each half has two additional match
// minutes. The input tape has a fixed length for deterministic playback.
export const R5_ADDED_TICKS = 107;

export function clockWithAddedTime(elapsedMs,{stepMs,halfMs,halftimeMs}) {
  const halfLength=halfMs+R5_ADDED_TICKS*stepMs;
  const second=elapsedMs>=halfLength+halftimeMs;
  const halfElapsed=Math.max(0,Math.min(halfLength,elapsedMs-(second?halfLength+halftimeMs:0)));
  const regular=(second?2700:0)+Math.floor(Math.min(halfMs,halfElapsed)/halfMs*2700);
  const added=Math.min(120,Math.floor(Math.max(0,halfElapsed-halfMs)/halfMs*2700));
  return {regular,added};
}
