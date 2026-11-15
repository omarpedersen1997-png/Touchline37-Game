// M4: separat Android-testapp "Touchline TEST" (byggevarianten touchlineTest).
// Testappen har eget applicationId, egen testnøgle og egen testserver og må aldrig
// kunne kontakte produktionen. Produktionsvarianterne skal være uændrede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestKey, certificateSha256, PRODUCTION_CERT_SHA256 } from '../dev/android-test-key.mjs';

const read = (file) => readFileSync(file, 'utf8');
const gradle = read('android/app/build.gradle');
const PRODUCTION_API = 'https://touchline-idle-club.glowingconch1.chatgpt.site';
const MARKERS = ['chatgpt.site', 'chatgpt-team.site', 'glowingconch1', 'playtouchline.dk'];

function block(source, name, from = 0) {
  const start = source.indexOf(`\n        ${name} {`, from);
  assert(start >= 0, `blokken ${name} mangler`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('ufuldstændig blok ' + name);
}

test('produktionsvarianterne beholder app-id, version, server og signering', () => {
  assert.match(gradle, /applicationId "dk\.touchline\.footballidle"\n/);
  assert.match(gradle, /versionCode 37\n/);
  assert.match(gradle, /versionName "1\.0\.0"\n/);
  assert(gradle.includes(`buildConfigField "String", "TOUCHLINE_API", "\\"${PRODUCTION_API}\\""`));
  assert(gradle.includes('buildConfigField "boolean", "TOUCHLINE_TEST_BUILD", "false"'));
  const sideload = block(gradle, 'sideload', gradle.indexOf('buildTypes {'));
  assert(sideload.includes('signingConfig signingConfigs.debug'), 'sideload bruger fortsat den eksisterende signeringsidentitet');
  assert(!sideload.includes('applicationIdSuffix'));
  const release = block(gradle, 'release', gradle.indexOf('buildTypes {'));
  assert(release.includes('if (System.getenv("TOUCHLINE_KEYSTORE")) signingConfig signingConfigs.upload'));
  assert(!release.includes('applicationIdSuffix'));
  assert(gradle.includes("The existing APK signing store must be restored before building a sideload update."));
});

test('JVM-testens BuildConfig er identisk med produktionens defaultConfig', () => {
  const stub = read('tests/java/bridge/dk/touchline/footballidle/BuildConfig.java');
  assert(stub.includes(`TOUCHLINE_API = "${PRODUCTION_API}"`));
  assert(stub.includes('TOUCHLINE_TEST_BUILD = false'));
});

test('testvarianten har eget app-id, eget navn, egen nøgle og egen server', () => {
  const variant = block(gradle, 'touchlineTest', gradle.indexOf('buildTypes {'));
  assert(variant.includes('applicationIdSuffix ".test"'), 'app-id dk.touchline.footballidle.test');
  assert(variant.includes('signingConfig signingConfigs.touchlineTest'));
  assert(!variant.includes('signingConfigs.debug') && !variant.includes('signingConfigs.upload'), 'aldrig produktionens nøgler');
  assert(variant.includes('buildConfigField "String", "TOUCHLINE_API", "\\"${touchlineTestApi}\\""'));
  assert(variant.includes('buildConfigField "boolean", "TOUCHLINE_TEST_BUILD", "true"'));
  assert(gradle.includes("project.findProperty('touchlineTestApi') ?: 'https://touchline-test.invalid'"), 'standard er en adresse, der aldrig kan nås');
  const strings = read('android/app/src/touchlineTest/res/values/strings.xml');
  assert(strings.includes('<string name="app_name">Touchline TEST</string>'));
  assert(strings.includes('<string name="title_activity_main">Touchline TEST</string>'));
  assert(read('android/app/src/main/res/values/strings.xml').includes('<string name="app_name">Touchline Football Idle</string>'), 'produktionens navn er uændret');
});

test('testvarianten ændrer hverken logo, ikoner, layout eller kode – kun navnet', () => {
  const files = readdirSync('android/app/src/touchlineTest', { recursive: true }).filter((file) => statSync(join('android/app/src/touchlineTest', file)).isFile());
  assert.deepEqual(files, [join('res', 'values', 'strings.xml')]);
});

test('Gradle-, Java- og testmiljøets spærrelister er ens', () => {
  const gradleList = /touchlineProductionMarkers = \[([^\]]+)\]/.exec(gradle)[1].match(/'([^']+)'/g).map((v) => v.slice(1, -1));
  assert.deepEqual(gradleList, MARKERS);
  const java = read('android/app/src/main/java/dk/touchline/footballidle/TouchlineEndpoint.java');
  for (const marker of MARKERS) assert(java.includes(`"${marker}"`), marker);
  assert(gradle.includes("throw new GradleException(\"Testappen må aldrig pege på produktionsserveren: ${touchlineTestApi}\")"));
  assert(gradle.includes("if (!touchlineTestApi.startsWith('https://')"));
});

