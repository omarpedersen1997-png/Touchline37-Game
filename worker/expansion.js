export class ExpansionError extends Error{}

export const identities={
 academy:{id:'academy',name:'Talentfabrikken',description:'Byg klubben omkring talenter fra dit eget akademi.',effect:'10% kortere fremtidige akademiforløb.'},
 community:{id:'community',name:'Byens hold',description:'Lad fællesskabet og tribunerne være klubbens drivkraft.',effect:'+10 ekstra fans efter hver sejr, også ved pokalstraffe.'},
 ambition:{id:'ambition',name:'Vinderkulturen',description:'Giv førsteholdet det sidste løft i jagten på toppen.',effect:'+1 i samlet holdstyrke, højst 99.'}
};
export const researchNodes={
 commerce1:{id:'commerce1',name:'Lokale partnere',description:'+3% af klubbens passive bruttoindtægt før personaleudgifter.',cost:900,pointCost:1,duration:180000,requires:null},
 commerce2:{id:'commerce2',name:'Partnernetværk',description:'Yderligere +3% passiv bruttoindtægt. Samlet +6%.',cost:2400,pointCost:2,duration:300000,requires:'commerce1'},
 development1:{id:'development1',name:'Videoanalyse',description:'5% billigere individuel træning efter trænerens rabat.',cost:900,pointCost:1,duration:180000,requires:null},
 development2:{id:'development2',name:'Personlige udviklingsplaner',description:'Yderligere 5% rabat på individuel træning. Samlet 10%.',cost:2400,pointCost:2,duration:300000,requires:'development1'},
 academy1:{id:'academy1',name:'Talentmiljø',description:'5% kortere fremtidige akademiforløb, oven i din scouts effekt.',cost:900,pointCost:1,duration:180000,requires:null},
 academy2:{id:'academy2',name:'Næste generation',description:'Yderligere 5% kortere akademiforløb. Samlet 10%.',cost:2400,pointCost:2,duration:300000,requires:'academy1'}
};
export const contractTypes={
 play3:{id:'play3',name:'Vis flaget',description:'Gennemfør tre kampe efter aftalens start.',target:3,metric:'matches',reward:600},
 win2:{id:'win2',name:'Vindermentalitet',description:'Vind to kampe efter aftalens start.',target:2,metric:'wins',reward:900},
 goals5:{id:'goals5',name:'Offensivt aftryk',description:'Score fem mål efter aftalens start.',target:5,metric:'goalsFor',reward:750},
 graduates1:{id:'graduates1',name:'Fra akademi til klub',description:'Hent ét færdiguddannet akademitalent efter aftalens start.',target:1,metric:'graduates',reward:800}
};
const cooldown=3600000;
const safeCount=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
const metric=(s,key)=>safeCount(s.career?.[key]);
export function ensureExpansion(s){
 s.expansion||={};const e=s.expansion;
 e.dna??=null;e.points??=2;e.research||=[];e.activeResearch??=null;e.activeContract??=null;e.contractCooldowns||={};e.completedContracts??=0;
 return s;
}
export function expansionBonuses(s){
 const e=s.expansion||{},done=new Set(e.research||[]);
 return{incomePercent:3*(Number(done.has('commerce1'))+Number(done.has('commerce2'))),trainingDiscountPercent:5*(Number(done.has('development1'))+Number(done.has('development2'))),academySpeedPercent:(e.dna==='academy'?10:0)+5*(Number(done.has('academy1'))+Number(done.has('academy2'))),strengthBonus:e.dna==='ambition'?1:0};
}
export const academyDuration=s=>Math.round(600000*(1-(s.staff?.scout||0)*.1)*(1-expansionBonuses(s).academySpeedPercent/100));
const contractProgress=(s,c)=>Math.min(c.target,Math.max(0,metric(s,c.metric)-c.baseline));
const requireFunds=(s,cost)=>{if(s.money<cost)throw new ExpansionError('Du har ikke penge nok endnu.');};
export function expansionAction(s,a,now){
 const supported=['dna-select','research-start','research-complete','contract-start','contract-claim'];if(!supported.includes(a.type))return false;
 ensureExpansion(s);const e=s.expansion;
 if(a.type==='dna-select'){
  if(s.active)throw new ExpansionError('Vent, til kampen er færdig.');
  if(typeof a.key!=='string'||!Object.hasOwn(identities,a.key))throw new ExpansionError('Ukendt klubidentitet.');
  if(e.dna===a.key)throw new ExpansionError('Denne klubidentitet er allerede valgt.');
  const cost=e.dna?1500:0;requireFunds(s,cost);s.money-=cost;e.dna=a.key;
 }
 if(a.type==='research-start'){
  if(e.activeResearch)throw new ExpansionError('Et forskningsprojekt er allerede i gang.');
  if(typeof a.key!=='string'||!Object.hasOwn(researchNodes,a.key))throw new ExpansionError('Ukendt forskningsprojekt.');
  const node=researchNodes[a.key];
  if(e.research.includes(node.id))throw new ExpansionError('Forskningsprojektet er allerede gennemført.');
  if(node.requires&&!e.research.includes(node.requires))throw new ExpansionError('Gennemfør det forrige projekt i grenen først.');
  if(e.points<node.pointCost)throw new ExpansionError('Du mangler forskningspoint. Gennemfør flere kampe.');
  requireFunds(s,node.cost);s.money-=node.cost;e.points-=node.pointCost;e.activeResearch={id:node.id,started:now,ends:now+node.duration};
 }
 if(a.type==='research-complete'){
  const project=e.activeResearch;if(!project||now<project.ends)throw new ExpansionError('Forskningsprojektet er ikke klar endnu.');
  if(!e.research.includes(project.id))e.research.push(project.id);e.activeResearch=null;
 }
 if(a.type==='contract-start'){
  if(e.activeContract)throw new ExpansionError('Du har allerede en aktiv bestyrelsesaftale.');
  if(typeof a.key!=='string'||!Object.hasOwn(contractTypes,a.key))throw new ExpansionError('Ukendt bestyrelsesaftale.');
  if(now<(e.contractCooldowns[a.key]||0))throw new ExpansionError('Bestyrelsesaftalen kan endnu ikke vælges igen.');
  const c=contractTypes[a.key];e.activeContract={...c,baseline:metric(s,c.metric),started:now};
 }
 if(a.type==='contract-claim'){
  const c=e.activeContract;if(!c||contractProgress(s,c)<c.target)throw new ExpansionError('Bestyrelsesaftalens mål er ikke nået endnu.');
  s.money+=c.reward;e.contractCooldowns[c.id]=now+cooldown;e.completedContracts++;e.activeContract=null;
 }
 return true;
}
export function expansionView(s,now){
 ensureExpansion(s);const e=s.expansion,c=e.activeContract,p=e.activeResearch;
 return{dna:e.dna,identities:Object.values(identities),dnaChangeCost:e.dna?1500:0,points:e.points,
  researchNodes:Object.values(researchNodes).map(n=>({...n,completed:e.research.includes(n.id),available:!e.activeResearch&&!e.research.includes(n.id)&&(!n.requires||e.research.includes(n.requires))&&e.points>=n.pointCost&&s.money>=n.cost})),
  activeResearch:p?{...p,name:researchNodes[p.id].name,ready:now>=p.ends}:null,
  contracts:Object.values(contractTypes).map(t=>({...t,availableAt:e.contractCooldowns[t.id]||0,available:!c&&now>=(e.contractCooldowns[t.id]||0)})),
  activeContract:c?{id:c.id,name:c.name,description:c.description,target:c.target,progress:contractProgress(s,c),reward:c.reward,ready:contractProgress(s,c)>=c.target}:null,
  completedContracts:e.completedContracts,researchCompleted:e.research.length,bonuses:expansionBonuses(s)};
}
