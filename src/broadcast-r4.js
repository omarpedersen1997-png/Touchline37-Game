import { BROADCAST_OFFSET } from './match-camera.js';

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export const r4View = value => value==='tactical'||value==='stadium'?'tactical':'broadcast';

export function createR4CameraPlan(){
  const plan={eye:[0,0,0],target:[0,0,0],fov:43};
  return (state,view,aspect,ball,player,reducedMotion)=>{
    const fit=Math.max(1,Math.sqrt(1.25/Math.max(.5,aspect)));
    if(view==='tactical'){
      plan.eye[0]=78*fit;plan.eye[1]=97*fit;plan.eye[2]=23.4*fit;
      plan.target[0]=0;plan.target[1]=0;plan.target[2]=0;plan.fov=50;
      return plan;
    }
    const setPiece=state.restart&&!state.restart.released;
    const kickoff=state.openingKickoff||state.goalSequence?.stage==='kickoff';
    const f=ball.y<0?-1:1;
    const distance=48-Math.abs(ball.y);
    const threat=!kickoff&&!reducedMotion&&distance<24&&Math.abs(ball.x)<20;
    const height=clamp(ball.z-.6,0,4);
    const carry=state.ball.owner ? .075 : .105;
    const share=(!kickoff&&Math.hypot(player.x-ball.x,player.y-ball.y)<13)?.13:0;
    const lead=reducedMotion||kickoff||setPiece?0:carry;
    const lookX=kickoff?0:clamp(ball.x+(player.x-ball.x)*share+state.ball.vx*lead,-27,27);
    const lookY=kickoff?0:clamp(ball.y+(player.y-ball.y)*share+state.ball.vy*lead+(threat ? f*2.3 : 0),-46,46);
    const weight=threat?clamp((24-distance)/24,0,1):0;
    const zoom=(setPiece&&!reducedMotion?.52:.58)*(1-weight*.13+height*.035)*fit;
    plan.eye[0]=lookX+BROADCAST_OFFSET.x*zoom;plan.eye[1]=12.3*fit*(1-weight*.16+height*.06);plan.eye[2]=lookY+BROADCAST_OFFSET.z*zoom;
    plan.target[0]=lookX;plan.target[1]=.72+height*.54;plan.target[2]=lookY;
    plan.fov=kickoff?44:42-weight*1.5;
    return plan;
  };
}
