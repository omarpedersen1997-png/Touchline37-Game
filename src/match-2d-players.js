import {createPlayerStride,JOINT as J,samplePlayerStride} from './player-stride-pose.js';

const SKIN=['#cc987b','#926349','#e4ad88','#684733'];
const TILE=40, GRID=24, ATLAS_SCALE=12, ANCHOR=TILE/2, ANGLES=16;
const SIDES=['home','away'];

export function createMatch2DPlayers(makeCanvas=()=>globalThis.document?.createElement('canvas')) {
  const players=Array.from({length:22},(_,i)=>createPlayerStride(i+1)), projected=new Float32Array(36);
  const atlas=makeCanvas(),tiles=new Map(),keys=new Int32Array(GRID*GRID).fill(-1);
  let painter=null,nextTile=0;
  if(atlas){
    atlas.width=atlas.height=GRID*TILE;
    painter=atlas.getContext('2d');
  }
  const point=index=>index/3*2;
  let ctx;
  const line=(from,to)=>{
    const a=point(from),b=point(to);
    ctx.moveTo(projected[a],projected[a+1]);ctx.lineTo(projected[b],projected[b+1]);
  };

  function body(context,j,x,y,heading,scale,landscape,color,skin) {
    ctx=context;
    const cos=Math.cos(heading),sin=Math.sin(heading),height=.85;
    for(let k=0,n=0;k<j.length;k+=3){
      const side=cos*j[k]+sin*j[k+2],ahead=-sin*j[k]+cos*j[k+2];
      projected[n++]=(x+side-(landscape?j[k+1]*height:0))*scale;
      projected[n++]=(y+ahead-(landscape?0:j[k+1]*height))*scale;
    }
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#15262b';ctx.lineWidth=Math.max(1.7,scale*.21);ctx.beginPath();
    line(J.hipL,J.kneeL);line(J.hipR,J.kneeR);line(J.ankleL,J.bootL);line(J.ankleR,J.bootR);ctx.stroke();
    ctx.strokeStyle='#e2ebde';ctx.lineWidth=Math.max(1.2,scale*.12);ctx.beginPath();
    line(J.kneeL,J.ankleL);line(J.kneeR,J.ankleR);ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,scale*.20);ctx.beginPath();
    line(J.shoulderL,J.elbowL);line(J.shoulderR,J.elbowR);ctx.stroke();
    ctx.lineWidth=Math.max(3.1,scale*.39);ctx.beginPath();line(J.pelvis,J.chest);ctx.stroke();
    ctx.strokeStyle=skin;ctx.lineWidth=Math.max(1.15,scale*.104);ctx.beginPath();
    line(J.elbowL,J.handL);line(J.elbowR,J.handR);ctx.stroke();
    const head=point(J.head);ctx.beginPath();ctx.arc(projected[head],projected[head+1],Math.max(1.4,scale*.122),0,Math.PI*2);
    ctx.fillStyle=skin;ctx.fill();
  }

  return function draw(context,state,team,index,player,x,y,heading,scale,landscape,elapsed,subtick,color,snap) {
    const home=team===SIDES[0],slot=(home?0:11)+index,clock=players[slot];
    if(player.sentOff){clock.previousX=NaN;return;}
    const owns=state.ball?.owner?.team===team&&state.ball.owner.index===index;
    const charge=owns?Math.max(state.shotCharge||0,state.passCharge||0)/18:0;
    const j=samplePlayerStride(clock,player,x,y,heading,elapsed,subtick,snap,charge);
    const px=x*scale,py=y*scale,r=Math.max(4,scale*.62),focused=home&&index===state.controlled;
    context.beginPath();context.ellipse(px,py,r,r*.69,0,0,Math.PI*2);context.fillStyle='#0a201e91';context.fill();
    if(focused){context.strokeStyle='#eaffab';context.lineWidth=1.5;context.stroke();}
    const skin=SKIN[slot%SKIN.length];
    // The focused player's pose is continuous. Other players reuse a bounded
    // sprite sheet for matching headings and phases instead of redrawing joints.
    if(!painter||focused){
      body(context,j,x,y,heading,scale,landscape,color,skin);
      return;
    }
    const angle=(Math.round(heading/(Math.PI*2)*ANGLES)+ANGLES)%ANGLES;
    const speed=Math.hypot(player.vx||0,player.vy||0);
    const frame=player.kick>0?24+Math.min(7,player.kick):player.tackle>0?32+Math.min(7,player.tackle):
      speed<.28?0:(speed>6?16:8)+Math.floor(clock.phase*8);
    const kit=index===0?(home?0:1):(home?2:3);
    const key=((((kit*4+slot%SKIN.length)*2+Number(landscape))*ANGLES+angle)*40)+frame;
    let tile=tiles.get(key);
    if(tile===undefined){
      tile=nextTile;nextTile=(nextTile+1)%keys.length;
      if(keys[tile]!==-1)tiles.delete(keys[tile]);
      keys[tile]=key;tiles.set(key,tile);
      const sx=tile%GRID*TILE,sy=Math.floor(tile/GRID)*TILE;
      painter.clearRect(sx,sy,TILE,TILE);painter.save();
      painter.beginPath();painter.rect(sx,sy,TILE,TILE);painter.clip();
      painter.translate(sx+ANCHOR,sy+ANCHOR);
      body(painter,j,0,0,angle/ANGLES*Math.PI*2,ATLAS_SCALE,landscape,color,skin);
      painter.restore();
    }
    const size=TILE*scale/ATLAS_SCALE;
    context.drawImage(atlas,tile%GRID*TILE,Math.floor(tile/GRID)*TILE,TILE,TILE,px-size/2,py-size/2,size,size);
  };
}
