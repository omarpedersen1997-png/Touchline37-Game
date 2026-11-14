import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerCareerAction as action,playerCareerView as view,settlePlayerCareer as settle} from '../worker/player-career.js';
import {seeded} from '../worker/progression.js';
import worker from '../worker/index.js';
import {database,TEST_PEPPER,tokenFor} from './database.mjs';
const make=(position='ANG',modern=true)=>{
 const s={name:'Min klub',money:12345,players:[{name:'Bevar mig'}]};
 action(s,{id:'create',type:'player-career-create',position,name:'Oliver Nord',...(modern?{journeyVersion:1}:{})},0);return s;
};
const act=(s,id,type,now,extra={},random=seeded(id))=>action(s,{id,type:'player-career-'+type,journeyVersion:1,...extra},now,random);
function ready(s,now){if(s.playerCareer.journey.fitness<25){act(s,'rest-'+now,'rest',now);now+=45000;settle(s,now);}return now;}

test('old APK careers keep their existing energy-free flow until the new client activates the extension',()=>{
 const s=make('ANG',false);let now=0;
 for(let i=0;i<10;i++){action(s,{id:'old'+i,type:'player-career-match'},now,()=>0);now+=45000;settle(s,now);}
 assert.equal(s.playerCareer.journey.enabled,false);assert.equal(s.playerCareer.journey.fitness,100);
 assert.equal(s.playerCareer.wallet,100+1500+800);assert.equal(s.playerCareer.stats.matches,10);
 const before=JSON.stringify(s.playerCareer.stats);
 act(s,'enable-via-plan','plan',now,{key:'linkup'});
 assert.equal(s.playerCareer.journey.enabled,true);assert.equal(JSON.stringify(s.playerCareer.stats),before);
 assert(view(s,now).journey.objectives.every(g=>g.progress===0));
});

