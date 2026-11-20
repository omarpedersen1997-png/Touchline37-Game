import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {javaCommand,jsonJar,nativeClasspath} from './support/native-java.mjs';

for(const testBuild of [false,true])test(`real native cancellation preserves ${testBuild?'test handshake':'production'} isolation and legacy callers`,()=>{
 const classes=mkdtempSync(join(tmpdir(),'touchline-native-cancel-'));
 try{
  const root='tests/java/bridge';
  const stubs=readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.java')&&!p.endsWith('BuildConfig.java')&&!p.endsWith('TouchlineApiBridgeTest.java')).map(p=>join(root,p));
  const config=join(classes,'BuildConfig.java');
  const endpoint=testBuild?'https://touchline37-engine11-test.glowingconch1.chatgpt.site':'https://touchline-idle-club.glowingconch1.chatgpt.site';
  writeFileSync(config,`package dk.touchline.footballidle; public final class BuildConfig {public static final boolean TOUCHLINE_TEST_BUILD=${testBuild};public static final String TOUCHLINE_API="${endpoint}";}`);
  const json=jsonJar();
  const sources=['android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java','android/app/src/main/java/dk/touchline/footballidle/TouchlineEndpoint.java','android/app/src/main/java/dk/touchline/footballidle/TouchlineRequestPolicy.java','tests/java/testbridge/dk/touchline/footballidle/TouchlineApiCancelTest.java',config,...stubs];
  const compile=spawnSync(javaCommand('javac'),['-encoding','UTF-8','-cp',json,'-d',classes,...sources],{encoding:'utf8',timeout:30000});
  assert.equal(compile.status,0,compile.stderr||compile.error?.message);
  const run=spawnSync(javaCommand('java'),['-cp',nativeClasspath(classes,json),'dk.touchline.footballidle.TouchlineApiCancelTest'],{encoding:'utf8',timeout:15000});
  assert.equal(run.status,0,run.stderr||run.error?.message);assert.match(run.stdout,/queued credentials never sent/);assert.match(run.stdout,/every call settles once/);
 }finally{rmSync(classes,{recursive:true,force:true});}
});
