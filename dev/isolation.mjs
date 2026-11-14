// Fælles spærring mod produktion for Touchline-testmiljøet.
// Bruges af den lokale server, seed-scriptet og tests/production-isolation.test.mjs.

// Miljøvariabler, der kunne indeholde produktionshemmeligheder eller adgang til hosting.
// Testmiljøet nægter at starte, hvis nogen af dem er sat.
export const FORBIDDEN_ENV = Object.freeze([
  'AUTH_PEPPER',
  'MAIL_API_KEY',
  'MAIL_FROM',
  'RESEND_API_KEY',
  'SUPPORT_TO',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CF_API_TOKEN',
  'TOUCHLINE_KEYSTORE',
  'TOUCHLINE_STORE_PASSWORD',
  'TOUCHLINE_KEY_ALIAS',
  'TOUCHLINE_KEY_PASSWORD',
]);

// Produktionsværter og -identiteter, som testkode aldrig må referere til.
// Strengene er samlet af dele, så denne fil ikke selv udløser kildescanningen.
export const PRODUCTION_MARKERS = Object.freeze([
  ['playtouchline', 'dk'].join('.'),
  ['chatgpt', 'site'].join('.'),
  ['chatgpt-team', 'site'].join('.'),
  ['glowing', 'conch1'].join(''),
  ['api', 'resend', 'com'].join('.'),
  ['appgprj', '6af2aae285b4819197ce6b2f387de930'].join('_'),
]);

export const LOCAL_HOSTS = Object.freeze(['127.0.0.1', 'localhost', '::1', '[::1]']);

export class IsolationError extends Error {}

/** Kaster IsolationError, hvis en forbudt miljøvariabel er sat. */
export function assertSafeEnvironment(env = process.env) {
  const found = FORBIDDEN_ENV.filter((name) => typeof env[name] === 'string' && env[name] !== '');
  if (found.length) {
    throw new IsolationError(
      `Testmiljøet starter ikke, fordi følgende variabler er sat: ${found.join(', ')}. ` +
        'Fjern dem – testmiljøet bruger kun egne testhemmeligheder.',
    );
  }
}

/** Returnerer produktionsmarkører, som findes i teksten (små/store bogstaver ignoreres). */
export function productionMarkersIn(text) {
  const lower = String(text).toLowerCase();
  return PRODUCTION_MARKERS.filter((marker) => lower.includes(marker.toLowerCase()));
}

/**
 * Erstatter globalThis.fetch og WebSocket, så al udgående netværkstrafik fra
 * Worker-koden blokeres. Blokerede forsøg registreres i den returnerede liste.
 */
export function installNetworkGuard(target = globalThis) {
  const blocked = [];
  const original = { fetch: target.fetch, WebSocket: target.WebSocket };
  target.fetch = async function blockedFetch(input) {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    blocked.push({ url, at: Date.now() });
    throw new IsolationError(`Udgående forbindelse blokeret af testmiljøet: ${url}`);
  };
  if (typeof target.WebSocket === 'function') {
    target.WebSocket = function blockedWebSocket(url) {
      blocked.push({ url: String(url), at: Date.now() });
      throw new IsolationError(`WebSocket blokeret af testmiljøet: ${url}`);
    };
  }
  return {
    blocked,
    restore() {
      target.fetch = original.fetch;
      if (original.WebSocket) target.WebSocket = original.WebSocket;
    },
  };
}