test('advanced actions activate their rules even when a caller omits the client marker',()=>{
 const s=make('ANG',false);
 action(s,{id:'plan-without-marker',type:'player-career-plan',key:'decisive'},0);
 assert.equal(s.playerCareer.journey.enabled,true);
 action(s,{id:'m',type:'player-career-match'},0);
 assert.equal(s.playerCareer.journey.fitness,74);
 const legacy=make('ANG',false),c=legacy.playerCareer;
 c.level=3;c.stats.matches=10;c.wallet=3000;
 action(legacy,{id:'old-transfer',type:'player-career-transfer',club:'nordskov'},0);
 assert.equal(c.journey.enabled,false);assert.equal(c.journey.contract,null);
 assert.equal(view(legacy,0).trainingOptions[0].cost,25);
});
test('energy, recovery and time boundaries prevent unlimited matches and never spend the manager balance',()=>{
 const s=make();let now=0;
 for(let i=0;i<5;i++){act(s,'match'+i,'match',now);now+=45000;settle(s,now);}
 assert(s.playerCareer.journey.fitness<25);
 assert.throws(()=>act(s,'exhausted','match',now),/25/);
 const fitness=s.playerCareer.journey.fitness,wallet=s.playerCareer.wallet;
 act(s,'recover','rest',now);assert.equal(settle(s,now+44999),null);
 assert.throws(()=>act(s,'while-resting','train',now+1000,{key:'physical'}),/Afslut/);
 const recovered=settle(s,now+45000);
 assert.equal(recovered.kind,'recovery');assert.equal(recovered.recovered,35);
 assert(s.playerCareer.journey.fitness>=fitness+35);assert.equal(s.playerCareer.wallet,wallet);
 assert.equal(settle(s,now+45000),null);assert.equal(s.money,12345);
 // An old-client-shaped request cannot bypass energy after the career opted in.
 s.playerCareer.journey.fitness=0;s.playerCareer.journey.lastRecovery=now+45000;
 assert.throws(()=>action(s,{id:'downgrade',type:'player-career-match'},now+45000),/25/);
});
test('offline recovery is capped, uses elapsed time and never reveals or mutates saved results through a view',()=>{
 const s=make();act(s,'m','match',0);
 const fitness=s.playerCareer.journey.fitness;
 assert.equal(view(s,119999).journey.fitness,fitness);
 assert.equal(view(s,120000).journey.fitness,fitness+1);
 assert.equal(view(s,1e9).journey.fitness,100);
 assert.equal(s.playerCareer.journey.fitness,fitness);
 assert.equal(view(s,-100).journey.fitness,fitness);
});
test('match plans have measurable tradeoffs in personal goals, assists and energy against the same seeds',()=>{
 const totals={linkup:{goals:0,assists:0},decisive:{goals:0,assists:0}};
 for(let i=0;i<350;i++)for(const plan of Object.keys(totals)){
  const s=make();act(s,'plan','plan',0,{key:plan});act(s,'m','match',0,{},seeded('plans'+i));
  const result=settle(s,45000);totals[plan].goals+=result.goals;totals[plan].assists+=result.assists;
  assert.equal(result.plan,plan);assert.equal(s.playerCareer.journey.fitness,plan==='linkup'?78:74);
 }
 assert(totals.decisive.goals>totals.linkup.goals);
 assert(totals.linkup.assists>totals.decisive.assists);
 const s=make();assert.throws(()=>act(s,'bad','plan',0,{key:'__proto__'}),/gyldig/);
 act(s,'live','match',0);assert.throws(()=>act(s,'late','plan',1000,{key:'decisive'}),/Afslut/);
});
test('goalkeeper plans affect saves without turning a goalkeeper into a scorer',()=>{
 const normal=make('MÅL'),bold=make('MÅL');act(bold,'plan','plan',0,{key:'decisive'});
 act(normal,'n','match',0,{},()=>0);act(bold,'b','match',0,{},()=>0);
 const a=settle(normal,45000),b=settle(bold,45000);
 assert.equal(b.saves,a.saves+2);assert.equal(b.goals,0);assert.equal(b.assists,0);
});
test('live highlights disclose only elapsed goals, agree with the final score and survive a saved match',()=>{
 const s=make();act(s,'timeline','match',0,{},()=>0);
 const restored=JSON.parse(JSON.stringify(s));
 for(const now of [0,5000,15000,30000,44999]){
  const state=view(restored,now),live=state.active.live;
  assert(live.events.every(e=>e.minute<=live.minute));
  assert.equal(live.home,live.events.filter(e=>e.kind==='goal'&&e.side==='home').length);
  assert.equal(state.active.result,undefined);assert.equal(state.active.timeline,undefined);
  assert.equal(state.active.salary,undefined);assert.equal(state.stats.matches,0);
  assert.deepEqual(state.active,view(s,now).active);
 }
 assert.equal(view(s,0).active.live.home,0);
 const live=view(s,45000).active.live,final=settle(s,45000);
 assert.equal(live.home,final.home);assert.equal(live.away,final.away);
 assert.equal(live.events.filter(e=>e.personal).length,final.goals);
 assert.equal(live.events.filter(e=>e.assist).length,final.assists);
 live.events[0].text='changed';assert.notEqual(restored.playerCareer.active.timeline[0].text,'changed');
});
test('position objectives reward completed work once and cannot be claimed by an old goal id',()=>{
 const s=make('MID');let now=0;
 const goal=view(s,0).journey.objectives.find(g=>g.key==='training');
 assert.throws(()=>act(s,'early','claim-objective',0,{key:goal.id}),/ikke klar/);
 for(let i=0;i<3;i++){act(s,'train'+i,'train',now,{key:'reading'});now+=60000;settle(s,now);}
 assert(view(s,now).journey.objectives.find(g=>g.id===goal.id).ready);
 const wallet=s.playerCareer.wallet;
 act(s,'claim','claim-objective',now,{key:goal.id});assert.equal(s.playerCareer.wallet,wallet+150);
 act(s,'claim','claim-objective',now,{key:goal.id});assert.equal(s.playerCareer.wallet,wallet+150);
 assert.throws(()=>act(s,'claim-again','claim-objective',now,{key:goal.id}),/hentet/);
 assert.equal(s.playerCareer.journey.objectivesCompleted,1);
 assert.throws(()=>act(s,'old','claim-objective',now,{key:'season-0-training'}),/tidligere/);
});
test('end-of-season auto rewards are explicit, archived, bounded and cannot pay twice',()=>{
 const s=make();let now=0;
 for(let i=0;i<10;i++){now=ready(s,now);act(s,'season'+i,'match',now,{},()=>0);now+=45000;settle(s,now);}
 const c=s.playerCareer,last=c.history[0];
 assert.equal(last.seasonEnd.objectiveMoney,250);assert.equal(last.seasonEnd.objectiveXp,125);
 assert.equal(c.wallet,100+1500+800+250);assert.equal(c.journey.objectivesCompleted,2);
 assert.equal(c.journey.seasonArchive[0].number,1);assert.equal(c.journey.seasonArchive[0].rewards.length,2);
 assert(c.journey.objectives.every(g=>g.id.startsWith('season-2-')&&!g.claimed));
 const bank=c.wallet;assert.equal(settle(s,now+1),null);assert.equal(c.wallet,bank);
});
test('top contracts depend on earned objectives, trust and recent performance as well as level',()=>{
 const s=make(),c=s.playerCareer;
 c.level=30;c.stats.matches=120;c.wallet=100000;c.journey.coachTrust=80;
 c.history=Array.from({length:10},(_,i)=>({id:'h'+i,kind:'match',performance:8}));c.journey.recentForm=Array(10).fill(8);
 let offer=view(s,0).offers.find(o=>o.id==='monteluce');assert(!offer.eligible);assert.match(offer.reason,/personlige mål/);
 c.journey.objectivesCompleted=6;c.journey.coachTrust=64;
 offer=view(s,0).offers.find(o=>o.id==='monteluce');assert.match(offer.reason,/tillid/);
 c.journey.coachTrust=80;c.history.forEach(h=>h.performance=6);c.journey.recentForm.fill(6);
 offer=view(s,0).offers.find(o=>o.id==='monteluce');assert.match(offer.reason,/form/);
 c.history.forEach(h=>h.performance=8);c.journey.recentForm.fill(8);assert(view(s,0).offers.find(o=>o.id==='monteluce').eligible);
 act(s,'new-club','transfer',0,{club:'monteluce',contract:'leader'});
 assert.equal(view(s,0).club.salary,2340);assert.equal(c.wallet,60000);assert.equal(s.money,12345);
 assert.equal(view(s,0).journey.contract.role,'leader');
});
test('choosing a contract role changes real pay, training costs and workload, not just the label',()=>{
 const s=make(),c=s.playerCareer;c.level=4;c.stats.matches=10;c.wallet=10000;c.journey.coachTrust=70;
 c.history=Array.from({length:5},(_,i)=>({id:'f'+i,kind:'match',performance:7}));c.journey.recentForm=Array(5).fill(7);
 const wallet=c.wallet;
 assert.throws(()=>act(s,'no-role','transfer',0,{club:'nordskov',contract:'leader'}),/20 karrierekampe/);
 assert.equal(c.wallet,wallet);assert.equal(c.clubId,'havnebro');
 act(s,'starter','transfer',0,{club:'nordskov',contract:'starter'});
 assert.equal(view(s,0).club.salary,345);assert.equal(view(s,0).trainingOptions[0].cost,25);
 act(s,'play','match',0);assert.equal(c.journey.fitness,80);
 assert.equal(settle(s,45000).salary,345);
});
test('authenticated concurrent objective claims persist one reward and manager accounts stay separate',async()=>{
 const env={DB:database(),AUTH_PEPPER:TEST_PEPPER},real=Date.now;let now=1000000;Date.now=()=>now;
 const req=(data,user='a')=>new Request('https://depth.test/api/game',{method:data?'POST':'GET',headers:{Cookie:'__Host-touchline='+tokenFor(user),...(data?{Origin:'https://depth.test','Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
 try{
  const call=async data=>{const r=await worker.fetch(req(data),env);assert.equal(r.status,200);return r.json();};
  await call({id:'create',type:'player-career-create',name:'API spiller',position:'ANG',journeyVersion:1});
  for(let i=0;i<3;i++){await call({id:'train'+i,type:'player-career-train',key:'physical',journeyVersion:1});now+=60000;await call();}
  const goal=(await call()).state.playerCareer.journey.objectives.find(g=>g.key==='training');assert(goal.ready);
  const claims=await Promise.all(['claim-a','claim-b'].map(id=>worker.fetch(req({id,type:'player-career-claim-objective',key:goal.id,journeyVersion:1}),env)));
  assert.deepEqual(claims.map(r=>r.status).sort(),[200,400]);
  const c=(await call()).state.playerCareer;assert.equal(c.wallet,175);assert.equal(c.journey.objectivesCompleted,1);
  const other=await(await worker.fetch(req(null,'b'),env)).json();assert.equal(other.state.playerCareer,null);
 }finally{Date.now=real;}
});

test('training and resting do not erase the match form used to earn a contract',()=>{
 const s=make();let now=0;s.playerCareer.wallet=10000;
 for(let i=0;i<8;i++){now=ready(s,now);act(s,'form'+i,'match',now,{},()=>0);now+=45000;settle(s,now);}
 const form=view(s,now).journey.form;
 for(let i=0;i<25;i++){
  now=ready(s,now);act(s,'drill'+i,'train',now,{key:'reading'});now+=60000;settle(s,now);
 }
 assert.deepEqual(view(s,now).journey.form,form);
 assert.equal(s.playerCareer.history.filter(item=>item.kind==='match').length,0);
});

test('long modern careers bound all histories, retain records and never exceed trust or energy limits',()=>{
 const s=make();let now=0;
 for(let i=0;i<210;i++){
  now=ready(s,now);act(s,'long'+i,'match',now,{},()=>0);now+=45000;settle(s,now);
  const j=view(s,now).journey;
  assert(j.fitness>=0&&j.fitness<=100);assert(j.coachTrust>=0&&j.coachTrust<=100);
 }
 const c=s.playerCareer;
 assert.equal(c.journey.seasonArchive.length,20);assert.equal(c.journey.seasonArchive[0].number,21);
 assert.equal(c.journey.seasonArchive.at(-1).number,2);assert.equal(c.journey.recentForm.length,10);
 assert.equal(c.history.length,20);assert.equal(c.journey.objectivesCompleted,42);
 assert.deepEqual(view(JSON.parse(JSON.stringify(s)),now),view(s,now));
});

test('elite contract form is reachable through development and recovery, rather than requiring impossible ratings',()=>{
 let trainedTotal=0,tiredTotal=0,trainedWindows=0;
 const strong=make(),tired=make();
 for(const s of [strong,tired]){s.playerCareer.clubId='valora';s.playerCareer.attributes={technique:99,physical:99,reading:99};}
 for(let i=0;i<200;i++){
  for(const [s,energy] of [[strong,100],[tired,30]]){
   const now=i*45000;s.playerCareer.journey.fitness=energy;s.playerCareer.journey.lastRecovery=now;
   act(s,'elite'+i,'match',now,{},seeded('elite-form'+i));
   const result=settle(s,now+45000);
   if(s===strong){trainedTotal+=result.performance;if(view(s,now+45000).journey.form.average>=7)trainedWindows++;}
   else tiredTotal+=result.performance;
  }
 }
 assert(trainedTotal>tiredTotal+100);assert(trainedWindows>20);
 assert(strong.playerCareer.journey.coachTrust>tired.playerCareer.journey.coachTrust);
});
