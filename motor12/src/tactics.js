import { FORMATIONS, TACTICS } from './teams.js';
import { FIELD, clamp, distanceSquared } from './physics.js';

export function pressers(team, ball) {
  let first=-1, second=-1, best=Infinity, next=Infinity;
  for (let i=1;i<team.players.length;i++) {
    const p=team.players[i];
    if(p.red) continue;
    const d=distanceSquared(p,ball);
    if(d<best){next=best;second=first;best=d;first=i;}
    else if(d<next){next=d;second=i;}
  }
  return team.press==='high'&&next<225 ? second*16+first : 15*16+first;
}
export function formationSpot(team, playerIndex, ball, hasBall, kicking, out) {
  const role=team.players[playerIndex]?.roleSlot??playerIndex;
  const [depth, lane]=FORMATIONS[team.formation][role];
  const direction=team.direction, tactic=TACTICS[team.mentality];
  if (kicking) {
    out.x=-(1-depth)*FIELD.length/2*direction;
    out.y=lane*29;
    const distance=Math.hypot(out.x,out.y);
    if(distance<FIELD.circle+1) {out.x*=10.2/distance;out.y*=10.2/distance;}
  } else {
    const progression=depth*FIELD.length-FIELD.length/2;
    out.x=clamp(progression*direction + ball.x*(hasBall?.29:.23) + tactic.push*direction
      + (hasBall?3:-3)*direction,-50,50);
    out.y=clamp(lane*29*tactic.width*(hasBall?1:.86)+ball.y*.18,-32.5,32.5);
  }
  return out;
}
export function passingOption(team, opposition, carrier) {
  let best=null, score=-Infinity;
  for (const target of team.players) {
    if(target===carrier || target.red || target.slot===0) continue;
    const dx=target.x-carrier.x,dy=target.y-carrier.y, length=Math.hypot(dx,dy);
    if(length<4||length>36) continue;
    let danger=0, space=100;
    for(const marker of opposition.players) {
      if(marker.red) continue;
      const along=((marker.x-carrier.x)*dx+(marker.y-carrier.y)*dy)/(length*length);
      if(along>.1&&along<.93){
        const gap=Math.hypot(marker.x-carrier.x-along*dx,marker.y-carrier.y-along*dy);
        if(gap<3.2) danger+=3.2-gap;
      }
      space=Math.min(space,distanceSquared(target,marker));
    }
    const value=clamp(dx*team.direction,-12,17)*(.35+TACTICS[team.mentality].risk)
      +clamp(Math.sqrt(space),0,10)*.85-danger*2.7-length*.12 + (target.skill-65)*.07;
    if(value>score){score=value;best=target;}
  }
  return best;
}
