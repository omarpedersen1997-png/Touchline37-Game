// Deterministic eleven-a-side simulation shared by the client and replay validator.
// No rendering, clocks, network or client-supplied scores are used here.
export const ARCADE_VERSION=4;
export const STEP_MS=50,INPUT_MS=50,DURATION_MS=60000,INPUT_COUNT=DURATION_MS/INPUT_MS;
export const FIELD={width:60,length:96,goalWidth:8,goalHeight:2.4};
export const SHOOT=256,PASS=512,SPRINT=1024,SHOOT_HELD=2048,PASS_HELD=4096,SKILL=8192;
export const DIRECTIONS=[[0,0],...Array.from({length:32},(_,i)=>[Math.sin(i*Math.PI/16),-Math.cos(i*Math.PI/16)])];
export function directionMask(x,y){const magnitude=Math.hypot(x,y);if(magnitude<.18)return 0;const direction=((Math.round(Math.atan2(x,-y)/(Math.PI/16))+32)%32)+1;return direction|(Math.min(3,Math.max(1,Math.ceil(Math.min(1,magnitude)*3)))<<6);}

const dt=STEP_MS/1000,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const length=(x,y)=>Math.sqrt(x*x+y*y);
const q=n=>Math.round(n*10000)/10000;
const distance=(a,b)=>length(a.x-b.x,a.y-b.y);
function random(s){let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function hash(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0||1;}
const shapes={
 '4-3-3':[[0,44],[-23,28],[-8,30],[8,30],[23,28],[-17,11],[0,16],[17,11],[-22,-3],[22,-3],[0,2]],
 '4-4-2':[[0,44],[-23,28],[-8,30],[8,30],[23,28],[-22,9],[-7,13],[7,13],[22,9],[-8,2],[8,2]],
 '3-5-2':[[0,44],[-17,29],[0,31],[17,29],[-25,13],[-13,11],[0,17],[13,11],[25,13],[-8,2],[8,2]],
 '4-5-1':[[0,44],[-23,28],[-8,30],[8,30],[23,28],[-24,9],[-12,13],[0,18],[12,13],[24,9],[0,2]]
};
function formation(team,shape){const sign=team==='home'?1:-1;return shape.map(([x,y],i)=>({x:x*sign,y:y*sign,vx:0,vy:0,facingX:0,facingY:-sign,keeper:i===0,cooldown:0,energy:100,dive:0}));}
export function createArcade(seed,config={}){
 const shape=shapes[config.formation]||shapes['4-3-3'];
 const personalIndex=Object.hasOwn({ANG:10,MID:6,FOR:2,'MÅL':0},config.personalPosition)?({ANG:10,MID:6,FOR:2,'MÅL':0})[config.personalPosition]:null;
 return {version:ARCADE_VERSION,positions:shape,field:FIELD,tactic:['attacking','defensive'].includes(config.tactic)?config.tactic:'balanced',tick:0,rng:hash(seed),homeRating:clamp(Number(config.homeRating)||48,1,99),awayRating:clamp(Number(config.awayRating)||48,1,99),skills:{technique:clamp(Number(config.technique)||48,1,99),physical:clamp(Number(config.physical)||48,1,99),reading:clamp(Number(config.reading)||48,1,99)},personalIndex,personalRating:clamp(Number(config.personalRating)||Number(config.homeRating)||48,1,99),startingEnergy:clamp(Number(config.fitness) || 100,25,100),home:formation('home',shape),away:formation('away',shape),controlled:personalIndex??10,homeScore:0,awayScore:0,lastMask:0,freeze:0,events:[],stats:{homeShots:0,awayShots:0,passes:0,tackles:0,userGoals:0,userAssists:0,userSaves:0,userPasses:0,userPassAttempts:0,userTackles:0},ball:{x:0,y:1.2,z:.22,vx:0,vy:0,vz:0,owner:{team:'home',index:10},protected:20,lastTeam:'home',flight:0,passTarget:null}};
}
export function validateMask(mask){return Number.isInteger(mask)&&mask>=0&&mask<16384&&(mask&63)<=32&&((mask&63)===0?((mask>>6)&3)===0:((mask>>6)&3)>0);}
export function encodeInputs(inputs){if(inputs.length!==INPUT_COUNT||!Array.from(inputs).every(validateMask))throw Error('Ufuldstændigt kampforløb.');const bytes=new Uint8Array(INPUT_COUNT*2);inputs.forEach((mask,i)=>{bytes[i*2]=mask&255;bytes[i*2+1]=mask>>8;});return btoa(String.fromCharCode(...bytes));}
export function decodeInputs(value){
 if(typeof value!=='string'||value.length!==INPUT_COUNT*2/3*4||!/^[A-Za-z0-9+/]+$/.test(value))throw Error('Ugyldigt kampforløb.');
 const raw=atob(value),data=Uint16Array.from({length:INPUT_COUNT},(_,i)=>raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8));
 if(!data.every(validateMask))throw Error('Ugyldig kampstyring.');return data;
}
function move(p,tx,ty,speed){
 const dx=tx-p.x,dy=ty-p.y,d=length(dx,dy),wanted=d>.15?Math.min(speed,d/dt):0;
 const vx=d?dx/d*wanted:0,vy=d?dy/d*wanted:0,change=length(vx-p.vx,vy-p.vy),acceleration=(wanted?30:40)*dt;
 const blend=change>acceleration?acceleration/change:1;p.vx+=(vx-p.vx)*blend;p.vy+=(vy-p.vy)*blend;
 if(length(p.vx,p.vy)>.3){const r=length(p.vx,p.vy);p.facingX=p.vx/r;p.facingY=p.vy/r;}
 p.x=q(clamp(p.x+p.vx*dt,-29.7,29.7));p.y=q(clamp(p.y+p.vy*dt,-47.5,47.5));
 for(const key of ['vx','vy','facingX','facingY'])p[key]=q(p[key]);
}
// Directional pass assistance penalizes opponents standing in the passing lane.
export function passTarget(s,team,index,mask=0){
 const p=s[team][index],forward=team==='home'?-1:1,[dx,dy]=DIRECTIONS[mask&63]||[0,forward],others=s[team==='home'?'away':'home'];
 let best=null,bestScore=-Infinity;
 s[team].forEach((mate,i)=>{if(i===index)return;const d=distance(p,mate);if(d<2)return;const direction=((mate.x-p.x)*dx+(mate.y-p.y)*(dy||forward))/(d||1),danger=others.reduce((sum,op)=>sum+(segmentDistance(op,p,mate)<1.6?1:0),0),score=direction*22+(mate.y-p.y)*forward*.15-Math.abs(d-17)*.13-danger*9-(i===0?9:0);if(score>bestScore){best=i;bestScore=score;}});
 return best;
}
// Four solver passes resolve groups without allowing visible body overlap.
function separate(s){const all=[...s.home,...s.away],radius=1.16;for(let pass=0;pass<4;pass++)for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j],dx=b.x-a.x,dy=b.y-a.y,d=length(dx,dy);if(d>=radius)continue;const angle=(i*17+j*11)*2.399963229728653,nx=d>.0001?dx/d:Math.cos(angle),ny=d>.0001?dy/d:Math.sin(angle),push=(radius-d)/2;for(const [p,sign]of[[a,-1],[b,1]]){p.x=q(clamp(p.x+nx*push*sign,-29.7,29.7));p.y=q(clamp(p.y+ny*push*sign,-47.5,47.5));}}}

