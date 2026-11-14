import{test}from'node:test';import assert from'node:assert/strict';
import{createGame,apply,settle,accrue,publicState,rate,strength}from'../worker/game.js';
import{expansionView,expansionBonuses,ExpansionError,researchNodes}from'../worker/expansion.js';
import{trainingPrice,economyFor}from'../worker/management.js';
import worker from'../dist/server/index.js';import{database,TEST_PEPPER,tokenFor}from'./database.mjs';
const act=(s,type,props={},now=0)=>apply(s,{id:crypto.randomUUID(),type,...props},now,()=>.1);
const complete=(s,key,now=0)=>{act(s,'research-start',{key},now);act(s,'research-complete',{},s.expansion.activeResearch.ends)};
const match=(s,now=0)=>{act(s,'match',{},now);return settle(s,now+36000)};

test('legacy clubs gain neutral expansion defaults without changing saved data or historical credits',()=>{
 const s=createGame(0);delete s.expansion;s.career={matches:100,wins:50,goalsFor:200};const before=structuredClone(s),view=publicState(s,100);
 assert.deepEqual(s,before);assert.equal(view.expansion.dna,null);assert.equal(view.expansion.points,2);assert.equal(view.expansion.researchCompleted,0);assert.equal(view.expansion.activeResearch,null);assert.equal(view.expansion.activeContract,null);assert.equal(view.finance.net,3);assert.equal(view.expansion.identities.length,3);assert.equal(view.expansion.researchNodes.length,6);assert.equal(view.expansion.contracts.length,4);assert(!/NaN|undefined|Infinity/.test(JSON.stringify(view.expansion)));
});
test('first DNA choice is free, changes charge once, same choice and prototype keys cannot waste money, match locks apply',()=>{
 const s=createGame(0),baseline=strength(s);act(s,'dna-select',{key:'ambition',cost:0});assert.equal(s.money,1500);assert.equal(strength(s),baseline+1);assert.throws(()=>act(s,'dna-select',{key:'ambition'}),ExpansionError);assert.equal(s.money,1500);assert.throws(()=>act(s,'dna-select',{key:'__proto__'}),ExpansionError);
 const a={id:'dna-update',type:'dna-select',key:'academy',cost:0};apply(s,a,0);apply(s,a,0);assert.equal(s.money,0);assert.equal(strength(s),baseline);assert.equal(s.expansion.dna,'academy');assert.throws(()=>act(s,'dna-select',{key:'community'}),/penge/);act(s,'match');assert.throws(()=>act(s,'dna-select',{key:'ambition'}),/kampen/);
});
test('community identity increases fans only on completed wins, including cup penalties, without duplication',()=>{
 const normal=createGame(0),community=createGame(0);act(community,'dna-select',{key:'community'});match(normal);match(community);assert.equal(community.supporters-normal.supporters,10);const fans=community.supporters;settle(community,36000);assert.equal(community.supporters,fans);
 for(const [home,away,competition,cupWon,expected]of [[0,0,'league',false,0],[0,1,'league',false,0],[0,0,'cup',true,10],[0,0,'cup',false,0]]){
  const a=createGame(0),b=createGame(0);act(b,'dna-select',{key:'community'});for(const s of[a,b])s.active={id:'legacy',home,away,competition,cupWon,started:0,ends:100,reward:400,events:[],opponent:'Testhold'};settle(a,100);settle(b,100);assert.equal(b.supporters-a.supporters,expected);
 }
});
test('research validates resources/prerequisites and pays once; completion never grants an unfinished or duplicate node',()=>{
 const s=createGame(0);assert.throws(()=>act(s,'research-start',{key:'commerce2'}),/forrige/);assert.throws(()=>act(s,'research-start',{key:'__proto__'}),ExpansionError);const a={id:'research-once',type:'research-start',key:'commerce1',cost:0,pointCost:0};apply(s,a,100);apply(s,a,100);assert.equal(s.money,600);assert.equal(s.expansion.points,1);assert.equal(s.expansion.activeResearch.ends,180100);assert.throws(()=>act(s,'research-start',{key:'development1'},100),/allerede/);assert.throws(()=>act(s,'research-complete',{},180099),/klar/);assert.equal(s.expansion.research.length,0);act(s,'research-complete',{},180100);assert.equal(s.expansion.activeResearch,null);assert.deepEqual(s.expansion.research,['commerce1']);assert.throws(()=>act(s,'research-complete',{},180100),/klar/);s.money=10000;assert.throws(()=>act(s,'research-start',{key:'commerce2'}),/point/);assert.throws(()=>act(s,'research-start',{key:'commerce1'}),/gennemført/);
});
test('research points are awarded once at settlement for league and cup, never for starts, reads or retries',()=>{
 const s=createGame(0);act(s,'match');assert.equal(s.expansion.points,2);publicState(s,35999);assert.equal(s.expansion.points,2);assert.equal(settle(s,35999),null);settle(s,36000);assert.equal(s.expansion.points,3);settle(s,50000);assert.equal(s.expansion.points,3);s.played=2;act(s,'cup-match',{},60000);settle(s,96000);assert.equal(s.expansion.points,4);
});
test('commerce adds only bounded pre-wage gross bonus, and past income accrues before completion without retroactive credit',()=>{
 const s=createGame(0);s.money=1e6;s.staff.coach=2;const baseline=economyFor(s);act(s,'research-start',{key:'commerce1'},0);const ends=s.expansion.activeResearch.ends,before=s.money;accrue(s,ends);assert.equal(s.money,before+ends/1000*baseline.net);act(s,'research-complete',{},ends);const f=economyFor(s);assert.equal(f.researchBonus,(f.base+f.stadiumBonus+f.fanBonus+f.reputationBonus)*.03);assert.equal(f.wages,baseline.wages);assert.equal(f.net,baseline.net+f.researchBonus);const after=s.money;accrue(s,ends+1000);assert(Math.abs(s.money-after-f.net)<1e-8);assert.equal(accrue(s,ends+1000).earned,0);
 s.expansion.points=20;complete(s,'commerce2',ends+1000);assert.equal(expansionBonuses(s).incomePercent,6);assert.equal(expansionView(s,1e7).researchNodes.find(n=>n.id==='commerce2').available,false);
});
test('development and academy research compose with staff and DNA, respect caps and leave active youth snapshots unchanged',()=>{
 const s=createGame(0);s.money=1e7;s.expansion.points=20;s.staff.coach=5;s.staff.scout=5;const base=trainingPrice(s,s.players[1]);act(s,'start-youth');const original=structuredClone(s.academyFacility.program);act(s,'dna-select',{key:'academy'});for(const key of['development1','development2','academy1','academy2'])complete(s,key);
 assert.deepEqual(s.academyFacility.program,original);assert.equal(trainingPrice(s,s.players[1]),Math.round(base*.9));assert.equal(expansionBonuses(s).trainingDiscountPercent,10);assert.equal(expansionBonuses(s).academySpeedPercent,20);assert.equal(publicState(s,0).academyFacility.duration,240000);
 act(s,'graduate-youth',{},original.ends);act(s,'start-youth',{},original.ends);assert.equal(s.academyFacility.program.ends-s.academyFacility.program.started,240000);s.expansion.dna='ambition';s.players.forEach(p=>{p.rating=99;p.potential=99});assert.equal(strength(s),99);
});
test('contracts count only deltas after acceptance, cap progress and use settled cup career wins correctly',()=>{
 const s=createGame(0);s.career={startedAt:0,matches:100,wins:80,draws:20,losses:0,goalsFor:500,goalsAgainst:4};act(s,'contract-start',{key:'win2',reward:999999,target:0});assert.equal(expansionView(s,0).activeContract.progress,0);assert.throws(()=>act(s,'contract-claim'),/ikke nået/);assert.throws(()=>act(s,'contract-start',{key:'play3'}),/aktiv/);s.played=2;
 for(let i=0;i<2;i++){s.active={id:'cup'+i,competition:'cup',home:0,away:0,cupWon:true,penalties:{home:5,away:4},started:0,ends:100+i,reward:0,events:[],opponent:'Testhold'};settle(s,100+i)}
 assert.equal(expansionView(s,200).activeContract.progress,2);assert.equal(expansionView(s,200).activeContract.ready,true);const before=s.money;act(s,'contract-claim',{},200);assert.equal(s.money,before+900);assert.equal(s.expansion.completedContracts,1);assert.equal(s.expansion.activeContract,null);assert.throws(()=>act(s,'contract-claim',{},200),/ikke nået/);
});
test('contract cooldown persists beyond action cache and permits other types while graduates use claimed talents',()=>{
 const s=createGame(0);s.money=1e6;assert.throws(()=>act(s,'contract-start',{key:'constructor'}),ExpansionError);act(s,'contract-start',{key:'graduates1'});act(s,'start-youth');const p=s.academyFacility.program;assert.equal(expansionView(s,p.ends).activeContract.progress,0);act(s,'graduate-youth',{},p.ends);assert.equal(expansionView(s,p.ends).activeContract.progress,1);act(s,'contract-claim',{},p.ends);
 for(let i=0;i<60;i++)act(s,'rename',{name:'Klub '+i},p.ends+1);assert.throws(()=>act(s,'contract-start',{key:'graduates1'},p.ends+2),/endnu/);const view=expansionView(s,p.ends+2);assert.equal(view.contracts.find(c=>c.id==='graduates1').available,false);assert.equal(view.contracts.find(c=>c.id==='play3').available,true);act(s,'contract-start',{key:'play3'},p.ends+2);assert.equal(s.expansion.activeContract.id,'play3');
 const later=createGame(0);later.expansion.contractCooldowns.play3=3600000;assert.throws(()=>act(later,'contract-start',{key:'play3'},3599999),/endnu/);act(later,'contract-start',{key:'play3'},3600000);
});
test('contracts survive season resets and extra goal progress never awards beyond the frozen server reward',()=>{
 const s=createGame(0);s.career={startedAt:0,matches:7,wins:7,draws:0,losses:0,goalsFor:18,goalsAgainst:0};act(s,'contract-start',{key:'goals5'});s.played=9;s.points=20;s.active={id:'finish-season',home:8,away:0,competition:'league',started:0,ends:100,reward:0,events:[],opponent:'Testhold'};settle(s,100);assert.equal(s.season,2);assert.equal(expansionView(s,100).activeContract.progress,5);assert.equal(expansionView(s,100).activeContract.reward,750);const balance=s.money;act(s,'contract-claim',{},100);assert.equal(s.money,balance+750);
});
test('SQLite concurrency debits research and grants completion/contract rewards once; invalid actions return 400',async()=>{
 const env={DB:database(),AUTH_PEPPER:TEST_PEPPER};const headers={Origin:'https://expansion.test',Cookie:'__Host-touchline='+tokenFor('a'),'Content-Type':'application/json'};
 const get=()=>worker.fetch(new Request('https://expansion.test/api/game',{headers}),env);const post=a=>worker.fetch(new Request('https://expansion.test/api/game',{method:'POST',headers,body:JSON.stringify(a)}),env);const saved=()=>JSON.parse(env.DB.sqlite.prepare('SELECT state FROM clubs WHERE user_id=?').get('a').state);const save=s=>env.DB.sqlite.prepare('UPDATE clubs SET state=? WHERE user_id=?').run(JSON.stringify(s),'a');await get();
 const start={id:'concurrent-research',type:'research-start',key:'commerce1',cost:0};const responses=await Promise.all([post(start),post(start)]);assert(responses.every(r=>r.status===200));let s=saved();assert.equal(s.expansion.points,1);assert(s.money>=600&&s.money<620);s.expansion.activeResearch.ends=Date.now()-1;save(s);
 const completed=await Promise.all([post({id:'concurrent-complete',type:'research-complete'}),post({id:'concurrent-complete',type:'research-complete'})]);assert(completed.every(r=>r.status===200));assert.deepEqual(saved().expansion.research,['commerce1']);assert.equal((await post({id:'bad-project',type:'research-start',key:'__proto__'})).status,400);
 assert.equal((await post({id:'contract',type:'contract-start',key:'play3'})).status,200);s=saved();s.career={startedAt:0,matches:3};s.last=Date.now();save(s);const before=s.money;const claims=await Promise.all([post({id:'same-reward',type:'contract-claim'}),post({id:'same-reward',type:'contract-claim'})]);assert(claims.every(r=>r.status===200));s=saved();assert(s.money>=before+600&&s.money<before+620);assert.equal(s.expansion.completedContracts,1);assert.equal((await post({id:'again-cooldown',type:'contract-start',key:'play3'})).status,400);
});
test('all research remains bounded over a long mixed league/cup career without changing formation or old reward snapshots',()=>{
 const s=createGame(0);s.money=1e7;s.expansion.points=50;for(const key of Object.keys(researchNodes))complete(s,key);let now=1000000;for(let i=0;i<100;i++){
  if(!s.expansion.activeContract&&now>=(s.expansion.contractCooldowns.play3||0))act(s,'contract-start',{key:'play3'},now);match(s,now);if(expansionView(s,now+36000).activeContract?.ready)act(s,'contract-claim',{},now+36000);now+=40000;assert(Number.isFinite(rate(s))&&rate(s)>0);assert(Number.isFinite(s.money)&&s.money>=0);assert.equal(s.players.length,11);assert.equal(s.expansion.research.length,6);
 }assert.equal(s.expansion.points,50-9+100);assert.equal(s.career.matches,100);assert.equal(s.expansion.research.length,6);
});
