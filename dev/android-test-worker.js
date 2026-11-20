// Særskilt API-indgang til Android-testappen. Må aldrig bruges af build.mjs.
// Byg denne fil med engine-versions-local.js som erstatning for de fælles
// produktionsversionsregler. Ingen gameplaykode ændres eller kopieres her.
import gameWorker from '../worker/index.js';
import { authenticatedUser } from '../worker/auth.js';
import { matchVersionInfo } from '../shared/engine-versions.js';

export const ANDROID_TEST_ENVIRONMENT = 'touchline37-engine11-test';
export const ANDROID_TEST_PEPPER_PREFIX = 'engine11-test-only-';
export const ANDROID_TEST_ACCOUNTS = Object.freeze([
  'test1@touchline.invalid', 'test2@touchline.invalid', 'test3@touchline.invalid',
]);
const ACCOUNTS = new Set(ANDROID_TEST_ACCOUNTS);
const AUTH_ROUTES = new Set(['login', 'logout', 'me', 'capabilities'].map((name) => '/api/auth/' + name));
const START_ACTIONS = new Set(['match', 'player-career-match']);
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Touchline-Test-Engine': '11' },
});

/** Læser kun: en database uden særskilt testmarkør bliver aldrig taget i brug. */
export async function isAndroidTestEnvironment(env) {
  const versions = matchVersionInfo();
  if (versions.latest !== 11 || !versions.supported.includes(11)) return false;
  if (env?.TOUCHLINE_TEST_ENVIRONMENT !== ANDROID_TEST_ENVIRONMENT || !env.DB) return false;
  if (typeof env.AUTH_PEPPER !== 'string' || env.AUTH_PEPPER.length < 50
    || !env.AUTH_PEPPER.startsWith(ANDROID_TEST_PEPPER_PREFIX)) return false;
  try {
    const marker = await env.DB.prepare('SELECT environment FROM touchline_test_environment WHERE environment = ?')
      .bind(ANDROID_TEST_ENVIRONMENT).first();
    return marker?.environment === ANDROID_TEST_ENVIRONMENT;
  } catch { return false; }
}

/** KUN DB og egen testpepper videresendes: ingen mailnøgler, lager eller tjenester. */
function isolatedBindings(env) { return { DB: env.DB, AUTH_PEPPER: env.AUTH_PEPPER }; }

export default {
  async fetch(request, env, context) {
    if (!await isAndroidTestEnvironment(env)) {
      return json({ error: 'Det isolerede Android-testmiljø er ikke konfigureret.', isolated: false }, 503);
    }
    const path = new URL(request.url).pathname;
    if (path === '/api/test-environment') {
      if (request.method !== 'GET') return json({ error: 'Metoden er ikke understøttet.' }, 405);
      return json({ isolated: true, engine: 11, engineRevision: 2, environment: ANDROID_TEST_ENVIRONMENT });
    }
    // Dette er en native API, ikke en browserbaseret adgang til testdatabasen.
    if (request.headers.get('X-Touchline-Test-Engine') !== '11'
      || request.headers.get('Origin') !== 'https://localhost') {
      return json({ error: 'Brug den separate Android-testapp.' }, 403);
    }
    if (path !== '/api/game' && !AUTH_ROUTES.has(path)) {
      return json({ error: 'Funktionen er slået fra i testmiljøet.' }, 403);
    }
    const bindings = isolatedBindings(env);
    if (path === '/api/auth/capabilities' && request.method === 'GET') {
      return json({ emailDelivery: false, testEnvironment: true, registration: false, accountChanges: false });
    }
    let next = request;
    if (path === '/api/auth/login') {
      if (request.method !== 'POST') return json({ error: 'Metoden er ikke understøttet.' }, 405);
      const text = await request.text();
      if (text.length > 4096) return json({ error: 'For stor forespørgsel.' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'Ugyldig forespørgsel.' }, 400); }
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!ACCOUNTS.has(email)) return json({ error: 'Kun de fiktive testkonti kan bruges her.' }, 403);
      const headers = new Headers(request.headers);
      headers.delete('Content-Length');
      next = new Request(request.url, { method: 'POST', headers, body: text });
    } else {
      // Selv en gyldig session fra en uvedkommende lokal konto må ikke åbnes.
      let account;
      try { account = await authenticatedUser(request, bindings); }
      catch { return json({ error: 'Login er midlertidigt utilgængeligt.' }, 503); }
      if (account && !ACCOUNTS.has(account.email)) {
        return json({ error: 'Kun de fiktive testkonti kan bruges her.' }, 403);
      }
    }
    if (path === '/api/game' && request.method === 'POST') {
      const text = await request.text();
      if (text.length > 16384) return json({ error: 'For stor forespørgsel.' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { /* Den normale API validerer fejlformatet. */ }
      const headers = new Headers(request.headers);
      headers.delete('Content-Length');
      const start = body && !Array.isArray(body) && START_ACTIONS.has(body.type) && body.control === 'manual';
      const revision = request.headers.get('X-Touchline-Test-Engine-Revision');
      if (start && revision !== null && revision !== '1' && revision !== '2')
        return json({ error: 'Kamprevisionen understøttes ikke.' }, 400);
      let payload = body;
      if (start) {
        payload = { ...body, manualVersion: 11 };
        delete payload.engineRevision;
        if (revision === '2') payload.engineRevision = 2;
      }
      next = new Request(request.url, {
        method: 'POST', headers,
        body: start ? JSON.stringify(payload) : text,
      });
    }
    const response = await gameWorker.fetch(next, bindings, context);
    const copy = new Response(response.body, response);
    copy.headers.set('Cache-Control', 'no-store');
    copy.headers.set('X-Robots-Tag', 'noindex, nofollow');
    copy.headers.set('X-Touchline-Test-Engine', '11');
    return copy;
  },
};
