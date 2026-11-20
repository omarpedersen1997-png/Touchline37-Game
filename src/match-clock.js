// Slew server-clock corrections instead of jumping the render/physics timeline.
export function createMatchClock(serverTime,at){
 let offset=serverTime-at,target=offset,lastAt=at,last=serverTime;
 return{
  now(time){const delta=Math.max(0,time-lastAt),difference=target-offset;offset+=Math.max(-delta*.05,Math.min(delta*.05,difference));lastAt=Math.max(lastAt,time);last=Math.max(last,time+offset);return last;},
  observe(server,time){if(!Number.isFinite(server)||!Number.isFinite(time))return;this.now(time);target=server-time;}
 };
}
