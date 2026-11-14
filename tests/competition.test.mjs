import{test}from'node:test';import assert from'node:assert/strict';
import{createGame,apply,settle,publicState,strength,rate}from'../worker/game.js';
import{ensureCompetition,licenceFor,oppositionFor,promotionTargets,oppositionBases,licenceLevels}from'../worker/competition.js';
import{seeded}from'../worker/progression.js';
import worker from'../dist/server/index.js';import{database,TEST_PEPPER,tokenFor}from'./database.mjs';
const start=(s,id='match',now=0)=>apply(s,{id,type:'match'},now,()=>.1);
const finishedSeason=(s,points)=>{s.played=9;s.points=points;s.goals=27;s.wins=9;s.draws=0;s.seasonResults=Array.from({length:9},(_,round)=>({round,home:3,away:0}));s.active={id:'last-game',competition:'league',home:0,away:1,started:0,ends:100,reward:400,events:[],opponent:'Rival'};return settle(s,100)};
const tierClub=tier=>{const s=createGame(0);s.tier=tier;ensureCompetition(s);return s};

test('new seasons use bounded rising opposition and targets while the first two leagues retain their original match tuning',()=>{
 for(let tier=0;tier<9;tier++){
  const s=tierClub(tier),view=publicState(s,0).competition;
  assert.equal(view.legacy,false);assert.equal(view.targetPoints,promotionTargets[tier]);assert.equal(s.competitionRules.oppositionBase,oppositionBases[tier]);assert.equal(view.topFlight,tier===8);assert.equal(view.championshipAvailable,tier===8);assert.equal(view.matchesRemaining,10);
  assert.equal(oppositionFor(s),oppositionBases[tier]);assert(oppositionFor(s,{cup:true,round:99})<=99);
  if(tier<2)assert.equal(s.competitionRules.oppositionGrowth,.65);
 }
});
test('every promotion licence requires exactly its published existing facility levels and reacts at each boundary',()=>{
 for(let tier=0;tier<8;tier++){
  const s=tierClub(tier),tuple=licenceLevels[tier];s.levels.stadium=tuple[0];s.levels.training=tuple[1];s.academyFacility.level=Math.max(1,tuple[2]);assert.equal(licenceFor(s).ready,true);
  for(const [i,key]of ['stadium','training','academy'].entries()){
   if(tuple[i]<=1)continue;
   const before=key==='academy'?s.academyFacility.level:s.levels[key];if(key==='academy')s.academyFacility.level--;else s.levels[key]--;
   const licence=licenceFor(s);assert.equal(licence.ready,false);assert.equal(licence.requirements.find(r=>r.key===key).ready,false);
   if(key==='academy')s.academyFacility.level=before;else s.levels[key]=before;assert.equal(licenceFor(s).ready,true);
  }
  assert(tuple[2]<=10);
 }
 assert.equal(licenceFor(tierClub(8)).required,false);
});
test('capped squads can build the exact training facility required by their licence and stop at that requirement',()=>{
 const s=tierClub(7);s.money=1e12;s.players.forEach(p=>{p.rating=99;p.potential=99});s.levels.training=2;const ids=s.players.map(p=>p.id);
 for(let level=2;level<15;level++){assert.equal(publicState(s,0).competition.trainingLicenseUpgrade,true);apply(s,{id:'licence-training-'+level,type:'upgrade',key:'training'},0);assert.equal(s.levels.training,level+1);assert.equal(strength(s),99)}
 assert.equal(publicState(s,0).trainingLicenseUpgrade,false);assert.throws(()=>apply(s,{id:'over-licence',type:'upgrade',key:'training'},0),/maksimal/);assert.deepEqual(s.players.map(p=>p.id),ids);
 const legacy=tierClub(7);delete legacy.competitionRules;legacy.played=1;legacy.players.forEach(p=>{p.rating=99;p.potential=99});legacy.money=1e12;assert.throws(()=>apply(legacy,{id:'legacy-cap',type:'upgrade',key:'training'},0),/maksimal/);
});
test('qualifying points alone cannot bypass a missing licence; exact requirements promote once without deleting assets',()=>{
 const blocked=tierClub(7);blocked.levels={stadium:18,training:15,sponsor:12};blocked.academyFacility.level=4;const blockedResult=finishedSeason(blocked,22);
 assert.equal(blockedResult.seasonEnd.promoted,false);assert.equal(blockedResult.seasonEnd.licenseBlocked,true);assert.equal(blockedResult.seasonEnd.requiredPoints,22);assert.equal(blocked.tier,7);
 const s=tierClub(7);s.levels={stadium:18,training:15,sponsor:12};s.academyFacility.level=5;const ids=s.players.map(p=>p.id),before=s.money;const result=finishedSeason(s,22);
 assert.equal(result.seasonEnd.promoted,true);assert.equal(s.tier,8);assert.equal(s.money,before+400+18000);assert.deepEqual(s.players.map(p=>p.id),ids);assert.equal(s.levels.stadium,18);assert.equal(s.academyFacility.level,5);assert.equal(s.career.promotions,1);assert.equal(s.seasonArchive[0].tier,7);assert.equal(s.competitionRules.tier,8);assert.equal(s.competitionRules.targetPoints,22);
 const cash=s.money;assert.equal(settle(s,1000),null);assert.equal(s.money,cash);
 const short=tierClub(7);short.levels.stadium=18;short.levels.training=15;short.academyFacility.level=5;assert.equal(finishedSeason(short,21).seasonEnd.promoted,false);assert.equal(short.seasonArchive[0].licenseBlocked,false);
});
test('legacy mid-season saves retain original opposition, 18-point goal and no licence until their next season',()=>{
 const s=tierClub(7);delete s.competitionRules;delete s.seasonArchive;s.played=9;s.points=18;const original=structuredClone(s),preview=publicState(s,0);
 assert.deepEqual(s,original);assert.equal(preview.competition.legacy,true);assert.equal(preview.competition.targetPoints,18);assert.equal(preview.competition.license.required,false);
 ensureCompetition(s);assert.equal(oppositionFor(s),43+7*5+9*.65);assert.equal(oppositionFor(s,{cup:true,round:2}),89);
 const result=finishedSeason(s,18);assert.equal(result.seasonEnd.promoted,true);assert.equal(s.tier,8);assert.equal(s.seasonArchive[0].rulesVersion,1);assert.equal(s.competitionRules.version,2);assert.equal(publicState(s,100).competition.championshipAvailable,true);
});
test('legacy active first matches preserve their snapshot and freeze old rules for the rest of that season',()=>{
 const s=tierClub(6);delete s.competitionRules;s.active={id:'saved-first',competition:'league',home:2,away:1,started:0,ends:100,reward:1234,opposition:73,events:[],opponent:'Rival'};
 const before=s.money;ensureCompetition(s);assert.equal(s.competitionRules.version,1);assert.equal(s.competitionRules.targetPoints,18);assert.equal(publicState(s,50).active.reward,undefined);assert.equal(s.active.reward,1234);settle(s,100);assert.equal(s.money,before+1234);assert.equal(s.played,1);assert.equal(s.competitionRules.version,1);
 start(s,'second-game',1000);assert.equal(s.active.opposition,43+6*5+.65);assert.equal(s.active.ends-s.active.started,36000);
});
test('a legacy top-flight season never backfills a new title and transitions cleanly to the championship rules',()=>{
 const s=tierClub(8);delete s.competitionRules;s.played=9;ensureCompetition(s);assert.equal(publicState(s,0).competition.championshipAvailable,false);const result=finishedSeason(s,27);
 assert.equal(result.seasonEnd.rank,1);assert.equal(result.seasonEnd.champion,false);assert.equal(s.career.topFlightTitles,0);assert.equal(s.seasonArchive[0].champion,false);assert.equal(s.competitionRules.version,2);assert.equal(publicState(s,100).competition.targetPoints,22);
});
test('new top-flight titles require rank one and the point target, award a fixed reward once and archive actual results',()=>{
 const s=tierClub(8);const before=s.money;const result=finishedSeason(s,27);
 assert.equal(result.seasonEnd.champion,true);assert.equal(result.seasonEnd.promoted,false);assert.equal(result.seasonEnd.requiredPoints,22);assert.equal(result.seasonEnd.rank,1);assert.equal(result.seasonEnd.titleReward,5000);assert.equal(s.money,before+400+5000);assert.equal(s.career.topFlightTitles,1);assert.equal(s.tier,8);assert.equal(s.season,2);assert.equal(s.seasonArchive[0].champion,true);
 const once=s.money;settle(s,200);assert.equal(s.money,once);assert.equal(s.career.topFlightTitles,1);
 const short=tierClub(8);const low=finishedSeason(short,21);assert.equal(low.seasonEnd.champion,false);assert.equal(short.career.topFlightTitles,0);
 // Find an ordinary league seed where 22 points and a large negative goal
 // difference finish below another club; points must not silently grant a title.
 let below=null;for(let season=1;season<200;season++){
  const candidate=tierClub(8);candidate.season=season;ensureCompetition(candidate);candidate.played=9;candidate.points=22;candidate.goals=0;candidate.seasonResults=Array.from({length:9},(_,round)=>({round,home:0,away:20}));candidate.active={id:'last',competition:'league',home:0,away:20,started:0,ends:100,reward:0,events:[],opponent:'Rival'};const end=settle(candidate,100).seasonEnd;if(end.rank>1){below={candidate,end};break}
 }
 assert(below);assert.equal(below.end.champion,false);assert.equal(below.candidate.career.topFlightTitles,0);
});
test('season history is capped at twenty summaries while title counts persist across all seasons',()=>{
 const s=tierClub(8);for(let i=0;i<25;i++)finishedSeason(s,27);assert.equal(s.career.topFlightTitles,25);assert.equal(s.seasonArchive.length,20);assert.equal(s.seasonArchive[0].season,25);assert.equal(s.seasonArchive.at(-1).season,6);const view=publicState(s,100);assert.equal(view.competition.history.length,20);assert.equal(view.seasonArchive.length,20);assert.equal(s.players.length,11);assert(strength(s)<=99&&rate(s)>0);
});
test('SQLite concurrent settlement cannot duplicate a new league title, cash reward or season record',async()=>{
 const env={DB:database(),AUTH_PEPPER:TEST_PEPPER};const get=()=>worker.fetch(new Request('https://competition.test/api/game',{headers:{Cookie:'__Host-touchline='+tokenFor('a')}}),env);await get();
 const s=tierClub(8);const now=Date.now();s.last=now;s.played=9;s.points=27;s.goals=27;s.wins=9;s.seasonResults=Array.from({length:9},(_,round)=>({round,home:3,away:0}));s.active={id:'last',competition:'league',home:0,away:1,started:now-40000,ends:now-1000,reward:400,events:[],opponent:'Rival'};const before=s.money;env.DB.sqlite.prepare('UPDATE clubs SET state=? WHERE user_id=?').run(JSON.stringify(s),'a');
 const responses=await Promise.all([get(),get()]);assert(responses.every(r=>r.status===200));const saved=JSON.parse(env.DB.sqlite.prepare('SELECT state FROM clubs WHERE user_id=?').get('a').state);assert.equal(saved.career.topFlightTitles,1);assert.equal(saved.seasonArchive.length,1);assert.equal(saved.season,2);assert(saved.money>=before+5400&&saved.money<before+5420);
});
test('seeded production match simulations make the upper leagues materially harder while capped squads can still qualify',()=>{
 const totals=[];for(const tier of[0,6,7,8]){
  let qualified=0,titles=0,points=0;for(let sample=0;sample<1000;sample++){
   const s=tierClub(tier),rng=seeded('competition-balance:'+tier+':'+sample);s.season=sample+1;ensureCompetition(s);s.players.forEach(p=>{p.rating=99;p.potential=99});s.levels={stadium:30,training:30,sponsor:30};s.academyFacility.level=10;
   for(let round=0;round<10;round++){
    apply(s,{id:'match-'+round,type:'match'},round*40000,rng);const result=settle(s,round*40000+36000);if(result.seasonEnd){qualified+=Number(result.seasonEnd.points>=result.seasonEnd.requiredPoints);titles+=Number(result.seasonEnd.champion);points+=result.seasonEnd.points;}
   }
  }
  totals.push({tier,qualified:qualified/1000,titles:titles/1000,points:points/1000});
 }
 assert(totals[0].qualified>.87&&totals[0].qualified<.98);assert(totals[1].qualified>.6&&totals[1].qualified<.82);assert(totals[2].qualified>.25&&totals[2].qualified<.46);assert(totals[3].titles>.1&&totals[3].titles<.3);assert(totals[0].points>totals[2].points&&totals[2].points>totals[3].points);console.log('Competition balance: 40,000 simulated matches',totals);
});
