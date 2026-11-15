// Lokal testserver for Touchline 37.
// Kører den eksisterende web-draft-Worker (bygget til web-draft/server.mjs) i Node
// med lokal SQLite-database, en lokal testpepper og et R2-lager i hukommelsen.
// Al udgående netværkstrafik fra Worker-koden blokeres.
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLocalDatabase, memoryBucket } from './local-db.mjs';
import { assertSafeEnvironment, installNetworkGuard, LOCAL_HOSTS } from './isolation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DATA_DIR = resolve(ROOT, '.dev-data');
export const DRAFT_SERVER = resolve(ROOT, 'web-draft', 'server.mjs');
const MAX_BODY_BYTES = 1024 * 1024;

/** Læser eller opretter en tilfældig testpepper. Den bruges aldrig i produktion. */
export function loadTestPepper(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = resolve(dataDir, 'test-pepper.txt');
  if (!existsSync(file)) {
    writeFileSync(file, 'local-test-only-' + randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
  }
  const pepper = readFileSync(file, 'utf8').trim();
  if (!pepper.startsWith('local-test-only-')) throw new Error('Ugyldig testpepper i ' + file);
  return pepper;
}

export async function loadDraftWorker(file = DRAFT_SERVER) {
  if (!existsSync(file)) {
    throw new Error('web-draft/server.mjs mangler. Kør "npm run dev:server", som bygger den først.');
  }
  return (await import(pathToFileURL(file).href)).default;
}

function firstValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();
}

/** Læser RFC 7239 "Forwarded: host=...;proto=..." (første led). */
function parseForwarded(header) {
  const result = {};
  for (const part of firstValue(header).split(';')) {
    const [key, raw] = part.split('=');
    if (key && raw) result[key.trim().toLowerCase()] = raw.trim().replace(/^"|"$/g, '');
  }
  return result;
}

/**
 * Bestemmer den adresse, browseren faktisk bruger. Bag Claude-appens forhåndsvisning
 * (en proxy) kan Host være 127.0.0.1, mens browseren ser en https-adresse. Spillets
 * egen Origin-kontrol sammenligner Origin med denne adresse, så den skal være korrekt.
 */
export function requestUrl(req) {
  const forwarded = parseForwarded(req.headers.forwarded);
  let proto = firstValue(req.headers['x-forwarded-proto']) || forwarded.proto || 'http';
  const host = firstValue(req.headers['x-forwarded-host']) || forwarded.host || firstValue(req.headers.host) || '127.0.0.1';
  // Samme vært, men browseren bruger https (proxyen sendte ingen protokol-header).
  const origin = firstValue(req.headers.origin);
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === host && parsed.protocol === 'https:') proto = 'https';
    } catch {}
  }
  return new URL(req.url || '/', `${proto}://${host}`);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('For stor forespørgsel.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function toRequest(req) {
  const url = requestUrl(req);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method || 'GET');
  const body = hasBody ? await readBody(req) : undefined;
  return new Request(url, { method: req.method, headers, body: hasBody && body.length ? body : undefined });
}

async function writeResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') headers[name] = value;
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  headers['x-touchline-environment'] = 'local-test';
  res.writeHead(response.status, headers);
  if (response.body) {
    for await (const chunk of response.body) res.write(chunk);
  }
  res.end();
}

/**
 * Kort, ikke-følsom beskrivelse af en forespørgsel til fejlfinding af forhåndsvisningen.
 * Indeholder aldrig cookies, adgangskoder eller forespørgselsindhold.
 */
export function requestSummary(req, request, status) {
  const pick = (name) => firstValue(req.headers[name]) || '-';
  return [
    new Date().toISOString(),
    req.method,
    new URL(request.url).pathname,
    status,
    `url=${new URL(request.url).origin}`,
    `host=${pick('host')}`,
    `origin=${pick('origin')}`,
    `xfh=${pick('x-forwarded-host')}`,
    `xfp=${pick('x-forwarded-proto')}`,
    `fwd=${pick('forwarded')}`,
  ].join(' ');
}

/**
 * Starter testserveren.
 * @param {{dataDir?:string, port?:number, host?:string, database?:string, worker?:object, env?:object}} options
 */
export async function startLocalServer(options = {}) {
  assertSafeEnvironment(options.env ?? process.env);
  const host = options.host ?? '127.0.0.1';
  if (!LOCAL_HOSTS.includes(host) && !options.allowNonLocalHost) {
    throw new Error(`Testserveren lytter kun lokalt. Værten ${host} er ikke tilladt.`);
  }
  const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
  const guard = installNetworkGuard();
  const db = openLocalDatabase(options.database ?? resolve(dataDir, 'touchline-dev.sqlite'));
  const workerEnv = { DB: db, BUCKET: memoryBucket(), AUTH_PEPPER: loadTestPepper(dataDir) };
  const worker = options.worker ?? (await loadDraftWorker());

  const log = options.log ?? (() => {});
  const server = createServer(async (req, res) => {
    try {
      const request = await toRequest(req);
      const response = await worker.fetch(request, workerEnv, { waitUntil() {}, passThroughOnException() {} });
      log(requestSummary(req, request, response.status));
      await writeResponse(res, response);
    } catch (error) {
      const status = error?.status || 500;
      if (!res.headersSent) res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(status === 500 ? 'Intern fejl i testserveren.' : error.message);
      if (status === 500) console.error('[testmiljø]', error);
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 8787, host, resolveListen);
  });
  const address = server.address();
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`;

  return {
    server,
    url,
    port: address.port,
    db,
    env: workerEnv,
    worker,
    guard,
    async close() {
      await new Promise((done) => server.close(done));
      db.close();
      guard.restore();
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const port = Number(process.env.DEV_PORT || 8787);
    const logFile = resolve(DEFAULT_DATA_DIR, 'requests.log');
    mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
    const local = await startLocalServer({
      port,
      log: (line) => {
        if (/\/api\//.test(line) || / \/play /.test(line)) console.log(line);
        appendFileSync(logFile, line + '\n');
      },
    });
    const accounts = local.db.sqlite.prepare('SELECT count(*) AS n FROM accounts').get().n;
    console.log('');
    console.log('Touchline TESTMILJØ kører (lokal database, ingen forbindelse til produktion).');
    console.log(`  Spil:      ${local.url}/play`);
    console.log(`  Database:  ${local.db.file} (${accounts} testkonti)`);
    console.log('  Udgående netværk fra Worker-koden er blokeret.');
    console.log(`  Forespørgselslog (uden cookies/adgangskoder): ${logFile}`);
    console.log('  Stop med Ctrl+C.');
    const stop = async () => {
      if (local.guard.blocked.length) console.log(`Blokerede forsøg på udgående forbindelser: ${local.guard.blocked.length}`);
      await local.close();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
