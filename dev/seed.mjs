// Opretter fiktive testkonti og klubber i den lokale testdatabase.
// Kontiene oprettes gennem den rigtige API-kode (register + /api/game), så
// adgangskoder hashes med den lokale testpepper præcis som i spillet.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openLocalDatabase, memoryBucket } from './local-db.mjs';
import { assertSafeEnvironment, installNetworkGuard } from './isolation.mjs';
import { DEFAULT_DATA_DIR, loadDraftWorker, loadTestPepper } from './local-server.mjs';

// Fiktive konti. .invalid-domænet kan aldrig modtage mail.
export const TEST_ACCOUNTS = Object.freeze([
  { email: 'test1@touchline.invalid', password: 'Touchline-test-1', profile: 'ny', clubName: null },
  { email: 'test2@touchline.invalid', password: 'Touchline-test-2', profile: 'etableret', clubName: 'Testby FC' },
  { email: 'test3@touchline.invalid', password: 'Touchline-test-3', profile: 'rig', clubName: 'Prøvelund BK' },
]);

const ORIGIN = 'http://127.0.0.1:8787';

function adjust(state, profile, clubName) {
  if (clubName) {
    state.name = clubName;
    state.named = true;
  }
  if (profile === 'etableret') {
    state.money = 12000;
    state.levels = { stadium: 4, training: 3, sponsor: 3 };
  }
  if (profile === 'rig') {
    state.money = 250000;
    state.levels = { stadium: 8, training: 7, sponsor: 7 };
  }
  return state;
}

/**
 * Seeder databasen. Eksisterende testkonti springes over.
 * @returns {Promise<{created:string[], skipped:string[]}>}
 */
export async function seed({ db, worker, pepper }) {
  const env = { DB: db, BUCKET: memoryBucket(), AUTH_PEPPER: pepper };
  const created = [];
  const skipped = [];
  for (const account of TEST_ACCOUNTS) {
    const exists = db.sqlite.prepare('SELECT id FROM accounts WHERE email = ?').get(account.email);
    if (exists) {
      skipped.push(account.email);
      continue;
    }
    const registration = await worker.fetch(
      new Request(ORIGIN + '/api/auth/register', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password }),
      }),
      env,
    );
    if (registration.status !== 201) {
      throw new Error(`Kunne ikke oprette ${account.email}: ${registration.status} ${await registration.text()}`);
    }
    const cookie = registration.headers.get('Set-Cookie').split(';')[0];
    const game = await worker.fetch(new Request(ORIGIN + '/api/game', { headers: { Cookie: cookie } }), env);
    if (game.status !== 200) throw new Error(`Kunne ikke oprette klub for ${account.email}: ${game.status}`);

    const { id } = db.sqlite.prepare('SELECT id FROM accounts WHERE email = ?').get(account.email);
    const row = db.sqlite.prepare('SELECT state, version FROM clubs WHERE user_id = ?').get(id);
    const state = adjust(JSON.parse(row.state), account.profile, account.clubName);
    state.version = row.version + 1;
    db.sqlite
      .prepare('UPDATE clubs SET state = ?, version = ? WHERE user_id = ? AND version = ?')
      .run(JSON.stringify(state), state.version, id, row.version);

    // Kontrollér at den justerede klub kan indlæses af den rigtige spilkode.
    const check = await worker.fetch(new Request(ORIGIN + '/api/game', { headers: { Cookie: cookie } }), env);
    if (check.status !== 200) throw new Error(`Testklubben for ${account.email} kunne ikke indlæses: ${check.status}`);
    created.push(account.email);
  }
  return { created, skipped };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    assertSafeEnvironment();
    const guard = installNetworkGuard();
    const db = openLocalDatabase(resolve(DEFAULT_DATA_DIR, 'touchline-dev.sqlite'));
    const result = await seed({ db, worker: await loadDraftWorker(), pepper: loadTestPepper(DEFAULT_DATA_DIR) });
    db.close();
    guard.restore();
    console.log(`Testkonti oprettet: ${result.created.length}, fandtes allerede: ${result.skipped.length}`);
    for (const account of TEST_ACCOUNTS) console.log(`  ${account.email}  /  ${account.password}  (${account.profile})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
