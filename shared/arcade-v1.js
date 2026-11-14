// Deterministic 5-a-side simulation shared by the client and replay validator.
// No rendering, clocks, network or client-supplied scores are used here.
export const ARCADE_VERSION=1;
export const STEP_MS=50,INPUT_MS=100,DURATION_MS=60000,INPUT_COUNT=DURATION_MS/INPUT_MS;
export const FIELD={width:40,length:64,goalWidth:8,goalHeight:2.4};
export const DIRECTIONS=[[0,0],[0,-1],[Math.SQRT1_2,-Math.SQRT1_2],[1,0],[Math.SQRT1_2,Math.SQRT1_2],[0,1],[-Math.SQRT1_2,Math.SQRT1_2],[-1,0],[-Math.SQRT1_2,-Math.SQRT1_2]];
const dt=STEP_MS/1000,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const length=(x,y)=>Math.sqrt(x*x+y*y);
const q=n=>Math.round(n*10000)/10000;
const distance=(a,b)=>length(a.x-b.x,a.y-b.y);
function random(s){let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function hash(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0||1;}
const positions=[[0,28],[-10,12],[10,12],[-8,0],[0,2]];
function formation(team){const sign=team==='home'?1:-1;return positions.map(([x,y],i)=>({x:x*sign,y:y*sign,vx:0,vy:0,facingX:0,facingY:-sign,keeper:i===0,cooldown:0,energy:100,dive:0}));}
export function createArcade(seed,config={}){
 const personalIndex=Object.hasOwn({ANG:4,MID:3,FOR:1,'MÅL':0},config.personalPosition)?({ANG:4,MID:3,FOR:1,'MÅL':0})[config.personalPosition]:null;
 return {version:ARCADE_VERSION,tactic:['attacking','defensive'].includes(config.tactic)?config.tactic:'balanced',tick:0,rng:hash(seed),homeRating:clamp(Number(config.homeRating)||48,1,99),awayRating:clamp(Number(config.awayRating)||48,1,99),skills:{technique:clamp(Number(config.technique)||48,1,99),physical:clamp(Number(config.physical)||48,1,99),reading:clamp(Number(config.reading)||48,1,99)},personalIndex,personalRating:clamp(Number(config.personalRating)||Number(config.homeRating)||48,1,99),startingEnergy:clamp(Number(config.fitness) || 100,25,100),home:formation('home'),away:formation('away'),controlled:personalIndex??4,homeScore:0,awayScore:0,lastMask:0,freeze:0,events:[],stats:{homeShots:0,awayShots:0,passes:0,tackles:0,userGoals:0,userAssists:0,userSaves:0,userPasses:0,userPassAttempts:0,userTackles:0},ball:{x:0,y:1.2,z:.22,vx:0,vy:0,vz:0,owner:{team:'home',index:4},protected:20,lastTeam:'home',flight:0,passTarget:null}};
}
export function validateMask(mask){return Number.isInteger(mask)&&mask>=0&&mask<128&&(mask&15)<=8;}
export function encodeInputs(inputs){return btoa(String.fromCharCode(...inputs));}
export function decodeInputs(value){
 if(typeof value!=='string'||value.length!==INPUT_COUNT/3*4||!/^[A-Za-z0-9+/]+$/.test(value))throw Error('Ugyldigt kampforløb.');
 const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 if(data.length!==INPUT_COUNT||!data.every(validateMask))throw Error('Ugyldig kampstyring.');
 return data;
}
function move(p,tx,ty,speed){const dx=tx-p.x,dy=ty-p.y,d=length(dx,dy);p.vx=d>.15?dx/d*speed:0;p.vy=d>.15?dy/d*speed:0;if(d>.15){p.facingX=dx/d;p.facingY=dy/d;}p.x=q(clamp(p.x+p.vx*dt,-19,19));p.y=q(clamp(p.y+p.vy*dt,-30,30));p.vx=q(p.vx);p.vy=q(p.vy);p.facingX=q(p.facingX);p.facingY=q(p.facingY);}
function kick(s,team,index,shoot,mask=0){
 const p=s[team][index],b=s.ball;if(p.cooldown>0||b.owner?.team!==team||b.owner?.index!==index)return;
 const forward=team==='home'?-1:1;
 let tx,ty,speed,vz;
 if(shoot){
  const [dx]=DIRECTIONS[mask&15]||DIRECTIONS[0];
  const aim=Math.abs(dx)>.2?dx*2.9:p.x!==0?-Math.sign(p.x)*2.7:(random(s)<.5?-2.7:2.7);
  const rating=team==='home'?(s.personalIndex===index?s.skills.technique:s.homeRating):s.awayRating;
  b.lastShooter={team,index};b.assist=b.lastPassFrom?.team===team?b.lastPassFrom:null;b.lastPassFrom=null;b.shot=true;
  tx=aim+(random(s)-.5)*(1.8-rating/100);ty=forward*34;
  speed=(mask&64)?28:23;vz=(mask&64)?5.8:3.7;
  s.stats[team==='home'?'homeShots':'awayShots']++;
 }else{
  let best=1,bestScore=-Infinity;
  const [dx,dy]=DIRECTIONS[mask&15]||[0,forward];
  s[team].forEach((mate,i)=>{if(i===index||i===0)return;const d=distance(p,mate);const direction=d?((mate.x-p.x)*dx+(mate.y-p.y)*(dy||forward))/d:0;const score=direction*12+(mate.y-p.y)*forward*.3-d*.12;if(score>bestScore){best=i;bestScore=score;}});
  if(team==='home'&&s.personalIndex!==null&&index!==s.personalIndex&&s.callForPass>0){best=s.personalIndex;s.callForPass=0;}
  b.lastPassFrom={team,index};b.lastShooter=null;b.shot=false;
  const target=s[team][best];tx=target.x+target.vx*.25;ty=target.y+target.vy*.25;speed=17;vz=0;b.passTarget={team,index:best};if(team==='home'){s.stats.passes++;if(index===s.personalIndex)s.stats.userPassAttempts++;}
 }
 const dx=tx-b.x,dy=ty-b.y,d=length(dx,dy)||1;
 b.owner=null;b.vx=dx/d*speed;b.vy=dy/d*speed;b.vz=vz;b.z=.24;b.lastTeam=team;b.protected=4;b.flight=0;if(shoot)b.passTarget=null;p.cooldown=shoot?18:9;
}
function kickoff(s,team){const energy=s.personalIndex!==null?s.home[s.personalIndex].energy:null;s.home=formation('home');s.away=formation('away');if(energy!==null)s.home[s.personalIndex].energy=energy;s.controlled=s.personalIndex??4;s.ball={x:0,y:team==='home'?1.2:-1.2,z:.22,vx:0,vy:0,vz:0,owner:{team,index:4},protected:24,lastTeam:team,flight:0,passTarget:null};s.freeze=20;}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return length(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function ai(s,team){
 const players=s[team],others=s[team==='home'?'away':'home'],b=s.ball,forward=team==='home'?-1:1,rating=team==='home'?s.homeRating:s.awayRating,intent=team==='home'?(s.tactic==='attacking'?1:s.tactic==='defensive'?-1:0):0;
 const closest=players.map((p,i)=>({i,d:distance(p,b)})).filter(x=>x.i>0).sort((a,b)=>a.d-b.d).slice(0,intent<0?1:2).map(x=>x.i);
 for(let i=0;i<players.length;i++){
  const p=players[i];if(team==='home'&&i===s.controlled)continue;
  if(p.keeper){
   if(b.owner?.team===team&&b.owner.index===i){if(p.cooldown<=0)kick(s,team,i,false);}
   const reaction=6-Math.floor(rating/25),tracking=b.owner||b.flight>reaction;
   move(p,tracking?clamp(b.x*.7,-3.3,3.3):0,-forward*28,4+rating*.008);continue;
  }
  const speed=5.0+rating*.019;
  if(b.owner?.team===team&&b.owner.index===i){
   const near=others.filter(x=>!x.keeper).some(x=>distance(p,x)<2.6);
   if(p.y*forward>10-intent*2&&Math.abs(p.x)<16&&p.cooldown<=0){kick(s,team,i,true);continue;}
   if(near&&random(s)<.055&&p.cooldown<=0){kick(s,team,i,false);continue;}
   const obstacle=others.find(x=>!x.keeper&&distance(p,x)<4);
   move(p,clamp(p.x+(obstacle?(p.x>=obstacle.x?4:-4):p.x>6?-2:p.x< -6?2:0),-15,15),forward*29,speed);
  }else if(!b.owner||b.owner.team!==team){
   if(closest.includes(i)||b.passTarget?.team===team&&b.passTarget.index===i)move(p,b.x+b.vx*.08,b.y+b.vy*.08,speed);
   else{const anchor=positions[i],sign=team==='home'?1:-1;move(p,anchor[0]*sign+b.x*.1,clamp(anchor[1]*sign+b.y*.25+forward*intent*3,-25,25),speed*.8);}
  }else{const sign=team==='home'?1:-1;move(p,positions[i][0]*sign+b.x*.2,clamp(b.y-forward*(i<3?10:-7)+forward*intent*3,-25,25),speed*.85);}
 }
}
export function stepArcade(s,mask){
 if(!validateMask(mask))throw Error('Ugyldig kampstyring.');
 if(s.tick>=DURATION_MS/STEP_MS)return s;
 if(s.tick===0&&s.personalIndex!==null)s.home[s.personalIndex].energy=s.startingEnergy;
 s.tick++;s.callForPass=Math.max(0,(s.callForPass||0)-1);for(const team of ['home','away'])for(const p of s[team]){p.cooldown=Math.max(0,p.cooldown-1);p.dive=Math.max(0,p.dive-1);}
 const b=s.ball;b.protected=Math.max(0,b.protected-1);
 if(s.freeze>0){s.freeze--;s.lastMask=mask;return s;}
 const controlled=s.home[s.controlled],direction=DIRECTIONS[mask&15],sprinting=!!(mask&64)&&controlled.energy>0&&(mask&15)!==0;
 controlled.energy=clamp(controlled.energy+(sprinting?-(s.personalIndex!==null?26-s.skills.physical*.1:22):(s.personalIndex!==null?10+s.skills.physical*.04:13))*dt,0,100);
 const speed=(6.25+(s.personalIndex!==null?s.personalRating:s.homeRating)*.008)*(sprinting?1.35:1);
 move(controlled,controlled.x+direction[0]*10,controlled.y+direction[1]*10,(mask&15)?speed:0);
 if((mask&32)&&!(s.lastMask&32)){
  if(b.owner?.team==='home'&&b.owner.index===s.controlled)kick(s,'home',s.controlled,false,mask);
  else if(s.personalIndex!==null){s.callForPass=20;const owner=b.owner;if(owner?.team==='home')kick(s,'home',owner.index,false,mask);}
  else{s.controlled=s.home.map((p,i)=>({i,d:distance(p,b)})).filter(x=>x.i>0).sort((a,b)=>a.d-b.d)[0].i;}
 }
 if((mask&16)&&!(s.lastMask&16)){
  if(b.owner?.team==='home'&&b.owner.index===s.controlled)kick(s,'home',s.controlled,true,mask);
  else if(controlled.keeper&&controlled.energy>=10&&controlled.cooldown===0){controlled.dive=8;controlled.cooldown=20;controlled.energy-=10;}
  else if(b.owner?.team==='away'&&distance(controlled,b)<2.3&&controlled.energy>=10){controlled.energy-=10;b.protected=0;}
 }
 ai(s,'home');ai(s,'away');
 if(b.owner){
  const owner=s[b.owner.team][b.owner.index];b.x=owner.x+owner.facingX*.7;b.y=owner.y+owner.facingY*.7;b.z=.22;
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
  if(Math.abs(b.x)>20){b.x=clamp(b.x,-20,20);b.vx*=-.55;}
  let caught=false;
  if(!b.protected)for(const team of ['home','away']){
   for(let i=0;i<5;i++){
    const p=s[team][i],radius=p.keeper?(p.dive>0?1.8:.88):team==='home'&&i===s.personalIndex?.58+s.skills.reading*.003:.68,maxHeight=p.keeper?(p.dive>0?2.4:1.75):1.1;
    if(b.z<=maxHeight&&segmentDistance(p,previous,b)<radius){
     if(team==='home'&&b.passTarget?.team==='home'&&b.lastPassFrom?.index===s.personalIndex&&i!==s.personalIndex)s.stats.userPasses++;
     if(team==='home'&&i===s.personalIndex&&p.keeper&&b.shot&&b.lastShooter?.team==='away')s.stats.userSaves++;
     if(b.lastPassFrom?.team!==team)b.lastPassFrom=null;
     b.owner={team,index:i};b.protected=12;b.vx=0;b.vy=0;b.vz=0;p.cooldown=p.keeper?12:4;
     if(team==='home'&&!p.keeper&&s.personalIndex===null)s.controlled=i;caught=true;break;
    }
   }
   if(caught)break;
  }
  if(!caught&&Math.abs(b.y)>32){
   if(Math.abs(b.x)<4&&b.z<2.4){const team=b.y<0?'home':'away';if(team==='home'){if(b.lastShooter?.team==='home'&&b.lastShooter.index===s.personalIndex)s.stats.userGoals++;if(b.assist?.team==='home'&&b.assist.index===s.personalIndex&&b.lastShooter?.index!==s.personalIndex)s.stats.userAssists++;}s[team==='home'?'homeScore':'awayScore']++;s.events.push({minute:clamp(Math.ceil(s.tick/1200*90),1,90),kind:'goal',side:team,text:team==='home'?'Du spiller bolden i nettet!':'Modstanderen scorer i den spillede kamp.'});kickoff(s,team==='home'?'away':'home');}
   else{const team=b.y<0?'away':'home',keeper=s[team][0];b.x=keeper.x;b.y=keeper.y;b.z=.22;b.owner={team,index:0};b.protected=20;b.vx=0;b.vy=0;b.vz=0;keeper.cooldown=15;}
  }
 }
 for(const key of ['x','y','z','vx','vy','vz'])s.ball[key]=q(s.ball[key]);
 s.lastMask=mask;return s;
}
export function replayArcade(seed,config,inputs){
 if(inputs.length!==INPUT_COUNT)throw Error('Ufuldstændigt kampforløb.');
 const s=createArcade(seed,config);for(const mask of inputs){stepArcade(s,mask);stepArcade(s,mask);}return s;
}
