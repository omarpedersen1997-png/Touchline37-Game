import {createPlayerStride,JOINT as J,samplePlayerStride} from './player-stride-pose.js';

const SKIN=['#cc987b','#926349','#e4ad88','#684733'];
const SIDES=['home','away'];

export function createMatch2DPlayers() {
  const players=Array.from({length:22},(_,i)=>createPlayerStride(i+1)), projected=new Float32Array(36);
  const point=index=>index/3*2;
  let ctx,scale;
  const line=(from,to)=>{
    const a=point(from),b=point(to);
    ctx.moveTo(projected[a],projected[a+1]);ctx.lineTo(projected[b],projected[b+1]);
  };
  return function draw(context,state,team,index,player,x,y,heading,pixels,landscape,elapsed,subtick,color,snap) {
    const slot=(team===SIDES[0]?0:11)+index,clock=players[slot];
    if(player.sentOff){clock.previousX=NaN;return;}
    ctx=context;scale=pixels;
    const owns=state.ball?.owner?.team===team&&state.ball.owner.index===index;
    const charge=owns?Math.max(state.shotCharge||0,state.passCharge||0)/18:0;
    const j=samplePlayerStride(clock,player,x,y,heading,elapsed,subtick,snap,charge);
    const cos=Math.cos(heading),sin=Math.sin(heading),height=.85;
    for(let k=0,n=0;k<j.length;k+=3){
      const side=cos*j[k]+sin*j[k+2],ahead=-sin*j[k]+cos*j[k+2];
      projected[n++]=(x+side-(landscape?j[k+1]*height:0))*scale;
      projected[n++]=(y+ahead-(landscape?0:j[k+1]*height))*scale;
    }
    const px=x*scale,py=y*scale,r=Math.max(4,scale*.62),focused=team===SIDES[0]&&index===state.controlled;
    ctx.beginPath();ctx.ellipse(px,py,r,r*.69,0,0,Math.PI*2);ctx.fillStyle='#0a201e91';ctx.fill();
    if(focused){ctx.strokeStyle='#eaffab';ctx.lineWidth=1.5;ctx.stroke();}
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#15262b';ctx.lineWidth=Math.max(1.7,scale*.21);ctx.beginPath();
    line(J.hipL,J.kneeL);line(J.hipR,J.kneeR);line(J.ankleL,J.bootL);line(J.ankleR,J.bootR);ctx.stroke();
    ctx.strokeStyle='#e2ebde';ctx.lineWidth=Math.max(1.2,scale*.12);ctx.beginPath();
    line(J.kneeL,J.ankleL);line(J.kneeR,J.ankleR);ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,scale*.20);ctx.beginPath();
    line(J.shoulderL,J.elbowL);line(J.shoulderR,J.elbowR);ctx.stroke();
    ctx.lineWidth=Math.max(3.1,scale*.39);ctx.beginPath();line(J.pelvis,J.chest);ctx.stroke();
    ctx.strokeStyle=SKIN[slot%SKIN.length];ctx.lineWidth=Math.max(1.15,scale*.104);ctx.beginPath();
    line(J.elbowL,J.handL);line(J.elbowR,J.handR);ctx.stroke();
    const head=point(J.head);ctx.beginPath();ctx.arc(projected[head],projected[head+1],Math.max(1.4,scale*.122),0,Math.PI*2);
    ctx.fillStyle=SKIN[slot%SKIN.length];ctx.fill();
  };
}
