import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodeInputs,directionMask,SHOOT,PASS,INPUT_COUNT,commandForTactic} from '../shared/football-tactics.js';

test('real Android transport policy accepts complete engine8 uploads and enforces byte/route boundaries',()=>{
 const workspaceJdk='/workspace/android-tools/jdk-21.0.13+9';
 const javaHome=process.env.JAVA_HOME||(existsSync(join(workspaceJdk,'bin/javac'))?workspaceJdk:null);
 const java=name=>javaHome?join(javaHome,'bin',name):name;
 const classes=mkdtempSync(join(tmpdir(),'touchline-native-policy-'));
 try{
  const compile=spawnSync(java('javac'),['-encoding','UTF-8','-d',classes,'android/app/src/main/java/dk/touchline/footballidle/TouchlineRequestPolicy.java','tests/java/TouchlineRequestPolicyTest.java'],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr||compile.error?.message);
  assert(existsSync(join(classes,'dk/touchline/footballidle/TouchlineRequestPolicy.class')),'the production Java policy must compile');
  const inputs=encodeInputs(Uint16Array.from({length:INPUT_COUNT},(_,i)=>i===0?commandForTactic('attacking'):directionMask(Math.sin(i*.03),-1)|(i%37===0?SHOOT:0)|(i%53===0?PASS:0)));
  assert.equal(inputs.length,13336);
  const action=JSON.stringify({id:'native-policy-test',type:'manual-match-finish',matchId:'match-policy-test',inputs});
  const packet=join(classes,'completion.json');writeFileSync(packet,action);
  const run=spawnSync(java('java'),['-cp',classes,'TouchlineRequestPolicyTest',packet],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.error?.message);assert.match(run.stdout,/Native request policy passed/);
 }finally{rmSync(classes,{recursive:true,force:true});}
});
