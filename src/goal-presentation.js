const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

// A restart is not a celebration. Older recordings can cheer only during the
// short freeze belonging to their own captured goal, never a later corner.
export function isGoalCelebrant(state,team,index,player){
 const sequence=state.goalSequence;
 if(sequence)return sequence.stage==='celebration'&&sequence.team===team&&sequence.celebrants.includes(index)&&Math.hypot(player?.vx||0,player?.vy||0)<.8;
 if(state.version>=10)return false;
 const goal=state.lastGoal;
 return !!goal&&state.freeze>0&&goal.side===team&&state.tick>=goal.tick&&state.tick-goal.tick<20;
}

// Hold the lens over the actual goal instead of chasing a selected defender.
// Translating eye and target together preserves the TV heading and zoom.
export function goalCameraPlan(plan,state,view){
 if(view==='stadium')return plan;
 const sequence=state.goalSequence;
 if(!sequence||!['net','celebration'].includes(sequence.stage))return plan;
 const x=clamp(sequence.point.x,-27,27),z=clamp(sequence.point.y,-45,45),dx=x-plan.target[0],dz=z-plan.target[2];
 return{...plan,eye:[plan.eye[0]+dx,plan.eye[1],plan.eye[2]+dz],target:[x,plan.target[1],z]};
}

// Do not extrapolate through the net before the next authoritative impact.
// The engine owns the bounce; this only bounds the intervening draw frames.
export function goalBallPosition(state,seconds){
 const ball=state.ball,sequence=state.goalSequence;
 const point={x:ball.x+ball.vx*seconds,y:ball.y+ball.vy*seconds,z:ball.z+ball.vz*seconds};
 if(!sequence||sequence.stage==='kickoff')return point;
 const field=state.field,edge=field.length/2,sign=sequence.netSide;
 // The mouth stays open: a real rebound can roll back onto the pitch.
 if(ball.y*sign<edge||point.y*sign<edge)return point;
 point.x=clamp(point.x,-field.goalWidth/2+.22,field.goalWidth/2-.22);
 point.y=sign*Math.min(point.y*sign,edge+1.78);
 point.z=clamp(point.z-4.905*seconds*seconds,.22,field.goalHeight-.22);
 return point;
}

// Net contacts are produced by the deterministic engine. Only the struck net
// responds; fixed front posts/crossbar remain pinned. The small shared grid is
// updated in place only while its damped ripple is visible.
export function deformGoalNet(output,rest,state,sign,field,subtick=0){
 const sequence=state.goalSequence,impact=sequence?.impact;
 if(!impact||sequence.netSide!==sign||sequence.stage==='kickoff')return false;
 const age=(state.tick-impact.tick)*.05+subtick;
 if(age<0||age>1.8)return false;
 const wave=Math.sin(age*18)*Math.exp(-age*3.4)*(.07+clamp(impact.strength||0,0,1)*.27);
 if(Math.abs(wave)<.0002&&age>.6)return false;
 const length=field.length/2,halfWidth=field.goalWidth/2,height=field.goalHeight,surface=impact.surface;
 for(let i=0;i<rest.length;i+=3){
  const x=rest[i],y=rest[i+1],z=rest[i+2],depth=z*sign;
  const distance=(x-impact.x)**2+(y-impact.z)**2+(z-(impact.y-sign*length))**2;
  const pinned=clamp(depth/1.1,0,1),falloff=Math.exp(-distance/3.2),amount=wave*pinned*falloff;
  output[i]=x;output[i+1]=y;output[i+2]=z;
  if(surface==='side'||surface==='left'||surface==='right')output[i]+=Math.sign(impact.x)*amount*clamp(Math.abs(x)/halfWidth,0,1);
  else if(surface==='roof'||surface==='top')output[i+1]+=amount*clamp(y/height,0,1);
  else output[i+2]+=sign*amount;
 }
 return true;
}
