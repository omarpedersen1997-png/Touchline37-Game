// Rendering owns no game state. One reusable previous-tick buffer per match.
// A WeakMap prevents UI/replay copies from retaining old matches or buffers.
const poses = new WeakMap();
const stride = 4;

export function captureR4Pose(state) {
  let pose = poses.get(state);
  if (!pose) {
    pose = {players:new Float32Array(22*stride),ball:new Float32Array(3)};
    poses.set(state,pose);
  }
  pose.tick = state.tick;
  pose.period = state.period;
  pose.restart = state.restart?.tick;
  pose.goal = state.goalSequence?.stage;
  for (let i=0;i<22;i++) {
    const p = state[i<11?'home':'away'][i%11], j=i*stride;
    pose.players[j]=p.x;
    pose.players[j+1]=p.y;
    pose.players[j+2]=p.facingX;
    pose.players[j+3]=p.facingY;
  }
  pose.ball[0]=state.ball.x;
  pose.ball[1]=state.ball.y;
  pose.ball[2]=state.ball.z;
}

export function r4PoseFrame(state) {
  const pose=poses.get(state);
  if (!pose || pose.tick!==state.tick-1 || pose.period!==state.period ||
      pose.restart!==state.restart?.tick || pose.goal!==state.goalSequence?.stage) return null;
  return pose;
}

export function sampleR4Player(state,pose,team,index,alpha,out) {
  const p=state[team][index],j=((team==='home'?0:11)+index)*stride;
  if(!pose||p.sentOff){
    out.x=p.x;out.y=p.y;out.angle=Math.atan2(p.facingX,p.facingY);return out;
  }
  const before=pose.players,x=before[j],y=before[j+1];
  // A referee moving a wall or setting a restart is a cut, not a sprint.
  if (Math.abs(p.x-x)+Math.abs(p.y-y)>3) {out.x=p.x;out.y=p.y;}
  else {out.x=x+(p.x-x)*alpha;out.y=y+(p.y-y)*alpha;}
  out.angle=Math.atan2(before[j+2]+(p.facingX-before[j+2])*alpha,before[j+3]+(p.facingY-before[j+3])*alpha);
  return out;
}

export function sampleR4Ball(state,pose,alpha,out) {
  const ball=state.ball,p=pose?.ball;
  const smooth=p&&Math.abs(ball.x-p[0])+Math.abs(ball.y-p[1])<3.8;
  out.x=smooth?p[0]+(ball.x-p[0])*alpha:ball.x;
  out.y=smooth?p[1]+(ball.y-p[1])*alpha:ball.y;
  out.z=smooth?p[2]+(ball.z-p[2])*alpha:ball.z;
  return out;
}
