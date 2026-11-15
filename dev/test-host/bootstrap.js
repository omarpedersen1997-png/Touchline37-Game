// Engangs-klargøring af en NY testdatabase. Aldrig del af produktionsbygningen.
// Skemaet skal være migreret på forhånd; denne fil udfører ingen DDL.
import { authRoute } from '../../worker/auth.js';
import { createGame } from '../../worker/game.js';
import {
  ANDROID_TEST_ACCOUNTS, ANDROID_TEST_ENVIRONMENT, ANDROID_TEST_PEPPER_PREFIX,
} from '../android-test-worker.js';

export const TEST_PROJECT_ID = 'appgprj_6af9bc223af88191b6d68d7616afcc25';
export const TEST_ORIGIN = 'https://touchline37-engine11-test.glowingconch1.chatgpt.site';
const ALLOWED = new Set(ANDROID_TEST_ACCOUNTS);
const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
});

export function hasTestHostConfiguration(request, env) {
  return env?.TOUCHLINE_TEST_PROJECT_ID === TEST_PROJECT_ID
    && env.TOUCHLINE_TEST_ORIGIN === TEST_ORIGIN
    && env.TOUCHLINE_TEST_ENVIRONMENT === ANDROID_TEST_ENVIRONMENT
    && new URL(request.url).origin === TEST_ORIGIN
    && !!env.DB
    && typeof env.AUTH_PEPPER === 'string'
    && env.AUTH_PEPPER.length >= 50
    && env.AUTH_PEPPER.startsWith(ANDROID_TEST_PEPPER_PREFIX);
}

/** Kontrollér den eksisterende DB uden at oprette, flytte eller reparere noget. */
export async function assertOnlyTestData(db) {
  // Et D1-kald erstatter tre serielle netværksture. Der kan højst være fire
  // gyldige rækker: én unik miljømarkør og tre unikke tilladte e-mailadresser.
  // Derfor kan LIMIT 8 ikke skjule en uvedkommende række efter gyldige data.
  const rows = (await db.prepare(`
    SELECT 'marker' AS kind, environment AS id, NULL AS email FROM touchline_test_environment
    UNION ALL
    SELECT 'account' AS kind, id, email FROM accounts
    UNION ALL
    SELECT 'orphan' AS kind, c.user_id AS id, NULL AS email
      FROM clubs c LEFT JOIN accounts a ON a.id = c.user_id WHERE a.id IS NULL
    LIMIT 8
  `).all()).results;
  if (!Array.isArray(rows)) throw new Error('Ukendt testdatabase.');
  const markers = [], accounts = [];
  for (const row of rows) {
    if (row.kind === 'marker') {
      if (row.id !== ANDROID_TEST_ENVIRONMENT) throw new Error('Ukendt miljømarkør.');
      markers.push(row.id);
    } else if (row.kind === 'account') {
      if (!ALLOWED.has(row.email)) throw new Error('Databasen indeholder andre konti.');
      accounts.push({ id: row.id, email: row.email });
    } else if (row.kind === 'orphan') throw new Error('Databasen indeholder andre klubber.');
    else throw new Error('Ukendt testdatabase.');
  }
  if (markers.length > 1) throw new Error('Ukendt miljømarkør.');
  return { accounts, initialized: markers.length === 1 };
}

/** Alle mulige skrivekald kontrolleres igen, også INSERT ... RETURNING via first(). */
export function testDataGuard(db) {
  const wrap = (statement, sql) => {
    const readOnly = /^\s*SELECT\b/i.test(sql);
    const before = async () => { if (!readOnly) await assertOnlyTestData(db); };
    return {
      bind(...args) { return wrap(statement.bind(...args), sql); },
      async first(...args) { await before(); return statement.first(...args); },
      async all(...args) { await before(); return statement.all(...args); },
      async run(...args) { await before(); return statement.run(...args); },
    };
  };
  return { prepare(sql) { return wrap(db.prepare(sql), sql); } };
}

async function sameToken(supplied, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([supplied, expected].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function initialClub(index) {
  const state = createGame();
  if (index > 0) {
    state.name = index === 1 ? 'Testby FC' : 'Prøvelund BK';
    state.named = true;
    state.money = index === 1 ? 12000 : 250000;
    state.levels = index === 1 ? { stadium: 4, training: 3, sponsor: 3 }
      : { stadium: 8, training: 7, sponsor: 7 };
  }
  return state;
}

export async function initializeTestDatabase(request, env) {
  if (env?.TOUCHLINE_TEST_SETUP_ENABLED !== 'true') return json({ error: 'Ikke fundet.' }, 404);
  if (request.method !== 'POST') return json({ error: 'Metoden er ikke understøttet.' }, 405);
  if (!hasTestHostConfiguration(request, env)) return json({ error: 'Testkonfiguration afvist.' }, 503);
  const token = env.TOUCHLINE_TEST_SETUP_TOKEN;
  const password = env.TOUCHLINE_TEST_LOGIN_PASSWORD;
  if (typeof token !== 'string' || token.length < 32 || token.length > 256
    || typeof password !== 'string' || password.length < 16 || password.length > 128) {
    return json({ error: 'Klargøringskonfiguration mangler.' }, 503);
  }
  const header = request.headers.get('Authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied || supplied.length > 256 || !await sameToken(supplied, token))
    return json({ error: 'Adgang afvist.' }, 403);
  try {
    await assertOnlyTestData(env.DB);
    const db = testDataGuard(env.DB);
    const bindings = { DB: db, AUTH_PEPPER: env.AUTH_PEPPER };
    let created = 0;
    for (let index = 0; index < ANDROID_TEST_ACCOUNTS.length; index++) {
      const email = ANDROID_TEST_ACCOUNTS[index];
      let account = await db.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
      if (!account) {
        const registration = await authRoute(new Request(TEST_ORIGIN + '/api/auth/register', {
          method: 'POST', headers: { Origin: TEST_ORIGIN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }), bindings);
        // Hverken credentials, Set-Cookie eller auth-fejldetaljer forlader dette flow.
        if (registration.status !== 201) throw new Error('Testkonto kunne ikke oprettes.');
        account = await db.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
        if (!account) throw new Error('Testkonto mangler.');
        created++;
      }
      const club = await db.prepare('SELECT user_id FROM clubs WHERE user_id = ?').bind(account.id).first();
      if (!club) {
        await db.prepare('INSERT OR IGNORE INTO clubs (user_id,state,version) VALUES (?,?,0)')
          .bind(account.id, JSON.stringify(initialClub(index))).run();
      }
    }
    const ready = await assertOnlyTestData(env.DB);
    const count = await db.prepare('SELECT count(*) AS n FROM clubs').first();
    if (ready.accounts.length !== 3 || count?.n !== 3) throw new Error('Testklargøring er ufuldstændig.');
    if (!ready.initialized) {
      await db.prepare('INSERT OR IGNORE INTO touchline_test_environment (environment) VALUES (?)')
        .bind(ANDROID_TEST_ENVIRONMENT).run();
    }
    return json({ initialized: true, environment: ANDROID_TEST_ENVIRONMENT, created, existing: 3 - created });
  } catch {
    return json({ error: 'Testdatabasen kunne ikke klargøres sikkert.' }, 503);
  }
}