test('den native bro tager serveren fra BuildConfig og afviser, når testappen er spærret', () => {
  const plugin = read('android/app/src/main/java/dk/touchline/footballidle/TouchlineApiPlugin.java');
  assert(!plugin.includes(PRODUCTION_API), 'ingen fast produktionsadresse i broen');
  assert(plugin.includes('TouchlineEndpoint.resolve(BuildConfig.TOUCHLINE_API, BuildConfig.TOUCHLINE_TEST_BUILD)'));
  assert(plugin.includes('if (API == null) {'));
  assert(plugin.indexOf('if (API == null)') < plugin.indexOf('queue.execute'), 'spærren virker før der åbnes en forbindelse');
});

test('JVM: TouchlineEndpoint spærrer alle produktionsadresser for testappen', () => {
  const classes = mkdtempSync(join(tmpdir(), 'touchline-endpoint-'));
  try {
    const compile = spawnSync('javac', ['-encoding', 'UTF-8', '-d', classes, 'android/app/src/main/java/dk/touchline/footballidle/TouchlineEndpoint.java', 'tests/java/endpoint/TouchlineEndpointTest.java'], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
    const run = spawnSync('java', ['-cp', classes, 'dk.touchline.footballidle.TouchlineEndpointTest'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
    assert.match(run.stdout, /TouchlineEndpoint sp.rrer produktionen for testappen/);
  } finally {
    rmSync(classes, { recursive: true, force: true });
  }
});

test('testnøglen er separat, privat og overskrives aldrig', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touchline-testkey-'));
  try {
    const first = createTestKey({ dir });
    assert.equal(first.created, true);
    assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
    assert.notEqual(first.fingerprint, PRODUCTION_CERT_SHA256);
    assert.equal(statSync(first.file).mode & 0o777, 0o600);
    assert.equal(statSync(first.propsFile).mode & 0o777, 0o600);
    const password = /storePassword=(.+)/.exec(read(first.propsFile))[1];
    assert.equal(certificateSha256(first.file, password), first.fingerprint);
    const second = createTestKey({ dir });
    assert.equal(second.created, false);
    assert.equal(certificateSha256(first.file, password), first.fingerprint, 'nøglen er uændret');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ingen nøgler eller kodeord kan havne i Git', () => {
  const ignored = read('.gitignore').split(/\r?\n/);
  for (const pattern of ['*.keystore', '*.jks', 'keystore.properties', '.dev-data/']) assert(ignored.includes(pattern), pattern);
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  assert.deepEqual(tracked.filter((file) => /\.(jks|keystore|p12|pfx)$|touchline-test\.properties$/i.test(file)), []);
  assert(gradle.includes("rootProject.file('../.dev-data/android/touchline-test.jks')"), 'testnøglen læses kun fra det ignorerede .dev-data');
});

test('den oprindelige APK 37 er uændret', () => {
  const apk = 'release/downloads/Touchline-1.0.0.apk';
  assert(existsSync(apk));
  const current = JSON.parse(read('release/downloads/current.json'));
  assert.equal(current.versionCode, 37);
  assert.equal(current.sha256, 'b3da8abedb4c96072d0b876ebf4e8bf5dc04c9f1e742c2ca886ff997b60726a0');
});
