// Read the existing first-touch/shield state; do not grant possession, change
// pressure, move a defender or invent a new collision in the presentation.
export function createBallBodyResponse(){
 const value={touch:0,shield:0};
 return{update(p,state,team,index,seconds,snap=false){
  const owns=state.ball?.owner?.team===team&&state.ball.owner.index===index;
  let nearest=2.4;
  if(owns)for(const rival of state[team==='home'?'away':'home']||[]){if(!rival.keeper)nearest=Math.min(nearest,Math.hypot(rival.x-p.x,rival.y-p.y));}
  const touch=owns?Math.max(0,Math.min(1,p.touch||0)):0,shield=owns?(2.4-nearest)/2.4:0;
  const alpha=snap?1:1-Math.exp(-16*Math.max(0,Math.min(.05,seconds||0)));
  value.touch+=(touch-value.touch)*alpha;value.shield+=(shield-value.shield)*alpha;return value;
 }};
}
