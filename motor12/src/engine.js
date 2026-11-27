import {HOME, LEAGUE, FORMATIONS, TACTICS, PRESS, makeSquad} from './teams.js';
import {FIELD, STEP, clamp, distanceSquared, kickBall, integrateBall, movePlayer} from './physics.js';
import {formationSpot, passingOption, pressers} from './tactics.js';

export const VERSION = 12;
export const PHASE = {PRE_KICKOFF:'PRE_KICKOFF', KICKOFF_READY:'KICKOFF_READY', PLAYING:'PLAYING', DEAD_BALL:'DEAD_BALL', FULL_TIME:'FULL_TIME'};
export const HALF_TICKS = 30*90;
const CLOCK_PER_TICK = 45*60/HALF_TICKS;
const MAX_SUBS = 5;
const halfLength = FIELD.length/2, halfWidth = FIELD.width/2;
const newBall = () => ({x:0,y:0,z:.11,vx:0,vy:0,vz:0,spin:0,owner:-1,lastTeam:-1,lastSlot:-1,target:-1,age:0,shotXg:0,kind:'loose'});
const freshStats = () => ({goals:0, shots:0, onTarget:0, xg:0, passes:0, complete:0, possession:0, corners:0, fouls:0, saves:0});
const newPlayer = (p,slot) => ({...p,slot,x:0,y:0,vx:0,vy:0,fx:1,fy:0,wait:0,yellow:0,red:false,minutes:0,impact:0});
const playerId = (side,slot) => side*16+slot;
function makeTeam(definition, side, squad) {
  const players=squad || makeSquad(definition,side);
  return {...definition, direction:side?-1:1, mentality:'balanced', press:'medium',
    players:players.slice(0,11).map(newPlayer), bench:players.slice(11), used:[], subs:0, stats:freshStats()};
}
function draw(s) {
  let x=s.rng;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  s.rng=x>>>0;
  return s.rng/4294967296;
}
export function minute(s) {return Math.min(90,Math.max(0,Math.floor(s.tick*CLOCK_PER_TICK/60)));}
export function timeLabel(s) {
  const secs=Math.floor(s.tick*CLOCK_PER_TICK);
  return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
}
function event(s, kind, side, text, subject='') {
  s.events.unshift({id:++s.eventId,tick:s.tick,minute:minute(s),kind,side,text,subject});
  if(s.events.length>56)s.events.pop();
}
function arrange(s, side, reason) {
  s.kickTeam=side;
  s.kickReason=reason;
  s.phase=reason==='start'?PHASE.PRE_KICKOFF:PHASE.KICKOFF_READY;
  s.restart=null;
  const point={};
  for(const team of s.teams)for(const p of team.players) {
    formationSpot(team,p.slot,s.ball,false,true,point);
    p.x=point.x;p.y=point.y;p.vx=0;p.vy=0;p.wait=0;p.fx=team.direction;p.fy=0;
  }
  const team=s.teams[side];
  s.kicker=team.players[9].red?(team.players.find(p=>p.slot>0&&!p.red)?.slot??0):9;
  const support=team.players.find(p=>p.slot>4&&p.slot!==s.kicker&&!p.red);
  s.support=support?.slot??team.players.find(p=>!p.red&&p.slot!==s.kicker)?.slot??s.kicker;
  Object.assign(team.players[s.kicker],{x:-.72*team.direction,y:0});
  if(s.support!==s.kicker)Object.assign(team.players[s.support],{x:-5.8*team.direction,y:2.6});
  Object.assign(s.ball,newBall());
}
export function createMatch({home=HOME, away=LEAGUE[0], roster, formation=home.formation, seed=18, id='m12-'+seed}={}) {
  const s={version:VERSION,id,rng:seed>>>0||1,phase:PHASE.PRE_KICKOFF,tick:0,half:1, kickTeam:0,
    teams:[makeTeam({...home,formation:Object.hasOwn(FORMATIONS,formation)?formation:HOME.formation},0,roster),makeTeam(away,1)],
    ball:newBall(),events:[],eventId:0,momentum:.5,restart:null,kickReason:'start',kicker:9,support:6};
  arrange(s,0,'start');
  return s;
}
function release(s, side, p, x,y, {speed,loft=0,spin=0,kind,target=-1,xg=0}) {
  const b=s.ball;
  kickBall(b,x,y,speed,loft,spin);
  Object.assign(b,{owner:-1,lastTeam:side,lastSlot:p.slot,target,age:0,kind,shotXg:xg});
  p.wait=.67;
  if(kind==='pass') s.teams[side].stats.passes++;
}
export function kickOff(s) {
  if(s.phase!==PHASE.PRE_KICKOFF && s.phase!==PHASE.KICKOFF_READY) return false;
  const side=s.kickTeam, team=s.teams[side], receiver=team.players[s.support], kicker=team.players[s.kicker];
  s.phase=PHASE.PLAYING;
  release(s,side,kicker,receiver.x,receiver.y,{speed:10,kind:'pass',target:playerId(side,receiver.slot)});
  event(s,'kickoff',side,s.kickReason==='half'?'Anden halvleg er i gang':'Afspark',team.name);
  return true;
}
export function setTactics(s, side, change) {
  const team=s.teams[side];
  if(!team||s.phase===PHASE.FULL_TIME) return false;
  const formation=Object.hasOwn(FORMATIONS,change.formation)?change.formation:team.formation;
  const mentality=Object.hasOwn(TACTICS,change.mentality)?change.mentality:team.mentality;
  const press=Object.hasOwn(PRESS,change.press)?change.press:team.press;
  if(formation===team.formation&&mentality===team.mentality&&press===team.press)return false;
  Object.assign(team,{formation,mentality,press});
  if(s.phase===PHASE.PRE_KICKOFF||s.phase===PHASE.KICKOFF_READY) arrange(s,s.kickTeam,s.kickReason);
  event(s,'tactics',side,formation+' · '+TACTICS[mentality].label,team.name);
  return true;
}
export function swapRoles(s,side,a,b) {
  const team=s.teams[side], first=team?.players[a], second=team?.players[b];
  if(!first||!second||a===b||a===0||b===0||first.red||second.red||s.phase===PHASE.FULL_TIME)return false;
  const role=first.roleSlot??a;
  first.roleSlot=second.roleSlot??b;
  second.roleSlot=role;
  if(s.phase===PHASE.PRE_KICKOFF||s.phase===PHASE.KICKOFF_READY)arrange(s,s.kickTeam,s.kickReason);
  event(s,'tactics',side,first.name+' og '+second.name+' bytter position',team.name);
  return true;
}
export function substitute(s,side,slot,benchId) {
  const team=s.teams[side], out=team?.players[slot], index=team?.bench.findIndex(p=>p.id===benchId);
  if(!out||out.red||index<0||!Number.isInteger(slot)||s.phase===PHASE.FULL_TIME||team.subs>=MAX_SUBS) return false;
  const incoming=team.bench[index];
  if((slot===0)!==(incoming.role==='MÅL')) return false;
  team.bench.splice(index,1);
  if(s.phase===PHASE.PRE_KICKOFF) team.bench.push(out);
  else {team.subs++;team.used.push(out);}
  team.players[slot]={...newPlayer(incoming,slot),roleSlot:out.roleSlot??slot,x:out.x,y:out.y,fx:out.fx,fy:out.fy};
  event(s,'sub',side,incoming.name+' ind · '+out.name+' ud',team.name);
  return true;
}
function nearestPressure(team,p) {
  let gap=100;
  for(const rival of team.players) if(!rival.red)gap=Math.min(gap,distanceSquared(p,rival));
  return Math.sqrt(gap);
}
function dribble(s, side, p, opponent) {
  const team=s.teams[side], dir=team.direction, goal=halfLength*dir;
  const distance=Math.hypot(goal-p.x,p.y);
  const pressure=nearestPressure(opponent,p);
  if(p.wait>0||s.ball.age<.23)return;
  const angle=Math.atan2(Math.abs(p.y),Math.max(1,halfLength-Math.abs(p.x)));
  const ability=(p.skill+p.form*1.5)*.0085*(.73+p.energy*.0027);
  const xg=clamp(.49*Math.exp(-distance/20)*Math.cos(angle)*(pressure>3?1.15:.81)*ability,.015,.51);
  if(p.slot!==0 && distance<29 && (distance<12||draw(s)<xg*2.9*(team.mentality==='attack'?1.28:1))) {
    const target=(draw(s)-.5)*(FIELD.goal+2.8)+(p.fy*.55);
    team.stats.shots++;
    team.stats.xg+=xg;
    p.impact+=xg*3;
    if(Math.abs(target)<FIELD.goal/2)team.stats.onTarget++;
    release(s,side,p,goal+dir,target,{speed:23+draw(s)*9,loft:1.45+draw(s)*2.6,spin:(draw(s)-.5)*.16,kind:'shot',xg});
    event(s,xg>.16?'chance':'shot',side,(xg>.16?'Stor chance · ':'Afslutning · ')+p.name,xg.toFixed(2).replace('.',',')+' xG');
  } else if(s.ball.age>1.18 || pressure<3.7) {
    const mate=passingOption(team,opponent,p);
    if(!mate)return;
    const range=Math.hypot(mate.x-p.x,mate.y-p.y);
    const loft=range>22 && draw(s)<.62;
    const drift=(draw(s)-.5)*clamp((82-p.skill)*.055+(pressure<2?1:0),.25,1.9);
    release(s,side,p,mate.x+mate.vx*.31,mate.y+mate.vy*.31+drift,
      {speed:Math.min(24,8+range*.52),loft:loft?5.2:0,spin:loft?(draw(s)-.5)*.19:0,kind:'pass',target:playerId(side,mate.slot)});
  }
}
function stageRestart(s,kind,side,x,y) {
  const team=s.teams[side];
  let p=team.players[kind==='goal-kick'?0:7];
  if(p.red)p=team.players.find(candidate=>candidate.slot>0&&!candidate.red)||team.players[0];
  p.x=x-.55*team.direction;p.y=y;p.vx=0;p.vy=0;
  Object.assign(s.ball,newBall(),{x,y});
  s.phase=PHASE.DEAD_BALL;
  s.restart={kind,side,slot:p.slot,end:s.tick+28};
  const names={'throw':'Indkast','corner':'Hjørnespark','goal-kick':'Målspark','free-kick':'Frispark'};
  event(s,'restart',side,names[kind],team.name);
}
function restartPlay(s) {
  const r=s.restart, team=s.teams[r.side], p=team.players[r.slot];
  const mate=passingOption(team,s.teams[1-r.side],p) || team.players.find(q=>q!==p&&!q.red)||p;
  release(s,r.side,p,mate.x,mate.y,{speed:r.kind==='goal-kick'?22:16,loft:r.kind==='corner'?5.5:r.kind==='throw'?3.1:r.kind==='goal-kick'?4:0,kind:'pass',target:playerId(r.side,mate.slot)});
  s.restart=null;
  s.phase=PHASE.PLAYING;
}
function goal(s, side) {
  const team=s.teams[side], p=s.ball.lastTeam===side?team.players[s.ball.lastSlot]:null;
  team.stats.goals++;
  if(p)p.impact+=3.2;
  event(s,'goal',side,'Mål til '+team.name,p?.name||'Selvmål');
  arrange(s,1-side,'goal');
}
function afterLine(s,b,previousX,previousY,previousZ) {
  const crossedX=Math.abs(b.x)>halfLength;
  const crossedY=Math.abs(b.y)>halfWidth;
  if(!crossedX&&!crossedY)return false;
  const lineX=Math.sign(b.x)*halfLength,lineY=Math.sign(b.y)*halfWidth;
  const tx=crossedX?(lineX-previousX)/(b.x-previousX):Infinity;
  const ty=crossedY?(lineY-previousY)/(b.y-previousY):Infinity;
  if(ty<tx){stageRestart(s,'throw',1-Math.max(0,b.lastTeam),clamp(previousX+(b.x-previousX)*ty,-50,50),lineY*.99);return true;}
  const side=s.teams[0].direction===Math.sign(lineX)?0:1;
  const y=previousY+(b.y-previousY)*tx,z=previousZ+(b.z-previousZ)*tx;
  const sideBar=Math.abs(Math.abs(y)-FIELD.goal/2)<.17&&z<FIELD.bar;
  const crossBar=Math.abs(z-FIELD.bar)<.16&&Math.abs(y)<FIELD.goal/2+.15;
  if(sideBar||crossBar){
    b.x=lineX-Math.sign(lineX)*.12;b.y=y;b.z=z;b.vx*=-.48;b.vy+=(y>0?-1:1)*1.1;b.kind='loose';
    event(s,'chance',side,'Træværket',s.teams[side].name);
    return true;
  }
  if(Math.abs(y)<FIELD.goal/2-.11&&z<FIELD.bar-.11){goal(s,side);return true;}
  if(b.lastTeam===1-side){s.teams[side].stats.corners++;stageRestart(s,'corner',side,lineX*.99,Math.sign(y||1)*halfWidth*.986);}
  else stageRestart(s,'goal-kick',1-side,lineX*.88,0);
  return true;
}
function controlBall(s,side,p) {
  const b=s.ball, team=s.teams[side];
  if(b.kind==='pass'&&b.lastTeam===side&&b.lastSlot!==p.slot){team.stats.complete++;p.impact+=.025;}
  if(b.kind==='shot'&&b.lastTeam!==side&&p.slot===0){
    team.stats.saves++;p.impact+=.55;
    event(s,'save',side,'Redning · '+p.name,team.name);
    if(Math.hypot(b.vx,b.vy)>17&&draw(s)>.68){
      b.vx=team.direction*5;b.vy=(p.y>0?1:-1)*8;b.vz=1.7;b.lastTeam=side;b.lastSlot=0;b.target=-1;b.age=0;b.kind='loose';
      return;
    }
  }
  b.owner=playerId(side,p.slot);b.kind='carry';b.age=0;b.target=-1;b.lastTeam=side;b.lastSlot=p.slot;
  p.wait=.22+(100-p.skill)*.004;
}
function challenge(s,side,p,owner) {
  const chance=clamp((.73+(p.skill-owner.skill)*.015)*(.7+p.energy*.003),.28,1.04);
  if(draw(s)<.055){
    const team=s.teams[side];
    team.stats.fouls++;p.yellow++;
    if(p.yellow>1)p.red=true;
    event(s,'card',side,(p.red?'Rødt kort · ':'Gult kort · ')+p.name,team.name);
    stageRestart(s,'free-kick',1-side,owner.x,owner.y);
  } else if(draw(s)<chance) controlBall(s,side,p);
  else p.wait=.6;
}
export function controlledSlot(s,input, cycle=false){
  const b=s.ball,team=s.teams[0];
  if(b.owner>=0&&b.owner<11)return b.owner;
  if(b.target>=0&&b.target<11)return b.target;
  if(!cycle&&team.players[input.slot]&&!team.players[input.slot].red)return input.slot;
  let best=-1,range=Infinity;
  for(const p of team.players){
    if(p.red||p.slot===0||(cycle&&p.slot===input.slot))continue;
    const gap=distanceSquared(p,b);
    if(gap<range){range=gap;best=p.slot;}
  }
  return best;
}
function userKick(s,p,input,action){
  const team=s.teams[0],dir=team.direction;
  if(action==='shoot'){
    const aim=clamp((input.y||p.fy)*3.3,-3.5,3.5);
    const xg=clamp(.48*Math.exp(-Math.hypot(halfLength*dir-p.x,p.y)/22),.015,.5);
    team.stats.shots++;team.stats.onTarget++;team.stats.xg+=xg;
    release(s,0,p,(halfLength+1)*dir,aim,{kind:'shot',speed:29+p.skill*.05,loft:2.6,xg});
    event(s,'shot',0,'Afslutning · '+p.name);
    return;
  }
  let mate=null,best=-Infinity;
  const aiming=Math.hypot(input.x,input.y)>.12;
  for(const q of team.players){
    if(q===p||q.red)continue;
    const dx=q.x-p.x,dy=q.y-p.y,range=Math.hypot(dx,dy)||1;
    const score=(dx*(aiming?input.x:dir)+dy*(aiming?input.y:0))/range*12-range*.32;
    if(score>best){best=score;mate=q;}
  }
  if(mate){
    const lead=action==='through'?4.5:0, x=mate.x+dir*lead,y=mate.y+mate.vy*.25;
    release(s,0,p,x,y,{kind:'pass',speed:Math.min(41,7+Math.hypot(x-p.x,y-p.y)*1.25),target:mate.slot});
  }
}
export function playerRestart(s){
  return s.phase===PHASE.DEAD_BALL&&s.restart.side===0&&
    (s.restart.kind==='free-kick'||s.restart.kind==='goal-kick');
}
function lineUpWall(s){
  const dir=s.teams[0].direction;
  const dx=halfLength*dir-s.ball.x,dy=-s.ball.y;
  const range=Math.hypot(dx,dy);
  if(range<1||range>35)return;
  const nx=dx/range,ny=dy/range;
  let count=0;
  for(const p of s.teams[1].players){
    if(p.slot===0||p.red)continue;
    const across=(count-1.5)*.88;
    p.x=clamp(s.ball.x+nx*9.15-ny*across,-halfLength+.5,halfLength-.5);
    p.y=clamp(s.ball.y+ny*9.15+nx*across,-halfWidth+.5,halfWidth-.5);
    p.vx=p.vy=0;p.fx=-nx;p.fy=-ny;
    if(++count===4)break;
  }
}
export function stepMatch(s, scratch={},input=null) {
  if(s.phase!==PHASE.PLAYING&&s.phase!==PHASE.DEAD_BALL)return false;
  if(input&&playerRestart(s)){
    const r=s.restart;
    input.slot=r.slot;
    if(!r.ready){
      if(r.kind==='free-kick')lineUpWall(s);
      r.ready=true;input.action='';
    }
    const action=input.action;
    input.action='';
    if(action==='pass'||action==='through'||action==='shoot'){
      const kicker=s.teams[0].players[r.slot];
      if(r.kind==='goal-kick'&&action==='shoot'){
        const dir=s.teams[0].direction;
        release(s,0,kicker,s.ball.x+dir*45,s.ball.y+input.y*24,{kind:'pass',speed:30,loft:8});
      }else userKick(s,kicker,input,action);
      s.restart=null;s.phase=PHASE.PLAYING;
    }
    return true;
  }
  if(s.phase===PHASE.DEAD_BALL) {s.tick++;if(s.tick>=s.restart.end)restartPlay(s);if(s.phase!==PHASE.PLAYING){checkClock(s);return true;}}
  else s.tick++;
  const dt=STEP, b=s.ball;
  const ownSide=b.owner<0?-1:b.owner>>4;
  const owner=ownSide<0?null:s.teams[ownSide].players[b.owner%16];
  const action=input?.action;
  if(input){
    if(b.owner>=16&&input.opponentPossession!==true)input.slot=-1;
    input.opponentPossession=b.owner>=16||(b.owner<0&&b.lastTeam===1);
    input.slot=controlledSlot(s,input,action==='switch');
    input.action='';
  }
  const playSide=ownSide<0?b.lastTeam:ownSide;
  if(playSide>=0)s.teams[playSide].stats.possession++;
  s.momentum+=((playSide===0?clamp(.58+b.x*.004,.25,.86):playSide===1?clamp(.42+b.x*.004,.14,.75):.5)-s.momentum)*.018;
  for(let side=0;side<2;side++){
    const team=s.teams[side], hasBall=playSide===side, hunters=pressers(team,b);
    const pressRange=team.press==='high'?28:team.press==='low'?13:19;
    for(const p of team.players){
      if(p.red)continue;
      p.wait=Math.max(0,p.wait-dt);p.minutes+=dt;
      const target=formationSpot(team,p.slot,b,hasBall,false,scratch);
      if(p.slot===0) {
        target.x=-(halfLength-1.8-clamp((halfLength+b.x*team.direction)*.06,0,4.5))*team.direction;
        target.y=clamp(b.y*.16,-4.1,4.1);
        if(!owner && b.kind==='shot' && b.vx*team.direction<-.1 && b.x*team.direction<-33){
          const until=clamp((target.x-b.x)/b.vx,0,.7);
          target.y=clamp(b.y+b.vy*until,-4.8,4.8);
        }
      } else if(p===owner) {
        target.x=p.x+11*team.direction;
        target.y=clamp(p.y*.83,-27,27);
      } else if(playerId(side,p.slot)===b.target&&!owner) {
        const intercept=clamp(Math.hypot(b.x-p.x,b.y-p.y)/(Math.hypot(b.vx,b.vy)+7),.05,.65);
        target.x=b.x+b.vx*intercept;target.y=b.y+b.vy*intercept;
      } else if((p.slot===hunters%16||p.slot===hunters>>4)&&distanceSquared(p,b)<pressRange**2&&(!hasBall||!owner)){
        target.x=b.x+b.vx*.105;target.y=b.y+b.vy*.105;
      }
      const speed=(p.slot===0?5.6:5.1+(p.skill-52)*.073)*(.67+.0033*p.energy)*(p===owner?.91:1);
      if(input&&side===0&&p.slot===input.slot&&(owner===p||input.x||input.y||b.target!==p.slot)){
        movePlayer(p,p.x+input.x*8,p.y+input.y*8,speed*(input.sprint?1.47:1),dt);
      }else movePlayer(p,target.x,target.y,speed,dt);
    }
  }
  b.age+=dt;
  if(owner){
    b.x=owner.x+owner.fx*.67;b.y=owner.y+owner.fy*.67;b.z=.11;b.vx=owner.vx;b.vy=owner.vy;
    if(b.age>.15){
      for(const p of s.teams[1-ownSide].players) {
        const manual=input&&ownSide===1&&p.slot===input.slot;
        if(!p.red&&p.slot>0&&p.wait===0&&distanceSquared(p,owner)<(manual?2.5:1.95)**2&&(manual?action==='tackle':draw(s)<.17)){
          challenge(s,1-ownSide,p,owner);break;
        }
      }
    }
    if(b.owner===playerId(ownSide,owner.slot)&&s.phase===PHASE.PLAYING){
      if(input&&ownSide===0){
        if(action==='pass'||action==='through'||action==='shoot')userKick(s,owner,input,action);
      }else dribble(s,ownSide,owner,s.teams[1-ownSide]);
    }
  }
  if(!owner||b.owner<0&&s.phase===PHASE.PLAYING){
    const bx=b.x,by=b.y,bz=b.z;
    integrateBall(b,dt);
    if(afterLine(s,b,bx,by,bz)){checkClock(s);return true;}
    let catcher=null, caughtSide=0, closest=Infinity;
    for(let side=0;side<2;side++)for(const p of s.teams[side].players){
      if(p.red||b.age<.24&&side===b.lastTeam&&p.slot===b.lastSlot)continue;
      const keeper=p.slot===0;
      const reach=keeper&&b.kind==='shot'?1.43:(b.target===playerId(side,p.slot)?1.38:.97);
      const d=distanceSquared(p,b);
      if(d<reach**2&&d<closest&&b.z<(keeper?2.18:1.26)){catcher=p;caughtSide=side;closest=d;}
    }
    if(catcher)controlBall(s,caughtSide,catcher);
  } else if(s.phase===PHASE.PLAYING) afterLine(s,b,owner.x,owner.y,.11);
  checkClock(s);
  return true;
}
function checkClock(s) {
  if(s.tick>=HALF_TICKS*2){
    s.phase=PHASE.FULL_TIME;s.restart=null;
    event(s,'full',-1,'Slutfløjt');
  } else if(s.tick>=HALF_TICKS&&s.half===1){
    s.half=2;
    for(const team of s.teams){
      team.direction*=-1;
      for(const p of team.players)p.energy=Math.min(100,p.energy+11);
    }
    event(s,'half',-1,'Halvleg');
    arrange(s,1,'half');
  }
}
