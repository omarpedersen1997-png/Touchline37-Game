import {teamStrengthDetails} from '../shared/team-strength.js';
import{ensureCompetition}from'./competition.js';
import{ensureExpansion,expansionBonuses,academyDuration}from'./expansion.js';
import{effectiveRating,seeded}from'./progression.js';
export class GameError extends Error{}
export const formations={
 '4-3-3':{name:'4–3–3',roles:['MÅL',...Array(4).fill('FOR'),...Array(3).fill('MID'),...Array(3).fill('ANG')],attack:1,defense:1},
 '4-4-2':{name:'4–4–2',roles:['MÅL',...Array(4).fill('FOR'),...Array(4).fill('MID'),...Array(2).fill('ANG')],attack:.96,defense:.93},
 '3-5-2':{name:'3–5–2',roles:['MÅL',...Array(3).fill('FOR'),...Array(5).fill('MID'),...Array(2).fill('ANG')],attack:1.1,defense:1.08},
 '4-5-1':{name:'4–5–1',roles:['MÅL',...Array(4).fill('FOR'),...Array(5).fill('MID'),'ANG'],attack:.85,defense:.8}
};
export const staffTypes={coach:{name:'Træner',base:600,wage:.04,description:'+1 holdstyrke og 5% billigere individuel træning pr. niveau.'},scout:{name:'Scout',base:750,wage:.03,description:'Bedre potentiale og 10% kortere akademiforløb pr. niveau.'},groundskeeper:{name:'Stadionchef',base:550,wage:.04,description:'+5% af stadionets passive bruttoindtægt pr. niveau.'}};
export const capacityFor=s=>500+Math.round(Math.pow(s.levels.stadium-1,1.4)*450);
export const wonMatch=m=>m.competition==='cup'?m.cupWon===true:m.competition==='europe'&&m.europeStage!=='group'?m.europeWon===true:m.home>m.away;
export const drawnMatch=m=>m.home===m.away&&m.competition!=='cup'&&(m.competition!=='europe'||m.europeStage==='group');
export function ensureManagement(s){
 ensureExpansion(s);ensureCompetition(s);
 s.formation||='4-3-3';s.reserves||=[];s.staff||={coach:0,scout:0,groundskeeper:0};s.academyFacility||={level:1,batches:0,program:null};
 s.supporters??=120+s.levels.stadium*180+Math.min(20,s.history.length)*30;s.reputation??=Math.min(100,10+s.tier*5);s.ticketPrice??=10;
 if(!s.cup||s.cup.season!==s.season)s.cup={season:s.season,round:0,eliminated:false,champion:false,history:[]};
 for(const p of [...s.players,...s.reserves]){p.development??=0;p.potential??=99}
 return s;
}
export function economyFor(s){const staff=s.staff||{},fans=s.supporters??300,rep=s.reputation??10;const base=1+s.levels.stadium*.8+s.levels.sponsor*1.2;const stadiumBonus=s.levels.stadium*.8*(staff.groundskeeper||0)*.05;const fanBonus=Math.floor(Math.max(0,fans-300)/100)*.02;const reputationBonus=Math.max(0,rep-10)*.003*s.levels.sponsor;const wages=Object.entries(staffTypes).reduce((n,[key,v])=>n+(staff[key]||0)*v.wage,0);const researchBonus=(base+stadiumBonus+fanBonus+reputationBonus)*expansionBonuses(s).incomePercent/100;return{base,stadiumBonus,fanBonus,reputationBonus,researchBonus,wages,net:Math.max(.2,base+stadiumBonus+fanBonus+reputationBonus+researchBonus-wages)}}
export function selectedStrength(s){return teamStrengthDetails({players:s.players,roles:(formations[s.formation]||formations['4-3-3']).roles,trainingLevel:s.levels.training,coach:s.staff?.coach||0,clubBonus:expansionBonuses(s).strengthBonus}).total}
export function gateFor(s){const price=s.ticketPrice??10,fans=s.supporters??300,rep=s.reputation??10;const attendance=Math.min(capacityFor(s),Math.max(0,Math.floor(fans*(.55+rep*.004)*Math.max(.2,1.1-(price-10)*.035))));return{attendance,ticketPrice:price,net:Math.round(attendance*price*.15)}}
export const staffPrice=(s,key)=>Math.round(staffTypes[key].base*Math.pow(1.8,s.staff?.[key]||0));
export const academyPrice=s=>Math.round(800*Math.pow(1.7,(s.academyFacility?.level||1)-1));
export const youthFee=s=>500+(s.academyFacility?.level||1)*250;
export const trainingPrice=(s,p)=>Math.round((100+Math.max(0,p.rating-30)*8+(p.development||0)*80)*(1-(s.staff?.coach||0)*.05)*(1-expansionBonuses(s).trainingDiscountPercent/100));
export function pitchCoordinates(formation){const roles=(formations[formation]||formations['4-3-3']).roles;const count={FOR:roles.filter(p=>p==='FOR').length,MID:roles.filter(p=>p==='MID').length,ANG:roles.filter(p=>p==='ANG').length},seen={FOR:0,MID:0,ANG:0};return roles.map(role=>role==='MÅL'?[50,85]:[(++seen[role])/(count[role]+1)*100,{FOR:67,MID:45,ANG:20}[role]])}
const pay=(s,cost)=>{if(s.money<cost)throw new GameError('Du har ikke penge nok endnu.');s.money-=cost};
const unlocked=s=>{if(s.active)throw new GameError('Vent, til kampen er færdig.')};
export function managementAction(s,a,now){
 if(a.type==='formation'){unlocked(s);if(!Object.hasOwn(formations,a.key))throw new GameError('Ukendt formation.');const remaining=[...s.players],arranged=[];for(const role of formations[a.key].roles){let i=remaining.findIndex(p=>p.position===role);if(i<0)i=remaining.findIndex(p=>p.position!=='MÅL');arranged.push(remaining.splice(i,1)[0])}s.players=arranged;s.formation=a.key;return true}
 if(a.type==='substitute'){unlocked(s);const i=s.players.findIndex(p=>p.id===a.starter),j=s.reserves.findIndex(p=>p.id===a.reserve);if(i<0||j<0)throw new GameError('Spilleren er ikke tilgængelig.');if((i===0)!==(s.reserves[j].position==='MÅL'))throw new GameError('Målmanden skal spille på mål.');[s.players[i],s.reserves[j]]=[s.reserves[j],s.players[i]];return true}
 if(a.type==='train-player'){unlocked(s);const p=[...s.players,...s.reserves].find(p=>p.id===a.player);if(!p)throw new GameError('Spilleren er ikke tilgængelig.');if(effectiveRating(p,s.levels.training)>=Math.min(99,p.potential))throw new GameError('Spilleren har nået sit potentiale.');const cost=trainingPrice(s,p);pay(s,cost);p.development++;p.trainingInvestment=(p.trainingInvestment||0)+cost;return true}
 if(a.type==='hire-staff'){unlocked(s);if(!Object.hasOwn(staffTypes,a.key))throw new GameError('Ukendt medarbejder.');if(s.staff[a.key]>=5)throw new GameError('Medarbejderen har maksimalt niveau.');pay(s,staffPrice(s,a.key));s.staff[a.key]++;return true}
 if(a.type==='academy-upgrade'){if(s.academyFacility.level>=10)throw new GameError('Akademiet har maksimalt niveau.');pay(s,academyPrice(s));s.academyFacility.level++;return true}
 if(a.type==='start-youth'){
  if(s.academyFacility.program)throw new GameError('Et akademiforløb er allerede i gang.');if(s.reserves.length>=7)throw new GameError('Reservebænken er fuld. Sælg en reservespiller først.');const fee=youthFee(s),batch=s.academyFacility.batches+1,level=s.academyFacility.level,scout=s.staff.scout,random=seeded(`academy:${s.founded}:${batch}`);
  const first=['Silas','Victor','Johan','Adam','Elliot','Storm'],last=['Falk','Ravn','Lund','Nord','Bak','Lind'];const rating=Math.min(72,35+level*2+Math.floor(random()*9));const potential=Math.min(99,rating+18+scout*2+Math.floor(random()*15));const position=['FOR','MID','ANG','MÅL'][Math.floor(random()*4)];
  const p={id:'youth-'+crypto.randomUUID(),name:first[Math.floor(random()*6)]+' '+last[Math.floor(random()*6)],position,rating,potential,development:0,age:18,youth:true,price:fee};pay(s,fee);s.academyFacility.batches=batch;s.academyFacility.program={player:p,started:now,ends:now+academyDuration(s),fee};return true;
 }
 if(a.type==='graduate-youth'){const program=s.academyFacility.program;if(!program||now<program.ends)throw new GameError('Akademispilleren er ikke klar endnu.');if(s.reserves.length>=7)throw new GameError('Reservebænken er fuld.');const occupied=new Set([...s.players,...s.reserves].map(p=>p.number));s.reserves.push({...program.player,number:Array.from({length:99},(_,i)=>i+1).find(n=>!occupied.has(n))});s.academyFacility.program=null;s.career||={startedAt:now,matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,signings:0,promotions:0};s.career.graduates=(s.career.graduates||0)+1;return true}
 if(a.type==='ticket-price'){unlocked(s);if(![5,10,15,20,25].includes(a.price))throw new GameError('Ugyldig billetpris.');s.ticketPrice=a.price;return true}
 if(a.type==='fan-campaign'){if(now-(s.lastFanCampaign??-Infinity)<3600000)throw new GameError('Vent, til fankampagnen er klar igen.');if(s.supporters>=20000)throw new GameError('Fankampagnen har nået sit maksimum.');pay(s,400+Math.floor(s.supporters/10));s.supporters=Math.min(20000,s.supporters+40);s.reputation=Math.min(100,s.reputation+1);s.lastFanCampaign=now;return true}
 return false;
}
export function recordSupport(s,m){const win=wonMatch(m),draw=drawnMatch(m);const delta=(win?18+(s.expansion?.dna==='community'?10:0):draw?7:-5)+Math.floor((15-(m.gate?.ticketPrice??10))/2);const previous=s.supporters;s.supporters=Math.max(100,s.supporters+delta);s.reputation=Math.max(0,Math.min(100,s.reputation+(win?2:draw?1:-1)));m.supportChange=s.supporters-previous}
export function managementView(s,now){const staff=Object.fromEntries(Object.entries(staffTypes).map(([key,v])=>[key,{...v,level:s.staff[key],price:staffPrice(s,key),hourlyWages:s.staff[key]*v.wage*3600}]));return{formation:s.formation,reserves:s.reserves,academyFacility:{...s.academyFacility,duration:academyDuration(s),upgradePrice:academyPrice(s),fee:youthFee(s),ready:!!s.academyFacility.program&&now>=s.academyFacility.program.ends},staff,finance:economyFor(s),supporters:s.supporters,reputation:s.reputation,ticketPrice:s.ticketPrice,gatePreview:gateFor(s),campaignPrice:400+Math.floor(s.supporters/10),campaignReady:now-(s.lastFanCampaign??-Infinity)>=3600000,cup:{...s.cup,unlocked:s.played>=2,roundName:['Kvartfinale','Semifinale','Finale'][s.cup.round]||'Afsluttet'},trainingPrices:Object.fromEntries([...s.players,...s.reserves].map(p=>[p.id,trainingPrice(s,p)]))}}
