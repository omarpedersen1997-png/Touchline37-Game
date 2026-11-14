import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seeded} from '../worker/progression.js';
import {ensurePlayerCareer,playerCareerAction,settlePlayerCareer,playerCareerView,playerCareerRating,PLAYER_CAREER_MAX_LEVEL} from '../worker/player-career.js';
import worker from '../worker/index.js';
import {database,TEST_PEPPER,tokenFor} from './database.mjs';

const blank=()=>({name:'Klubben',money:4500,players:[{id:'existing',name:'Klubspiller',rating:80}],reserves:[],season:4,tier:3,points:12,active:null});
const create=(position='ANG')=>{const s=blank();playerCareerAction(s,{id:'create',type:'player-career-create',name:'Omar Nord',position},0);return s};
const act=(s,id,kind,now,extra={},random=seeded(id))=>playerCareerAction(s,{id,type:'player-career-'+kind,...extra},now,random);

test('career creation is optional and never replaces an existing club or squad',()=>{
 const s=blank(),before=structuredClone(s);assert.equal(playerCareerView(s,0),null);
 ensurePlayerCareer(s);assert.equal(s.playerCareer,null);
 assert.equal(playerCareerAction(s,{id:'other',type:'unrelated'},0),false);
 act(s,'new','create',0,{name:'  Omar Nord  ',position:'MID'});
 assert.equal(s.playerCareer.name,'Omar Nord');assert.equal(s.playerCareer.position,'MID');
 const {playerCareer,...club}=s;assert.deepEqual(club,before);
 assert.throws(()=>act(s,'new-again','create',1,{name:'Nyt navn',position:'ANG'}),/allerede/);
});
test('career validates names, roles, identifiers and unavailable actions without inventing a player',()=>{
 for(const input of [{name:'O',position:'ANG'},{name:'x'.repeat(25),position:'ANG'},{name:'Good\nName',position:'ANG'},{name:'Omar',position:'UNKNOWN'}]){
  const s=blank();assert.throws(()=>act(s,'invalid','create',0,input));assert.equal(s.playerCareer,null);
 }
 assert.throws(()=>playerCareerAction(blank(),{id:'',type:'player-career-create',name:'Omar',position:'ANG'},0));
 assert.throws(()=>act(blank(),'no-player','match',0),/Opret/);
 const s=create();assert.throws(()=>act(s,'key','train',0,{key:'__proto__'}),/gyldig/);
 assert.throws(()=>act(s,'club','transfer',0,{club:'invented'}),/ikke tilgængelig/);
});
test('completed training grants XP and focus mastery once while all active work is mutually exclusive',()=>{
 const s=create(),wallet=s.playerCareer.wallet;
 act(s,'train1','train',0,{key:'physical'});
 assert.equal(s.playerCareer.wallet,wallet-25);
 act(s,'train1','train',0,{key:'physical'});assert.equal(s.playerCareer.wallet,wallet-25);
 assert.throws(()=>act(s,'overlap','match',1000),/Afslut/);
 assert.throws(()=>act(s,'overlap-allocate','allocate',1000,{key:'physical'}),/Afslut/);
 assert.equal(settlePlayerCareer(s,59999),null);
 const record=settlePlayerCareer(s,60000);assert.equal(record.kind,'training');assert.equal(record.xp,35);
 assert.equal(s.playerCareer.xp,35);assert.equal(s.playerCareer.masteryProgress.physical,1);
 assert.equal(settlePlayerCareer(s,60000),null);assert.equal(s.playerCareer.xp,35);
 for(let i=2;i<=3;i++){act(s,'train'+i,'train',(i-1)*60000,{key:'physical'});settlePlayerCareer(s,i*60000)}
 assert.equal(s.playerCareer.attributes.physical,41);assert.equal(s.playerCareer.masteryProgress.physical,0);
 assert.equal(s.playerCareer.level,2);assert.equal(s.playerCareer.skillPoints,4);
});
test('skill allocation changes playing strength, consumes earned points and obeys the 99 cap',()=>{
 const s=create(),before=playerCareerRating(s.playerCareer),points=s.playerCareer.skillPoints;
 act(s,'allocate1','allocate',0,{key:'technique'});act(s,'allocate2','allocate',0,{key:'technique'});
 assert(playerCareerRating(s.playerCareer)>before);assert.equal(s.playerCareer.skillPoints,points-2);
 assert.throws(()=>act(s,'no-points','allocate',0,{key:'technique'}),/ingen frie/);
 s.playerCareer.skillPoints=2;s.playerCareer.attributes.technique=99;
 assert.throws(()=>act(s,'max','allocate',0,{key:'technique'}),/maksimum/);
 assert.throws(()=>act(s,'max-train','train',0,{key:'technique'}),/maksimum/);
 assert.equal(s.playerCareer.skillPoints,2);
});
test('the public view hides every future match outcome and pays only after the full match duration',()=>{
 const s=create(),wallet=s.playerCareer.wallet;
 act(s,'first-match','match',0);
 const view=playerCareerView(s,1000);
 assert.equal(view.active.kind,'match');assert(view.active.opponent);
 for(const key of ['result','home','away','salary','xp','goals','assists','performance','saves'])assert.equal(view.active[key],undefined);
 assert.equal(view.recentActions,undefined);assert.equal(s.playerCareer.wallet,wallet);
 assert.equal(settlePlayerCareer(s,44999),null);const result=settlePlayerCareer(s,45000);
 assert.equal(s.playerCareer.wallet,wallet+150);assert.equal(s.playerCareer.stats.matches,1);
 assert.equal(s.playerCareer.history[0].home,result.home);
 act(s,'first-match','match',46000);assert.equal(s.playerCareer.active,null);assert.equal(s.playerCareer.stats.matches,1);
 assert.equal(settlePlayerCareer(s,50000),null);
});
test('goalkeepers have meaningful saves and clean sheets without fabricated outfield goals',()=>{
 const s=create('MÅL');act(s,'keeper-match','match',0,{},()=>0);
 const result=settlePlayerCareer(s,45000);
 assert(result.saves>=2);assert.equal(result.goals,0);assert.equal(result.assists,0);
 assert.equal(s.playerCareer.stats.saves,result.saves);assert.equal(s.playerCareer.stats.cleanSheets,1);
 assert.equal(playerCareerView(s,45000).roleLabel,'Målmand');
});
test('a personal winning season awards once and rolls into a fresh season without altering club standings',()=>{
 const s=create(),clubBefore={season:s.season,points:s.points,tier:s.tier,money:s.money};let now=0;
 for(let i=0;i<10;i++){now+=3600000;act(s,'season-match'+i,'match',now,{},()=>0);now+=45000;settlePlayerCareer(s,now)}
 const c=s.playerCareer,last=c.history[0];
 assert.equal(c.stats.matches,10);assert.equal(c.stats.titles,1);assert.equal(c.stats.awards,1);
 assert.equal(last.seasonEnd.points,30);assert.equal(last.seasonEnd.bonus,800);
 assert.equal(last.seasonEnd.objectiveMoney,0);assert.equal(c.wallet,100+1500+800);assert.equal(c.season.number,2);assert.equal(c.season.played,0);
 assert.deepEqual({season:s.season,points:s.points,tier:s.tier,money:s.money},clubBefore);
 assert.equal(settlePlayerCareer(s,now+10000),null);assert.equal(c.stats.titles,1);
});
test('contracts unlock through level, matches, season boundaries and personal finances',()=>{
 const s=create(),c=s.playerCareer;
 let offer=playerCareerView(s,0).offers.find(o=>o.id==='nordskov');assert(!offer.eligible);assert.match(offer.reason,/niveau/);
 c.level=3;c.stats.matches=8;c.wallet=2000;c.season.played=8;
 offer=playerCareerView(s,0).offers.find(o=>o.id==='nordskov');assert(!offer.eligible);assert.match(offer.reason,/mellem/);
 assert.throws(()=>act(s,'midseason','transfer',0,{club:'nordskov'}),/mellem/);
 c.season.played=0;c.wallet=100;
 assert.throws(()=>act(s,'no-funds','transfer',0,{club:'nordskov'}),/karrieresaldo/);
 c.wallet=2000;act(s,'move','transfer',0,{club:'nordskov'});
 assert.equal(c.clubId,'nordskov');assert.equal(c.wallet,400);assert.equal(c.contractHistory.length,1);
 act(s,'move','transfer',0,{club:'nordskov'});assert.equal(c.wallet,400);
 assert.equal(playerCareerView(s,0).club.salary,300);
 assert.throws(()=>act(s,'move-back','transfer',0,{club:'havnebro'}),/højere/);
});
test('level 50 and attribute bounds stay finite during a long saved career',()=>{
 const s=create(),c=s.playerCareer;let now=0;
 c.level=49;c.xp=2019;c.wallet=1e6;
 for(let i=0;i<100;i++){
  now+=3600000;act(s,'long'+i,'match',now,{},seeded('long-personal'+i));now+=45000;settlePlayerCareer(s,now);
  const view=playerCareerView(s,now);
  assert(view.rating>=1&&view.rating<=99);assert(view.level<=PLAYER_CAREER_MAX_LEVEL);assert(view.wallet>=0);
 }
 assert.equal(c.level,50);assert.equal(c.xp,0);assert.equal(playerCareerView(s,now).nextLevelXp,0);
 assert.equal(c.history.length,20);assert.equal(c.recentActions.length,50);
 assert.equal(c.stats.matches,c.stats.wins+c.stats.draws+c.stats.losses);
 assert(!/NaN|Infinity|undefined/.test(JSON.stringify(playerCareerView(s,now))));
 const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(playerCareerView(restored,now),playerCareerView(s,now));
});
test('view mutation cannot change the saved career and old clubs migrate with no fabricated career',()=>{
 const s=create(),view=playerCareerView(s,0);view.attributes.technique=99;view.club.salary=1e9;view.stats.matches=100;
 assert.equal(s.playerCareer.attributes.technique,45);assert.equal(s.playerCareer.stats.matches,0);
 assert.equal(playerCareerView(s,0).club.salary,150);
 const old=blank();ensurePlayerCareer(old);assert.equal(old.playerCareer,null);assert.equal(playerCareerView(old,0),null);
});

