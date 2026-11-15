// Opretter en SEPARAT, lokal signeringsnøgle til testappen "Touchline TEST".
//
//   node dev/android-test-key.mjs
//
// - Nøglen og dens kodeord gemmes i .dev-data/android/ (ignoreres af Git, filrettigheder 600).
// - Den bruges kun af byggevarianten touchlineTest og kan aldrig opdatere APK 37,
//   fordi testappen har sit eget applicationId (dk.touchline.footballidle.test).
// - En eksisterende testnøgle overskrives aldrig.
// - Produktionens signeringsnøgle røres, læses eller kopieres ikke.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const KEY_DIR = resolve(ROOT, '.dev-data', 'android');
export const KEY_FILE = resolve(KEY_DIR, 'touchline-test.jks');
export const PROPS_FILE = resolve(KEY_DIR, 'touchline-test.properties');
export const KEY_ALIAS = 'touchline-test';
// Certifikatet bag den eksisterende APK 37 (offentligt fingeraftryk). Testnøglen må aldrig ligne det.
export const PRODUCTION_CERT_SHA256 = '968e6554f40e6cdc7e134c731c3ec42402c3fb9181f3e015b614da7d81d0204b';

export function certificateSha256(keystore, password) {
  const output = execFileSync('keytool', ['-list', '-v', '-keystore', keystore, '-storepass', password, '-alias', KEY_ALIAS], { encoding: 'utf8' });
  const match = /SHA256:\s*([0-9A-F:]+)/i.exec(output);
  return match ? match[1].replace(/:/g, '').toLowerCase() : null;
}

export function createTestKey({ dir = KEY_DIR } = {}) {
  const keyFile = resolve(dir, 'touchline-test.jks');
  const propsFile = resolve(dir, 'touchline-test.properties');
  if (existsSync(keyFile) || existsSync(propsFile)) {
    return { created: false, file: keyFile };
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const password = randomBytes(24).toString('base64url');
  execFileSync(
    'keytool',
    [
      '-genkeypair', '-keystore', keyFile, '-storetype', 'PKCS12', '-alias', KEY_ALIAS,
      '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650',
      '-storepass', password, '-keypass', password,
      '-dname', 'CN=Touchline TEST, OU=Kun test, O=Touchline lokal testnoegle',
    ],
    { stdio: 'ignore' },
  );
  chmodSync(keyFile, 0o600);
  writeFileSync(propsFile, `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=${KEY_ALIAS}\n`, { mode: 0o600 });
  const fingerprint = certificateSha256(keyFile, password);
  if (!fingerprint || fingerprint === PRODUCTION_CERT_SHA256) throw new Error('Testnøglen kunne ikke verificeres som en separat nøgle.');
  return { created: true, file: keyFile, propsFile, fingerprint };
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const result = createTestKey();
    if (!result.created) {
      console.log(`Testnøglen findes allerede og overskrives ikke: ${result.file}`);
    } else {
      console.log(`Separat testnøgle oprettet: ${result.file}`);
      console.log(`Certifikat-SHA256 (offentligt): ${result.fingerprint}`);
      console.log('Kodeordet ligger kun lokalt i .dev-data/android/touchline-test.properties og vises ikke.');
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