function restart(s,team,kind,x,y){
 let index=kind==='goal-kick'?0:s[team].map((p,i)=>({i,d:length(p.x-x,p.y-y)})).filter(p=>p.i>0).sort((a,b)=>a.d-b.d)[0].i;
 const p=s[team][index];p.x=x;p.y=y;p.vx=0;p.vy=0;p.cooldown=0;
 if(team==='home'&&s.personalIndex===null)s.controlled=index;
 s.ball={x,y,z:.22,vx:0,vy:0,vz:0,owner:{team,index},protected:20,lastTeam:team,flight:0,passTarget:null};
 s.restart={kind,team,tick:s.tick};s.freeze=10;s.shotCharge=0;s.passCharge=0;
}
function kick(s,team,index,shoot,mask=0){
 const p=s[team][index],b=s.ball;if(p.cooldown>0||b.owner?.team!==team||b.owner?.index!==index)return;
 const forward=team==='home'?-1:1;
 let tx,ty,speed,vz;
 if(shoot){
  const [dx]=DIRECTIONS[mask&63]||DIRECTIONS[0];
  const aim=Math.abs(dx)>.2?dx*2.9:p.x!==0?-Math.sign(p.x)*2.7:(random(s)<.5?-2.7:2.7);
  const rating=team==='home'?(s.personalIndex===index?s.skills.technique:s.homeRating):s.awayRating;
  b.lastShooter={team,index};b.assist=b.lastPassFrom?.team===team?b.lastPassFrom:null;b.lastPassFrom=null;b.shot=true;
  tx=aim+(random(s)-.5)*(1.8-rating/100);ty=forward*50;
  const power=team==='home'&&index===s.controlled?Math.max(.2,(s.shotCharge||0)/18):.6;speed=24+power*15;vz=2.1+power*4.8;s.lastAction={kind:'shot',team,index,power,tick:s.tick};
  s.stats[team==='home'?'homeShots':'awayShots']++;
 }else{
  let best=passTarget(s,team,index,mask);if(best===null)return;
  if(team==='home'&&s.personalIndex!==null&&index!==s.personalIndex&&s.callForPass>0){best=s.personalIndex;s.callForPass=0;}
  b.lastPassFrom={team,index};b.lastShooter=null;b.shot=false;
  const target=s[team][best];tx=target.x+target.vx*.25;ty=target.y+target.vy*.25;const loft=team==='home'&&index===s.controlled&&(s.passCharge||0)>=8;speed=loft?Math.max(24,Math.min(36,distance(p,target)*.7)):24;vz=loft?Math.max(5,Math.min(9,distance(p,target)*.16)):0;s.lastAction={kind:loft?'loft':'pass',team,index,target:best,tick:s.tick};b.passTarget={team,index:best};if(team==='home'){s.stats.passes++;if(index===s.personalIndex)s.stats.userPassAttempts++;}
 }
 const dx=tx-b.x,dy=ty-b.y,d=length(dx,dy)||1;
 b.owner=null;b.vx=dx/d*speed;b.vy=dy/d*speed;b.vz=vz;b.z=.24;b.lastTeam=team;b.protected=3;b.flight=0;if(shoot)b.passTarget=null;p.cooldown=shoot?18:9;if(team==='home'&&index===s.controlled){s.shotCharge=0;s.passCharge=0;}
}
function kickoff(s,team){const energy=s.personalIndex!==null?s.home[s.personalIndex].energy:null;s.home=formation('home',s.positions);s.away=formation('away',s.positions);if(energy!==null)s.home[s.personalIndex].energy=energy;s.controlled=s.personalIndex??10;s.ball={x:0,y:team==='home'?1.2:-1.2,z:.22,vx:0,vy:0,vz:0,owner:{team,index:10},protected:24,lastTeam:team,flight:0,passTarget:null};s.freeze=20;s.skillTicks=0;s.shotCharge=0;s.passCharge=0;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return length(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function ai(s,team){
 const players=s[team],others=s[team==='home'?'away':'home'],b=s.ball,forward=team==='home'?-1:1,rating=team==='home'?s.homeRating:s.awayRating,intent=team==='home'?(s.tactic==='attacking'?1:s.tactic==='defensive'?-1:0):0;
 const closest=players.map((p,i)=>({i,d:distance(p,b)})).filter(x=>x.i>0).sort((a,b)=>a.d-b.d).slice(0,1).map(x=>x.i);
 for(let i=0;i<players.length;i++){
  const p=players[i];if(team==='home'&&i===s.controlled)continue;
  if(p.keeper){
   if(b.owner?.team===team&&b.owner.index===i){if(p.cooldown<=0)kick(s,team,i,false);}
   const reaction=6-Math.floor(rating/25),tracking=b.owner||b.flight>reaction;
   move(p,tracking?clamp(b.x*.7,-3.3,3.3):0,-forward*44,4+rating*.008);continue;
  }
  const speed=6.0+rating*.024;
  if(b.owner?.team===team&&b.owner.index===i){
   const near=others.filter(x=>!x.keeper).some(x=>distance(p,x)<2.6);
   if(p.y*forward>24-intent*2&&Math.abs(p.x)<20&&p.cooldown<=0){kick(s,team,i,true);continue;}
   if(near&&random(s)<.055&&p.cooldown<=0){kick(s,team,i,false);continue;}
   const obstacle=others.find(x=>!x.keeper&&distance(p,x)<4);
   move(p,clamp(p.x+(obstacle?(p.x>=obstacle.x?4:-4):p.x>6?-2:p.x< -6?2:0),-25,25),forward*45,speed);
  }else if(!b.owner||b.owner.team!==team){
   if(closest.includes(i)||b.passTarget?.team===team&&b.passTarget.index===i)move(p,b.x+b.vx*.08,b.y+b.vy*.08,speed);
   else{const anchor=s.positions[i],sign=team==='home'?1:-1;move(p,anchor[0]*sign+b.x*.1,clamp(anchor[1]*sign+b.y*.25+forward*intent*3,-41,41),speed*.8);}
  }else{const sign=team==='home'?1:-1,owner=players[b.owner.index],run=i>=8?12:i>=5?4:-12;move(p,clamp(s.positions[i][0]*sign+b.x*.18,-27,27),clamp(owner.y+forward*(run+intent*3),-42,42),speed*.9);}
 }
}
export function stepArcade(s,mask){
 if(!validateMask(mask))throw Error('Ugyldig kampstyring.');
 if(s.tick>=DURATION_MS/STEP_MS)return s;
 if(s.tick===0&&s.personalIndex!==null)s.home[s.personalIndex].energy=s.startingEnergy;
 s.tick++;s.skillCooldown=Math.max(0,(s.skillCooldown||0)-1);s.skillTicks=Math.max(0,(s.skillTicks||0)-1);s.callForPass=Math.max(0,(s.callForPass||0)-1);for(const team of ['home','away'])for(const p of s[team]){p.cooldown=Math.max(0,p.cooldown-1);p.dive=Math.max(0,p.dive-1);}
 const b=s.ball;b.protected=Math.max(0,b.protected-1);
 if(s.freeze>0){s.freeze--;s.lastMask=mask;return s;}
 const controlled=s.home[s.controlled],direction=DIRECTIONS[mask&63],magnitude=((mask>>6)&3)/3,sprinting=!!(mask&SPRINT)&&controlled.energy>0&&magnitude>0;
 const owns=b.owner?.team==='home'&&b.owner.index===s.controlled;s.shotCharge=owns&&(mask&SHOOT_HELD)?Math.min(18,(s.shotCharge||0)+1):owns?s.shotCharge||0:0;s.passCharge=owns&&(mask&PASS_HELD)?Math.min(18,(s.passCharge||0)+1):owns?s.passCharge||0:0;
 controlled.energy=clamp(controlled.energy+(sprinting?-(s.personalIndex!==null?26-s.skills.physical*.1:22):(s.personalIndex!==null?10+s.skills.physical*.04:13))*dt,0,100);
 if(owns&&(mask&SKILL)&&!(s.lastMask&SKILL)&&!s.skillCooldown&&controlled.energy>=15){s.skillCooldown=100;s.skillTicks=10;controlled.energy-=15;b.protected=Math.max(b.protected,12);s.lastAction={kind:'skill',team:'home',index:s.controlled,tick:s.tick};}
 const speed=(7.5+(s.personalIndex!==null?s.personalRating:s.homeRating)*.008)*(sprinting?1.35:1);
 move(controlled,controlled.x+direction[0]*10,controlled.y+direction[1]*10,speed*magnitude*(s.skillTicks>0?1.18:1));
 if((mask&PASS)&&!(s.lastMask&PASS)){
  if(b.owner?.team==='home'&&b.owner.index===s.controlled)kick(s,'home',s.controlled,false,mask);
  else if(s.personalIndex!==null){s.callForPass=20;const owner=b.owner;if(owner?.team==='home')kick(s,'home',owner.index,false,mask);}
  else{s.controlled=s.home.map((p,i)=>({i,d:distance(p,b)})).filter(x=>x.i>0).sort((a,b)=>a.d-b.d)[0].i;}
 }
 if((mask&SHOOT)&&!(s.lastMask&SHOOT)){
  if(b.owner?.team==='home'&&b.owner.index===s.controlled)kick(s,'home',s.controlled,true,mask);
  else if(controlled.keeper&&controlled.energy>=10&&controlled.cooldown===0){controlled.dive=8;controlled.cooldown=20;controlled.energy-=10;}
  else if(controlled.cooldown===0&&controlled.energy>=10){controlled.energy-=10;controlled.cooldown=14;if(b.owner?.team==='away'&&distance(controlled,b)<2.3&&random(s)<.55+(s.personalIndex!==null?s.skills.reading:s.homeRating)/300){b.owner={team:'home',index:s.controlled};b.protected=12;b.lastPassFrom=null;b.lastShooter=null;b.shot=false;s.stats.tackles++;if(s.controlled===s.personalIndex)s.stats.userTackles++;s.lastAction={kind:'tackle',team:'home',index:s.controlled,tick:s.tick};}}
 }
 ai(s,'home');ai(s,'away');separate(s);
 if(!(mask&SHOOT_HELD)&&!(mask&SHOOT))s.shotCharge=0;if(!(mask&PASS_HELD)&&!(mask&PASS))s.passCharge=0;
 if(b.owner){
  const owner=s[b.owner.team][b.owner.index];b.lastTeam=b.owner.team;b.x=clamp(owner.x+owner.facingX*.7,-29.8,29.8);b.y=clamp(owner.y+owner.facingY*.7,-47.8,47.8);b.z=.22;if(s.skillTicks>0&&b.owner.team==='home'&&b.owner.index===s.controlled){const angle=(1-s.skillTicks/10)*Math.PI*2,fx=owner.facingX,fy=owner.facingY;b.x=clamp(owner.x+(fx*Math.cos(angle)-fy*Math.sin(angle))*.7,-29.8,29.8);b.y=clamp(owner.y+(fx*Math.sin(angle)+fy*Math.cos(angle))*.7,-47.8,47.8);}
  const opponents=s[b.owner.team==='home'?'away':'home'];
  if(b.protected===0){const index=opponents.findIndex(p=>!p.keeper&&p.cooldown===0&&distance(p,owner)<1.25);
   if(index>=0){const team=b.owner.team==='home'?'away':'home';const rating=team==='home'?s.homeRating:s.awayRating;
    opponents[index].cooldown=13;
    if(random(s)<.25+rating/220){b.owner={team,index};b.protected=13;if(team==='home'){if(s.personalIndex===null)s.controlled=index;if(index===s.personalIndex)s.stats.userTackles++;s.stats.tackles++;}}
   }
  }
 }else{
  const previous={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vz-=9.81*dt;b.flight++;
  if(b.z<.22){b.z=.22;b.vz=Math.abs(b.vz)>.9?-b.vz*.32:0;b.vx*=.976;b.vy*=.976;}
  if(Math.abs(b.x)>30){restart(s,b.lastTeam==='home'?'away':'home','throw-in',Math.sign(b.x)*29,clamp(b.y,-46,46));s.lastMask=mask;return s;}
  let caught=false;
  if(!b.protected)for(const team of ['home','away']){
   for(let i=0;i<s[team].length;i++){
    const p=s[team][i],radius=p.keeper?(p.dive>0?1.8:.88):team==='home'&&i===s.personalIndex?.58+s.skills.reading*.003:.68,maxHeight=p.keeper?(p.dive>0?2.4:1.75):1.1;
    if(b.z<=maxHeight&&segmentDistance(p,previous,b)<radius){
     if(team==='home'&&b.passTarget?.team==='home'&&b.lastPassFrom?.index===s.personalIndex&&i!==s.personalIndex)s.stats.userPasses++;
     if(team==='home'&&i===s.personalIndex&&p.keeper&&b.shot&&b.lastShooter?.team==='away')s.stats.userSaves++;
     if(b.lastPassFrom?.team!==team)b.lastPassFrom=null;
     b.owner={team,index:i};b.lastTeam=team;b.protected=12;b.vx=0;b.vy=0;b.vz=0;p.cooldown=p.keeper?12:4;
     if(team==='home'&&!p.keeper&&s.personalIndex===null)s.controlled=i;caught=true;break;
    }
   }
   if(caught)break;
  }
  if(!caught&&Math.abs(b.y)>48){
   if(Math.abs(b.x)<4&&b.z<2.4){const team=b.y<0?'home':'away';if(team==='home'){if(b.lastShooter?.team==='home'&&b.lastShooter.index===s.personalIndex)s.stats.userGoals++;if(b.assist?.team==='home'&&b.assist.index===s.personalIndex&&b.lastShooter?.index!==s.personalIndex)s.stats.userAssists++;}s[team==='home'?'homeScore':'awayScore']++;s.events.push({minute:clamp(Math.ceil(s.tick/1200*90),1,90),kind:'goal',side:team,text:team==='home'?'Du spiller bolden i nettet!':'Modstanderen scorer i den spillede kamp.'});kickoff(s,team==='home'?'away':'home');}
   else{const defending=b.y<0?'away':'home',corner=b.lastTeam===defending;restart(s,corner?(defending==='home'?'away':'home'):defending,corner?'corner':'goal-kick',corner?(b.x>=0?29:-29):0,Math.sign(b.y)*(corner?46:43));}
  }
 }
 for(const key of ['x','y','z','vx','vy','vz'])s.ball[key]=q(s.ball[key]);
 s.lastMask=mask;return s;
}
export function replayArcade(seed,config,inputs){
 if(inputs.length!==INPUT_COUNT)throw Error('Ufuldstændigt kampforløb.');
 const s=createArcade(seed,config);for(const mask of inputs){stepArcade(s,mask);}return s;
}
