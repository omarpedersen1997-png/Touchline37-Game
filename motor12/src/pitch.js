import {FIELD, clamp} from './physics.js';
const L=FIELD.length,W=FIELD.width;
export function pitchView(canvas) {
  const ctx=canvas.getContext('2d');
  const field=document.createElement('canvas');
  const bg=field.getContext('2d');
  let ratio=1,width=1,height=1,scale=1,ox=0,oy=0;
  function layout(){
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return false;
    ratio=Math.min(1.75,window.devicePixelRatio||1);
    width=r.width;height=r.height;
    canvas.width=field.width=Math.round(width*ratio);
    canvas.height=field.height=Math.round(height*ratio);
    scale=Math.min(width/(L+10),height/(W+10));
    ox=(width-L*scale)/2;oy=(height-W*scale)/2;
    paintField();
    return true;
  }
  function paintField(){
    bg.setTransform(ratio,0,0,ratio,0,0);
    bg.fillStyle='#181826';bg.fillRect(0,0,width,height);
    bg.save();bg.translate(ox,oy);bg.scale(scale,scale);
    bg.fillStyle='#342e41';bg.fillRect(-4.5,-4.5,L+9,W+9);
    bg.fillStyle='#4b4356';
    for(let i=0;i<16;i++){
      bg.fillRect(i*L/16,-3.9,L/16-1.05,1.1);
      bg.fillRect(i*L/16,W+2.8,L/16-1.05,1.1);
    }
    const grass=bg.createLinearGradient(0,0,L,W);
    grass.addColorStop(0,'#284c38');grass.addColorStop(.5,'#3b644b');grass.addColorStop(1,'#304d3e');
    bg.fillStyle=grass;bg.fillRect(-1.32,-1.32,L+2.64,W+2.64);
    bg.fillStyle='#d4efb915';
    for(let i=0;i<12;i+=2)bg.fillRect(i*L/12,0,L/12,W);
    bg.strokeStyle='#f6eddbcc';bg.lineWidth=.25;
    bg.strokeRect(0,0,L,W);
    bg.beginPath();bg.moveTo(L/2,0);bg.lineTo(L/2,W);bg.stroke();
    bg.beginPath();bg.arc(L/2,W/2,9.15,0,Math.PI*2);bg.stroke();
    for(const edge of [0,L]){
      const sign=edge===0?1:-1;
      for(const [depth,wide] of [[16.5,40.32],[5.5,18.32]])bg.strokeRect(edge,W/2-wide/2,depth*sign,wide);
      const arcAngle=Math.acos(5.5/9.15);
      bg.beginPath();bg.arc(edge+sign*11,W/2,9.15,edge===0?-arcAngle:Math.PI-arcAngle,edge===0?arcAngle:Math.PI+arcAngle);bg.stroke();
      bg.fillStyle='#ece4e624';bg.fillRect(edge,W/2-3.66,-sign*2.1,7.32);
      bg.strokeRect(edge,W/2-3.66,-sign*2.1,7.32);
      bg.fillStyle='#e7ffe4';bg.beginPath();bg.arc(edge+sign*11,W/2,.28,0,Math.PI*2);bg.fill();
    }
    bg.fillStyle='#fff3d8';bg.beginPath();bg.arc(L/2,W/2,.32,0,Math.PI*2);bg.fill();
    bg.restore();
  }
  const px=x=>ox+(x+L/2)*scale, py=y=>oy+(y+W/2)*scale;
  function render(state, previous, alpha=1,slot=-1){
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(field,0,0);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const ball=state.ball;
    let i=0;
    const radius=clamp(scale*1.3,4.2,10.6);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 '+Math.max(8,radius*1.09)+'px system-ui';
    for(let side=0;side<2;side++){
      const team=state.teams[side];
      for(const p of team.players){
        const x=px(previous?previous[i]+(p.x-previous[i])*alpha:p.x);
        const y=py(previous?previous[i+1]+(p.y-previous[i+1])*alpha:p.y);
        i+=2;
        if(p.red)continue;
        ctx.fillStyle='#08151091';ctx.beginPath();ctx.ellipse(x+1,y+radius*.79,radius,radius*.61,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=p.slot===0?'#e7c47b':side?'#384ba1':'#a8302a';
        ctx.beginPath();
        ctx.moveTo(x-radius*.59,y-radius);ctx.lineTo(x+radius*.59,y-radius);
        ctx.lineTo(x+radius,y-radius*.61);ctx.lineTo(x+radius*.84,y+radius*.73);
        ctx.lineTo(x,y+radius);ctx.lineTo(x-radius*.84,y+radius*.73);
        ctx.lineTo(x-radius,y-radius*.61);ctx.closePath();ctx.fill();
        const carrier=slot>=0?side===0&&slot===p.slot:ball.owner===side*16+p.slot;
        ctx.strokeStyle=carrier?'#fff4d8':'#fff0cd9c';ctx.lineWidth=carrier?2:.72;ctx.stroke();
        ctx.fillStyle=p.slot===0?'#221e26':'#fffdf3';ctx.fillText(p.number,x,y+.17);
      }
    }
    const x=px(previous?previous[44]+(ball.x-previous[44])*alpha:ball.x);
    const y=py(previous?previous[45]+(ball.y-previous[45])*alpha:ball.y);
    const z=previous?previous[46]+(ball.z-previous[46])*alpha:ball.z;
    ctx.fillStyle='#071d1590';ctx.beginPath();ctx.ellipse(x,y,4.5,2.4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fdfff0';ctx.beginPath();ctx.arc(x,y-z*scale*.59,clamp(scale*.55,2.4,5),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#112a20';ctx.lineWidth=.8;ctx.stroke();
  }
  return {layout,render};
}
