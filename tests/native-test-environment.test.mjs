import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { javaCommand, jsonJar, nativeClasspath } from './support/native-java.mjs';

test('actual native test bridge verifies isolation before credentials, selects engine11 and fails closed', () => {
  const classes = mkdtempSync(join(tmpdir(), 'touchline-test-bridge-'));
  try {
    const fixtureRoot = 'tests/java/bridge';
    const stubs = readdirSync(fixtureRoot, { recursive: true })
      .filter((file) => file.endsWith('.java') && !file.endsWith('BuildConfig.java') && !file.endsWith('TouchlineApiBridgeTest.java'))
      .map((file) => join(fixtureRoot, file));
    const buildConfig = join(classes, 'BuildConfig.java');
    writeFileSync(buildConfig, 'package dk.touchline.footballidle; public final class BuildConfig { public static final boolean TOUCHLINE_TEST_BUILD = true; public static final String TOUCHLINE_API = "https://touchline37-engine11-test.glowingconch1.chatgpt.site"; }');
    const json = jsonJar();
    const sources = [
      'android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java',
      'android/app/src/main/java/dk/touchline/footballidle/TouchlineRequestPolicy.java',
      'android/app/src/main/java/dk/touchline/footballidle/TouchlineEndpoint.java',
      'tests/java/testbridge/dk/touchline/footballidle/TouchlineTestApiBridgeTest.java',
      buildConfig, ...stubs,
    ];
    const compile = spawnSync(javaCommand('javac'), ['-encoding', 'UTF-8', '-cp', json, '-d', classes, ...sources], { encoding: 'utf8', timeout: 30000 });
    assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
    const run = spawnSync(javaCommand('java'), ['-cp', nativeClasspath(classes, json), 'dk.touchline.footballidle.TouchlineTestApiBridgeTest'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
    assert.match(run.stdout, /Rejected 21 invalid\/redirect\/error handshakes before credentials/);
    assert.match(run.stdout, /Verified native engine11 headers, process-local cache, reset\/recovery and redirect isolation/);
  } finally {
    rmSync(classes, { recursive: true, force: true });
  }
});

test('test environment verification does not expand the native API route allowlist', () => {
  const policy = readFileSync('android/app/src/main/java/dk/touchline/footballidle/TouchlineRequestPolicy.java', 'utf8');
  assert(!policy.includes('test-environment'));
  const plugin = readFileSync('android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java', 'utf8');
  assert(plugin.includes('if (!BuildConfig.TOUCHLINE_TEST_BUILD || testEnvironmentVerified) return;'));
  assert(plugin.indexOf('verifyTestEnvironment();') < plugin.indexOf('String cookie = vault.read();'));
});
