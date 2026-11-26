import { BROADCAST_OFFSET } from './match-camera.js';

export const MATCH_CAMERA_LABELS=Object.freeze({broadcast:'Broadcast',tactical:'Taktisk',close:'Mål / nær'});

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export const r4View = value => value==='tactical'||value==='stadium'?'tactical':'broadcast';

// Scale a fixed-heading camera to leave readable space around two points.
// Perspective depth includes the point's position along the camera axis.
function fitPoint(plan,frame,x,y,z){
  const dx=x-plan.target[0],dy=y-plan.target[1],dz=z-plan.target[2];
  const forward=dx*frame.fx+dz*frame.fz;
  const sideways=dx*frame.fz-dz*frame.fx;
  const up=dy*frame.cos-forward*frame.sin;
  return Math.max(Math.abs(sideways)/frame.horizontal,Math.abs(up)/frame.vertical)
    +forward*frame.cos+dy*frame.sin;
}

function fitPass(plan,frame,aspect,ball,receive,weight){
  const x=plan.target[0],y=plan.target[1],z=plan.target[2];
  const ex=plan.eye[0]-x,ey=plan.eye[1]-y,ez=plan.eye[2]-z;
  const flat=Math.hypot(ex,ez),depth=Math.hypot(flat,ey);
  const lens=Math.tan(plan.fov*Math.PI/360);
  frame.fx=ex/flat;frame.fz=ez/flat;frame.cos=flat/depth;frame.sin=ey/depth;
  frame.vertical=lens*.68;frame.horizontal=lens*Math.max(.35,aspect)*.78;
  const needed=Math.max(fitPoint(plan,frame,ball.x,ball.z,ball.y),fitPoint(plan,frame,receive.x,.65,receive.y));
  const scale=1+clamp(needed/depth-1,0,.4)*weight;
  plan.eye[0]=x+ex*scale;
  plan.eye[1]=y+ey*scale;
  plan.eye[2]=z+ez*scale;
}

export function createR4CameraPlan(){
  const plan={eye:[0,0,0],target:[0,0,0],fov:43};
  const framing={};
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
    const halfLength=state.field.length*.5;
    const distance=halfLength-Math.abs(ball.y);
    const threat=!kickoff&&!reducedMotion&&distance<24&&Math.abs(ball.x)<20;
    const height=clamp(ball.z-.6,0,4);
    const directed=!reducedMotion&&!kickoff&&!setPiece;
    const shot=state.engineRevision>=6&&state.ball.shot&&!state.ball.owner&&directed;
    const leadWeight=shot?clamp(1-(state.ball.flight||0)/24,0,1):0;
    const flight=state.ball.flight||0;
    const receiving=state.engineRevision===7&&directed&&!state.ball.owner&&!state.goalSequence
      ?state.ball.receivePoint:null;
    const cross=receiving&&state.ball.flightKind==='loft'?receiving:null;
    const crossWeight=cross?clamp(flight/5,0,1)*clamp(1-flight/34,0,1):0;
    const dx=receiving?receiving.x-ball.x:0,dy=receiving?receiving.y-ball.y:0;
    const passDistance=receiving?Math.hypot(dx,dy):0;
    const ahead=receiving&&dx*state.ball.vx+dy*state.ball.vy>0;
    const distanceWeight=ahead?clamp((passDistance-5)/5,0,1)*clamp((32-passDistance)/6,0,1):0;
    const passWeight=cross?0:distanceWeight;
    const carry=state.ball.owner ? .075 : .105+leadWeight*.057;
    const share=(!kickoff&&Math.hypot(player.x-ball.x,player.y-ball.y)<13)?.13:0;
    const lead=reducedMotion||kickoff||setPiece?0:carry;
    const crossX=cross?clamp(cross.x-ball.x,-14,14)*crossWeight*.22:0;
    const crossY=cross?clamp(cross.y-ball.y,-18,18)*crossWeight*.3:0;
    const lookX=kickoff?0:clamp(ball.x+(player.x-ball.x)*share+state.ball.vx*lead+crossX+dx*passWeight*.22,-27,27);
    const lookY=kickoff?0:clamp(ball.y+(player.y-ball.y)*share+state.ball.vy*lead+(threat ? f*2.3 : 0)+crossY+dy*passWeight*.22,-46,46);
    const weight=threat?clamp((24-distance)/24,0,1):0;
    const close=view==='close'&&!kickoff&&!reducedMotion;
    const woodwork=state.engineRevision===5&&!reducedMotion&&state.lastAction?.kind==='woodwork'?Math.max(0,1-(state.tick-state.lastAction.tick)/5):0;
    const zoom=(close?.42:setPiece&&!reducedMotion?.52:.58)*(1-weight*.13+height*.035+leadWeight*.06+crossWeight*.13)*fit;
    const cameraHeight=state.engineRevision>=6?11.9:12.3;
    plan.eye[0]=lookX+BROADCAST_OFFSET.x*zoom;plan.eye[1]=(close?9.6:cameraHeight)*fit*(1-weight*.12+height*.09+crossWeight*.13);plan.eye[2]=lookY+BROADCAST_OFFSET.z*zoom;
    plan.target[0]=lookX+woodwork*.18;plan.target[1]=.72+height*.54;plan.target[2]=lookY;
    plan.fov=kickoff?44:(close?41:42)-weight*1.5+leadWeight*1.2;
    if(distanceWeight>0)fitPass(plan,framing,aspect,ball,receiving,distanceWeight);
    return plan;
  };
}
