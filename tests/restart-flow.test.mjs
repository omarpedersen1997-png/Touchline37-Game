import{test}from'node:test';
import assert from'node:assert/strict';
import{DatabaseSync}from'node:sqlite';
import{createHash}from'node:crypto';
import{mkdtempSync,readFileSync,rmSync,statSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{TEST_PEPPER,tokenFor}from'./database.mjs';

const origin='https://restart-flow.test';
let workerGeneration=0;
function openDatabase(path,{seed=false,now}){
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys = ON');
 if(seed){
  for(const migration of['0000_clubs.sql','0001_email_auth.sql','0002_support_messages.sql','0003_account_mail.sql','0004_remove_recovery_codes.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+migration,import.meta.url),'utf8'));
  for(const account of['a','b']){
   sqlite.prepare('INSERT INTO accounts (id,email,password_hash,password_salt,recovery_hash,credential_version,created_at) VALUES (?,?,?,?,?,1,?)').run(account,account+'@example.test','test-hash','test-salt','',now);
   sqlite.prepare('INSERT INTO sessions (token_hash,account_id,credential_version,expires_at) VALUES (?,?,1,?)').run(createHash('sha256').update(tokenFor(account)).digest('hex'),account,now+86400000);
  }
 }
 return{sqlite,prepare(sql){let args=[];return{bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){const result=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(result.changes)}}}}},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};
}
async function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),'touchline-restart-')),path=join(directory,'clubs.sqlite');
 const realNow=Date.now;let now=1800000000000;Date.now=()=>now;
 let db=openDatabase(path,{seed:true,now});let worker=(await import(new URL('../dist/server/index.js?restart='+workerGeneration++,import.meta.url))).default;
 const env={AUTH_PEPPER:TEST_PEPPER,DB:db};let restarts=0;
 t.after(()=>{db.sqlite.close();Date.now=realNow;rmSync(directory,{recursive:true,force:true})});
 const request=async(action=null,account='a')=>{
  const response=await worker.fetch(new Request(origin+'/api/game',{method:action?'POST':'GET',headers:{Origin:origin,Cookie:'__Host-touchline='+tokenFor(account),'Content-Type':'application/json'},...(action?{body:JSON.stringify(action)}:{})}),env);
  return{status:response.status,data:await response.json()};
 };
 const ok=async(action=null,account='a')=>{const result=await request(action,account);assert.equal(result.status,200,JSON.stringify(result.data));return result.data};
 const restart=async()=>{
  assert(statSync(path).size>0);assert.equal(readFileSync(path).subarray(0,16).toString(),'SQLite format 3\0');
  const oldDB=db,oldWorker=worker;db.sqlite.close();db=openDatabase(path,{now});env.DB=db;
  worker=(await import(new URL('../dist/server/index.js?restart='+workerGeneration++,import.meta.url))).default;
  assert.notEqual(db,oldDB);assert.notEqual(worker,oldWorker);restarts++;
 };
 return{request,ok,restart,setNow:value=>{now=value},advance:ms=>{now+=ms},get now(){return now},get restarts(){return restarts}};
}

test('disk restart preserves active match, unlocks DNA after settlement and never repeats match points or rewards',{concurrency:false},async t=>{
 const f=await fixture(t);const initial=(await f.ok()).state,baselineStrength=initial.strength;
 const matchAction={id:'persisted-match',type:'match'};const active=(await f.ok(matchAction)).state.active;assert(active);assert.equal(active.home,0);assert.equal(active.away,0);
 const locked=await f.request({id:'locked-dna',type:'dna-select',key:'ambition'});assert.equal(locked.status,400);assert.match(locked.data.error,/kampen/);
 await f.restart();const restored=(await f.ok()).state;assert.equal(restored.active.id,active.id);assert.equal(restored.expansion.dna,null);assert.equal(restored.expansion.points,2);
 f.setNow(active.ends);const settled=await f.ok();assert.equal(settled.state.active,null);assert.equal(settled.state.career.matches,1);assert.equal(settled.state.expansion.points,3);assert(settled.result);
 const afterMatch=settled.state.money,fanCount=settled.state.supporters;const dna={id:'dna-after-match',type:'dna-select',key:'ambition'};const chosen=(await f.ok(dna)).state;
 assert.equal(chosen.expansion.dna,'ambition');assert.equal(chosen.money,afterMatch);assert.equal(chosen.strength,baselineStrength+1);
 for(let i=0;i<2;i++){
  await f.restart();const view=(await f.ok()).state;assert.equal(view.expansion.dna,'ambition');assert.equal(view.expansion.points,3);assert.equal(view.career.matches,1);assert.equal(view.money,afterMatch);assert.equal(view.supporters,fanCount);
  for(const action of[matchAction,dna]){const retry=(await f.ok(action)).state;assert.equal(retry.active,null);assert.equal(retry.expansion.points,3);assert.equal(retry.career.matches,1);assert.equal(retry.money,afterMatch)}
 }
 assert.equal(f.restarts,3);
});

