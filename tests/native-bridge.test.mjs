import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodeInputs,directionMask,SHOOT,PASS,INPUT_COUNT,commandForTactic} from '../shared/football-tactics.js';

// Compile the actual production Capacitor bridge, replacing only unavailable
// Android/Capacitor/vault surfaces with explicitly test-only JVM stubs.
test('actual native plugin uploads a complete engine8 recording and rejects oversize before opening HTTPS',()=>{
 const workspaceJdk='/workspace/android-tools/jdk-21.0.13+9';
 const javaHome=process.env.JAVA_HOME||(existsSync(join(workspaceJdk,'bin/javac'))?workspaceJdk:null);
 const java=name=>javaHome?join(javaHome,'bin',name):name;
 const classes=mkdtempSync(join(tmpdir(),'touchline-native-bridge-'));
 try{
  const fixtureRoot='tests/java/bridge';
  const stubs=readdirSync(fixtureRoot,{recursive:true}).filter(file=>file.endsWith('.java')).map(file=>join(fixtureRoot,file));
  const sources=['android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java','android/app/src/main/java/dk/touchline/footballidle/TouchlineRequestPolicy.java','android/app/src/main/java/dk/touchline/footballidle/TouchlineEndpoint.java',...stubs];
  const compile=spawnSync(java('javac'),['-encoding','UTF-8','-d',classes,...sources],{encoding:'utf8',timeout:30000});
  assert.equal(compile.status,0,compile.stderr||compile.error?.message);
  assert(existsSync(join(classes,'dk/touchline/footballidle/TouchlineApiPlugin.class')),'production plugin class must compile');
  const inputs=encodeInputs(Uint16Array.from({length:INPUT_COUNT},(_,i)=>i===0?commandForTactic('attacking'):directionMask(Math.sin(i*.03),-1)|(i%37===0?SHOOT:0)|(i%53===0?PASS:0)));
  assert.equal(inputs.length,13336);
  const packet=join(classes,'engine8-completion.json');writeFileSync(packet,JSON.stringify({id:'native-bridge-test',type:'manual-match-finish',matchId:'bridge-match',inputs}));
  const run=spawnSync(java('java'),['-cp',classes,'dk.touchline.footballidle.TouchlineApiBridgeTest',packet],{encoding:'utf8',timeout:15000});
  assert.equal(run.status,0,run.stderr||run.error?.message);assert.match(run.stdout,/Actual native bridge passed engine8/);
 }finally{rmSync(classes,{recursive:true,force:true});}
});
