import {getArcadeRules} from '../shared/arcade.js';
const RELEASED_KICKS=new Set(['pass','through','loft','shot']);

// Extrapolation keeps open play responsive, but must not display a ball past
// an unresolved collision. Near contact, draw the authoritative state instead.
// This affects presentation only; recorded controls/physics stay unchanged.
export function safeMatchPrediction(s,seconds){
 if(s.version<7||seconds<=0)return seconds;
 const contact=s.lastContact,b=s.ball;
 // An already-owned R3 first touch is resolved: keep its visible carry moving.
 // Saves, blocks, loose-ball duels and all legacy revisions retain the guard.
 const carriedTouch=s.version===11&&s.engineRevision>=3&&b.owner&&contact?.kind==='touch'&&contact.team===b.owner.team&&contact.index===b.owner.index;
 // A new authoritative kick supersedes the previous reception. Do not retain
 // its 150ms contact hold while the ball has already left the boot. Swept
 // collision checks below still guard every receiver/defender and goalkeeper.
 const action=s.lastAction,releasedKick=s.version===11&&s.engineRevision>=3&&!b.owner&&action&&RELEASED_KICKS.has(action.kind)&&action.tick===b.lastTouchTick&&action.tick>=contact?.tick&&action.team===b.lastTouch?.team&&action.index===b.lastTouch?.index&&s.tick-action.tick>=0&&s.tick-action.tick<3;
 if(contact&&s.tick-contact.tick<3&&!carriedTouch&&!releasedKick)return 0;
 const end={x:b.x+b.vx*seconds,y:b.y+b.vy*seconds,z:b.z+b.vz*seconds},rules=getArcadeRules(s.version,s.version===11&&s.engineRevision>=3?s.engineRevision:undefined);
 for(const team of['home','away']){
  if(b.owner?.team===team)continue;
  for(let i=0;i<s[team].length;i++){
   if(b.lastTouch?.team===team&&b.lastTouch.index===i&&s.tick-(b.lastTouchTick??0)<3)continue;
   const p=s[team][i],next={x:p.x+p.vx*seconds,y:p.y+p.vy*seconds};
   // Conservative visual guard around the body/extended limb, not a new rule
   // allowing possession. The engine still requires its much tighter contact.
   if(rules.sweptContact(b,end,p,next,1.1,2.35))return 0;
  }
 }
 return seconds;
}