test('research survives an interrupted Worker and on-disk reload; completion and income bonus activate exactly once',{concurrency:false},async t=>{
 const f=await fixture(t);const initial=(await f.ok()).state;const start={id:'research-start',type:'research-start',key:'commerce1'};const started=(await f.ok(start)).state;
 assert.equal(started.money,initial.money-900);assert.equal(started.expansion.points,1);const project=started.expansion.activeResearch;
 f.advance(60000);const beforeRestart=(await f.ok()).state;await f.restart();const restored=(await f.ok()).state;
 assert.equal(restored.money,beforeRestart.money);assert.deepEqual(restored.expansion.activeResearch,project);assert.equal(restored.expansion.researchCompleted,0);
 const early=await f.request({id:'too-early',type:'research-complete'});assert.equal(early.status,400);
 f.setNow(project.ends);const completion={id:'complete-research',type:'research-complete'};const completed=(await f.ok(completion)).state;
 assert.equal(completed.expansion.activeResearch,null);assert.equal(completed.expansion.researchCompleted,1);assert.equal(completed.expansion.bonuses.incomePercent,3);assert.equal(completed.money,initial.money-900+(project.ends-project.started)/1000*initial.rate);
 const expectedBonus=completed.finance.researchBonus;assert(Math.abs(expectedBonus-.09)<1e-10);assert(Math.abs(completed.rate-3.09)<1e-10);
 await f.restart();const persisted=(await f.ok()).state;assert.equal(persisted.money,completed.money);assert.equal(persisted.expansion.researchCompleted,1);assert.equal(persisted.finance.researchBonus,expectedBonus);
 const replay=(await f.ok(completion)).state;assert.equal(replay.money,completed.money);assert.equal(replay.expansion.researchCompleted,1);
 assert.equal((await f.request({id:'second-completion',type:'research-complete'})).status,400);
 f.advance(1000);const earning=(await f.ok()).state;assert(Math.abs(earning.money-completed.money-completed.rate)<1e-8);
 await f.restart();const final=(await f.ok()).state;assert.equal(final.money,earning.money);assert.equal(final.expansion.researchCompleted,1);assert.equal(final.finance.researchBonus,expectedBonus);
 assert.equal(f.restarts,3);
});

test('saved club design survives repeated disk and Worker restarts, ignores stale save retries and stays private to its account',{concurrency:false},async t=>{
 const f=await fixture(t);const initial=(await f.ok()).state;const otherInitial=(await f.ok(null,'b')).state;
 const firstStyle={color:'teal',pattern:'stripe',crest:'diamond',motto:'Fremad sammen'};const first={id:'save-first-style',type:'club-style',style:firstStyle};const saved=(await f.ok(first)).state;assert.deepEqual(saved.clubStyle,firstStyle);
 for(let i=0;i<2;i++){
  f.advance(5000);await f.restart();const view=(await f.ok()).state;assert.deepEqual(view.clubStyle,firstStyle);assert.equal(view.expansion.points,initial.expansion.points);assert.deepEqual(view.players.map(p=>p.id),initial.players.map(p=>p.id));
  const other=(await f.ok(null,'b')).state;assert.deepEqual(other.clubStyle,otherInitial.clubStyle);assert.equal(other.expansion.dna,null);
 }
 const newerStyle={color:'blue',pattern:'hoop',crest:'round',motto:'Én klub. Én drøm.'};await f.ok({id:'save-new-style',type:'club-style',style:newerStyle});const staleReplay=(await f.ok(first)).state;assert.deepEqual(staleReplay.clubStyle,newerStyle);
 await f.restart();const final=(await f.ok()).state;assert.deepEqual(final.clubStyle,newerStyle);assert.deepEqual((await f.ok(null,'b')).state.clubStyle,otherInitial.clubStyle);assert.equal(f.restarts,3);
});