test('saving and reopening an active match retains the original outcome rather than rerolling it',()=>{
 const s=create();act(s,'saved-match','match',1000);
 const restored=JSON.parse(JSON.stringify(s));
 assert.deepEqual(playerCareerView(restored,10000),playerCareerView(s,10000));
 const expected=settlePlayerCareer(s,46000),actual=settlePlayerCareer(restored,46000);
 assert.deepEqual(actual,expected);assert.deepEqual(restored.playerCareer,s.playerCareer);
 assert.equal(settlePlayerCareer(restored,50000),null);
});

test('developing attributes measurably improves match results against the same seeded opponents',()=>{
 const low=create(),high=create();high.playerCareer.attributes={technique:99,physical:99,reading:99};
 let now=0,lowPerformance=0,highPerformance=0;
 for(let i=0;i<100;i++){
  now+=3600000;for(const s of [low,high])act(s,'rating-test'+i,'match',now,{},seeded('rating-proof'+i));
  now+=45000;
  lowPerformance+=settlePlayerCareer(low,now).performance;
  highPerformance+=settlePlayerCareer(high,now).performance;
 }
 assert(high.playerCareer.stats.wins>low.playerCareer.stats.wins);
 assert(highPerformance>lowPerformance);
});

test('authenticated API hides career outcomes and concurrent refreshes settle one personal wage',async()=>{
 const env={DB:database(),AUTH_PEPPER:TEST_PEPPER};
 const real=Date.now;let now=1000000;Date.now=()=>now;
 const request=action=>new Request('https://career.test/api/game',{method:action?'POST':'GET',headers:{Cookie:'__Host-touchline='+tokenFor('a'),...(action?{'Content-Type':'application/json',Origin:'https://career.test'}:{})},...(action?{body:JSON.stringify(action)}:{})});
 try{
  let response=await worker.fetch(request({id:'api-create-player',type:'player-career-create',name:'API spiller',position:'MÅL'}),env);
  assert.equal(response.status,200);
  let data=await response.json();assert.equal(data.state.playerCareer.name,'API spiller');assert.equal(data.state.money,1500);
  response=await worker.fetch(request({id:'api-personal-match',type:'player-career-match'}),env);assert.equal(response.status,200);
  data=await response.json();assert.equal(data.state.playerCareer.active.kind,'match');
  assert.equal(data.state.playerCareer.active.result,undefined);assert.equal(data.state.playerCareer.active.home,undefined);assert.equal(data.state.playerCareer.recentActions,undefined);
  assert.equal(data.state.playerCareer.stats.matches,0);assert.equal(data.state.playerCareer.wallet,100);
  now+=45000;
  const refreshed=await Promise.all([worker.fetch(request(),env),worker.fetch(request(),env)]);
  assert(refreshed.every(r=>r.status===200));
  const stored=JSON.parse(env.DB.sqlite.prepare('SELECT state FROM clubs WHERE user_id=?').get('a').state);
  assert.equal(stored.playerCareer.stats.matches,1);assert.equal(stored.playerCareer.wallet,250);assert.equal(stored.playerCareer.active,null);
  assert.equal(stored.money,1635);assert.equal(stored.played,0);assert.equal(stored.points,0);
  assert.equal(stored.players.length,11);assert.equal(stored.players[0].name,'Oliver Holm');
 }finally{Date.now=real}
});
