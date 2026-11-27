import {FIELD} from './physics.js';

export function matchRadar(canvas){
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  const x=value=>4+(value/FIELD.length+.5)*(w-8);
  const y=value=>4+(value/FIELD.width+.5)*(h-8);
  function dot(px,py,r,color){
    ctx.beginPath();ctx.arc(x(px),y(py),r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  }
  return (match,slot)=>{
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='#e2fff19c';ctx.lineWidth=1.4;
    ctx.strokeRect(4,4,w-8,h-8);
    ctx.beginPath();ctx.moveTo(w/2,4);ctx.lineTo(w/2,h-4);ctx.stroke();
    ctx.beginPath();ctx.arc(w/2,h/2,9,0,2*Math.PI);ctx.stroke();
    for(const [side,team] of match.teams.entries()){
      for(const p of team.players){
        if(!p.red)dot(p.x,p.y,p.slot===slot&&side===0?3.8:2.5,side?'#9bc0ff':p.slot===slot?'#e8ff73':'#ff927f');
      }
    }
    dot(match.ball.x,match.ball.y,3.4,'#fff');
  };
}
