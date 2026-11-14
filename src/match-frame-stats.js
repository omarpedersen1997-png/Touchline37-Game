// Count submitted match frames over real elapsed time, not the target cadence.
export function createMatchFrameStats(){
 let start=null,frames=0;
 return now=>{
  if(!Number.isFinite(now))return null;
  if(start===null||now<start){start=now;frames=0;return null;}
  frames++;const span=now-start;if(span<1000)return null;
  const stats={fps:Math.round(frames*1000/span),frameMs:Math.round(span/frames)};
  start=now;frames=0;return stats;
 };
}
