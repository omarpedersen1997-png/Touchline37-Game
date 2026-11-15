// Netværksstabilitet for spillets API-kald (M3, trin 3).
//
// - Tidsgrænser i webudgaven svarende til Android-broen (15 s forbindelse/læsning).
// - Svar, der ikke er JSON (fx en fejlside fra en proxy), bliver til en læsbar fejl.
// - Sikre automatiske genforsøg – KUN for spillets API (api/game):
//     * hentning (GET) kan altid gentages,
//     * handlinger (POST) gentages kun med præcis samme indhold og dermed samme
//       handlings-id; serveren udfører et kendt id højst én gang (worker/game.js).
//   Login, konto, adgangskode, sletning og kontakt gentages aldrig automatisk.

export const OFFLINE_MESSAGE = 'Forbindelsen til klubben blev afbrudt. Tjek dit internet, og prøv igen.';
export const REQUEST_TIMEOUT_MS = Object.freeze({ GET: 15000, POST: 20000 });
export const RETRY_DELAYS_MS = Object.freeze([400, 1200]);
export const RETRYABLE_STATUS = Object.freeze([502, 503, 504]);
const GAME_API_PATH = /^\/api\/game$/;

export class NetworkError extends Error {
  constructor(message = OFFLINE_MESSAGE, { retryable = true, cause } = {}) {
    super(message);
    this.name = 'NetworkError';
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }
}

/** Har en POST-handling et handlings-id, så den sikkert kan sendes igen? */
export function hasActionId(body) {
  if (typeof body !== 'string') return false;
  try {
    const parsed = JSON.parse(body);
    return !!parsed && typeof parsed === 'object' && typeof parsed.id === 'string' && parsed.id.length > 0 && parsed.id.length <= 100;
  } catch {
    return false;
  }
}

/** Må denne forespørgsel gentages automatisk? */
export function retryAllowed(path, method = 'GET', body = null) {
  // Regulært udtryk i stedet for tekst: hjemmesidens HTML må ikke indeholde spillets API-sti
  // (tests/api.test.mjs), og dette modul indgår også i hjemmesidens bundle via src/api.js.
  if (!GAME_API_PATH.test(path)) return false;
  if (method === 'GET') return true;
  return method === 'POST' && hasActionId(body);
}

/**
 * Gør et ikke-JSON-svar til et JSON-svar med en læsbar fejl og samme status.
 * Svar med JSON-header returneres uændret; uden header afgøres det ud fra indholdet.
 */
export async function normalizeResponse(response) {
  const type = response.headers.get('Content-Type') || '';
  if (/json/i.test(type)) return response;
  const text = await response.clone().text();
  if (!text) return response;
  try {
    JSON.parse(text);
    return response;
  } catch {
    const status = response.ok ? 502 : response.status;
    return new Response(JSON.stringify({ error: OFFLINE_MESSAGE }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Kører én forespørgsel med tidsgrænse.
 * transport(signal) skal returnere en Response. Afbryder kalderen selv (signal), sendes
 * kalderens AbortError uændret videre.
 */
export async function withTimeout(transport, { timeoutMs, signal } = {}) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', forward, { once: true });
  try {
    return await transport(controller.signal);
  } catch (error) {
    if (timedOut) throw new NetworkError(OFFLINE_MESSAGE, { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/**
 * Sender en forespørgsel med tidsgrænse, normaliserede svar og sikre genforsøg.
 * @param {(signal:AbortSignal)=>Promise<Response>} transport
 */
export async function requestWithRetry(transport, { path, method = 'GET', body = null, signal, sleep = defaultSleep, timeouts = REQUEST_TIMEOUT_MS, delays = RETRY_DELAYS_MS } = {}) {
  const retry = retryAllowed(path, method, body);
  const attempts = retry ? delays.length + 1 : 1;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    try {
      const response = await withTimeout(transport, { timeoutMs: method === 'GET' ? timeouts.GET : timeouts.POST, signal });
      if (retry && RETRYABLE_STATUS.includes(response.status) && attempt < attempts - 1) {
        lastError = null;
        continue;
      }
      return await normalizeResponse(response);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error?.retryable === false) throw error;
      lastError = error instanceof NetworkError ? error : new NetworkError(OFFLINE_MESSAGE, { cause: error });
      if (!retry) throw lastError;
    }
  }
  throw lastError ?? new NetworkError();
}
