import{test}from'node:test';import assert from'node:assert/strict';
import{createGame,apply,settle,publicState}from'../worker/game.js';
import{ensureEurope,qualifyEurope,europeView,europeanTable,EuropeError}from'../worker/europe.js';
import{wonMatch,drawnMatch}from'../worker/management.js';
import worker from'../dist/server/index.js';import{database,TEST_PEPPER,tokenFor}from'./database.mjs';
const act=(s,type,props={},now=0,random=()=>.1)=>apply(s,{id:crypto.randomUUID(),type,...props},now,random);
const losing=()=>{let calls=0;return()=>calls++%2?0:.999};
const qualified=()=>{const s=createGame(0);s.tier=8;qualifyEurope(s,{tier:8,rank:2,points:22,season:1});return s};
const entered=()=>{const s=qualified();act(s,'europe-enter');return s};
const play=(s,now=0,random=()=>.1)=>{act(s,'europe-match',{},now,random);return settle(s,now+36000)};
const groupWon=s=>{for(let i=0;i<3;i++)play(s,i*40000);return s};

test('European defaults never backfill historical qualification or mutate a public legacy read',()=>{
 const s=createGame(0);delete s.europe;s.tier=8;s.season=20;s.seasonArchive=[{season:19,tier:8,rank:1,points:30,champion:true}];const before=structuredClone(s),view=publicState(s,0);
 assert.deepEqual(s,before);assert.equal(view.europe.name,'Aurora Europa Cup');assert.equal(view.europe.pendingEntry,null);assert.equal(view.europe.campaign,null);assert.equal(view.europe.canEnter,false);assert.equal(view.europe.canPlay,false);assert.equal(view.europe.titles,0);assert.equal(view.europe.qualification.minimumPoints,20);
});
test('qualification requires a completed top-flight top-three result with twenty points and is consumed once',()=>{
 const s=createGame(0);for(const row of[{tier:7,rank:1,points:30,season:1},{tier:8,rank:4,points:25,season:1},{tier:8,rank:1,points:19,season:1}])assert.equal(qualifyEurope(s,row),false);
 assert.equal(qualifyEurope(s,{tier:8,rank:3,points:20,season:1}),true);assert.equal(europeView(s).canEnter,true);const start={id:'one-entry',type:'europe-enter'};apply(s,start,0);apply(s,start,0);assert.equal(s.europe.campaigns,1);assert.equal(s.europe.pendingEntry,null);assert.equal(qualifyEurope(s,{tier:8,rank:1,points:30,season:1}),false);assert.throws(()=>act(s,'europe-enter'),EuropeError);
});
test('actual completed Superliga seasons grant qualification while ordinary group fixtures do not alter it',()=>{
 const s=createGame(0);s.tier=8;s.played=9;s.points=27;s.goals=27;s.wins=9;s.seasonResults=Array.from({length:9},(_,round)=>({round,home:3,away:0}));s.active={id:'last-league',competition:'league',home:0,away:1,started:0,ends:100,reward:0,events:[],opponent:'Rival'};
 const report=settle(s,100);assert.equal(report.seasonEnd.rank,1);assert.deepEqual(s.europe.pendingEntry,{clubSeason:1,points:27,rank:1});act(s,'europe-enter',{},200);play(s,40000);assert.equal(s.europe.pendingEntry,null);assert.equal(s.europe.lastQualifiedSeason,1);
});
test('three independent group games produce a real four-club table and top-two knockout qualification',()=>{
 const s=entered(),league={played:s.played,points:s.points,season:s.season,tier:s.tier,results:structuredClone(s.seasonResults),cup:structuredClone(s.cup)};
 const fixtureNames=europeView(s).campaign.groupFixtures.map(f=>f.opponent);assert.equal(new Set(fixtureNames).size,3);assert(europeView(s).campaign.groupFixtures.every(f=>!f.played&&f.home===undefined&&f.away===undefined));
 for(let i=0;i<3;i++){const view=publicState(s,i*40000);assert.equal(view.europe.campaign.nextMatch.opposition,90+i*2);const report=play(s,i*40000);assert.equal(report.competition,'europe');assert.equal(report.europeStage,'group');assert.equal(report.penalties,undefined);assert.equal(s.europe.campaign.groupPlayed,i+1)}
 const table=europeanTable(s);assert.equal(table.length,4);assert(table.every(t=>t.played===3));assert.equal(table.reduce((a,t)=>a+t.goalsFor,0),table.reduce((a,t)=>a+t.goalsAgainst,0));assert.equal(table[0].self,true);assert.equal(table[0].points,9);assert.equal(s.europe.campaign.status,'quarter');assert.equal(europeView(s).campaign.groupQualified,true);assert.equal(europeView(s).campaign.nextMatch.opposition,96);
 assert.deepEqual({played:s.played,points:s.points,season:s.season,tier:s.tier,results:s.seasonResults,cup:s.cup},league);assert.equal(s.career.matches,3);assert.equal(s.expansion.points,5);
});
test('group draws remain draws; losing the group ends the campaign and blocks replay without new qualification',()=>{
 const draw=entered();const result=play(draw,0,()=>.5);assert.equal(result.home,result.away);assert.equal(result.penalties,undefined);assert.equal(drawnMatch(result),true);assert.equal(draw.career.draws,1);assert.equal(draw.career.losses,0);
 const lost=entered();for(let i=0;i<3;i++)play(lost,i*40000,losing());assert.equal(lost.europe.campaign.status,'eliminated');assert(europeView(lost).campaign.groupRank>2);assert.equal(lost.europe.completedCampaigns,1);assert.equal(lost.europe.history.length,1);assert.equal(europeView(lost).canPlay,false);assert.throws(()=>act(lost,'europe-match'),EuropeError);assert.throws(()=>act(lost,'europe-enter'),EuropeError);
});
test('a new earned qualification waits safely while an unfinished campaign keeps its own group and entry season',()=>{
 const s=entered(),id=s.europe.campaign.id;assert.equal(qualifyEurope(s,{tier:8,rank:2,points:22,season:2}),true);assert.equal(s.europe.campaign.id,id);assert.equal(s.europe.campaign.entrySeason,1);assert.equal(s.europe.pendingEntry.clubSeason,2);assert.equal(europeView(s).canEnter,false);assert.throws(()=>act(s,'europe-enter'),/allerede/);
 assert.equal(qualifyEurope(s,{tier:8,rank:3,points:20,season:3}),true);assert.equal(s.europe.pendingEntry.clubSeason,3);assert.equal(s.europe.campaign.id,id);for(let i=0;i<3;i++)play(s,i*40000,losing());assert.equal(europeView(s).canEnter,true);act(s,'europe-enter',{},200000);assert.notEqual(s.europe.campaign.id,id);assert.equal(s.europe.campaign.entrySeason,3);assert.equal(s.europe.campaigns,2);assert.equal(s.europe.pendingEntry,null);
});
test('knockout penalties are hidden until completion, count as wins or losses and never become league draws',()=>{
 const s=groupWon(entered());act(s,'europe-match',{},120000,()=>.5);assert.equal(s.active.home,s.active.away);assert(s.active.penalties);assert.equal(s.active.europeWon,false);const view=publicState(s,121000);assert.equal(view.active.europeWon,undefined);assert.equal(view.active.penalties,undefined);assert.equal(view.active.reward,undefined);assert.equal(view.europe.campaign.history.length,3);const result=settle(s,156000);assert.equal(wonMatch(result),false);assert.equal(drawnMatch(result),false);assert.equal(s.career.losses,1);assert.equal(s.career.draws,0);assert.equal(s.europe.campaign.status,'eliminated');assert.equal(s.played,0);assert.equal(s.points,0);
});
test('winning all three knockout ties gives one trophy and one fixed final bonus without altering league or domestic cup',()=>{
 const s=groupWon(entered());s.players.forEach(p=>{p.rating=99;p.potential=99});const domestic=structuredClone(s.cup);let final;
 for(let i=0;i<3;i++){const next=europeView(s).campaign.nextMatch;assert.equal(next.opposition,[96,98,99][i]);act(s,'europe-match',{},120000+i*40000,()=>.49);const expected=s.active.reward,before=s.money;final=settle(s,156000+i*40000);assert.equal(final.home,final.away);assert.equal(final.europeWon,true);assert(final.penalties.home>final.penalties.away);assert.equal(s.money,before+expected+(i===2?10000:0));if(i<2)assert.equal(final.europeChampion,undefined)}
 assert.equal(final.europeChampion,true);assert.equal(final.europeTrophyReward,10000);assert.equal(s.career.europeanTitles,1);assert.equal(s.europe.campaign.status,'champion');assert.equal(s.europe.campaign.history.length,6);assert.equal(s.europe.history[0].champion,true);assert.equal(s.europe.completedCampaigns,1);assert.equal(s.career.matches,6);assert.equal(s.career.wins,6);assert.equal(s.daily.wins,6);assert.equal(s.career.topFlightTitles,0);assert.equal(s.played,0);assert.equal(s.points,0);assert.deepEqual(s.cup,domestic);const balance=s.money;settle(s,1e6);assert.equal(s.money,balance);assert.equal(s.career.europeanTitles,1);assert.throws(()=>act(s,'europe-match'),EuropeError);assert.throws(()=>act(s,'europe-enter'),EuropeError);
});
test('all European actions respect the one-active-match lock without consuming a pending entry',()=>{
 const s=qualified();act(s,'match');assert.throws(()=>act(s,'europe-enter'),/kampen/);assert(s.europe.pendingEntry);settle(s,36000);act(s,'europe-enter',{},40000);act(s,'match',{},40000);assert.throws(()=>act(s,'europe-match',{},40000),/allerede/);assert.equal(s.europe.campaign.groupPlayed,0);settle(s,76000);act(s,'europe-match',{},80000);assert.equal(europeView(s).active,true);assert.equal(europeView(s).canPlay,false);
});
test('European campaign history stays bounded while completed campaigns and titles persist',()=>{
 const s=createGame(0);s.players.forEach(p=>{p.rating=99;p.potential=99});let now=0;for(let season=1;season<=25;season++){
  qualifyEurope(s,{tier:8,rank:1,points:30,season});act(s,'europe-enter',{},now);for(let i=0;i<6;i++){play(s,now,i<3?()=>.1:()=>.49);now+=40000}
 }assert.equal(s.career.europeanTitles,25);assert.equal(s.europe.completedCampaigns,25);assert.equal(s.europe.history.length,20);assert.equal(s.europe.history[0].entrySeason,25);assert.equal(s.europe.history.at(-1).entrySeason,6);assert.equal(s.europe.campaign.history.length,6);assert.equal(publicState(s,now).europe.titles,25);
});
test('SQLite retries consume one entry and settle a European final once, with typed errors for replay attempts',async()=>{
 const env={DB:database(),AUTH_PEPPER:TEST_PEPPER},headers={Origin:'https://europe.test',Cookie:'__Host-touchline='+tokenFor('a'),'Content-Type':'application/json'};
 const get=()=>worker.fetch(new Request('https://europe.test/api/game',{headers}),env);const post=a=>worker.fetch(new Request('https://europe.test/api/game',{method:'POST',headers,body:JSON.stringify(a)}),env);const save=s=>env.DB.sqlite.prepare('UPDATE clubs SET state=? WHERE user_id=?').run(JSON.stringify(s),'a');const saved=()=>JSON.parse(env.DB.sqlite.prepare('SELECT state FROM clubs WHERE user_id=?').get('a').state);await get();
 const s=qualified();s.last=Date.now();save(s);const enter={id:'enter-once',type:'europe-enter'};assert((await Promise.all([post(enter),post(enter)])).every(r=>r.status===200));assert.equal(saved().europe.campaigns,1);assert.equal(saved().europe.pendingEntry,null);
 const begun={id:'match-once',type:'europe-match',reward:999999};assert((await Promise.all([post(begun),post(begun)])).every(r=>r.status===200));assert.equal(saved().europe.campaign.history.length,0);assert.equal(saved().active.id,'match-once');
 const final=groupWon(entered());final.players.forEach(p=>{p.rating=99;p.potential=99});play(final,120000,()=>.49);play(final,160000,()=>.49);act(final,'europe-match',{},200000,()=>.49);final.active.ends=Date.now()-1;final.last=Date.now();const cash=final.money,reward=final.active.reward;save(final);assert((await Promise.all([get(),get()])).every(r=>r.status===200));const complete=saved();assert.equal(complete.career.europeanTitles,1);assert.equal(complete.europe.history.length,1);assert.equal(complete.europe.completedCampaigns,1);assert(complete.money>=cash+reward+10000&&complete.money<cash+reward+10020);assert.equal((await post({id:'replay',type:'europe-enter'})).status,400);assert.equal((await post({id:'replay-match',type:'europe-match'})).status,400);
});
