// Ydeevnemålinger for Touchline 37 i det isolerede testmiljø (M3, trin 4).
//
//   node dev/perf.mjs [--runs 3] [--cpu 4]
//
// Måler i Chromium med telefon-viewport i bredformat og simuleret langsom CPU:
//   - opstart: HTML-størrelse, DOMContentLoaded, load og tid til loginformularen,
//   - login: tid fra "Log ind" til klubskærmen,
//   - 3D-kamp: tid fra "Spil selv i 3D" til kampens canvas er tegnet, og billedrate,
//   - hukommelse (JS-heap) efter opstart, efter login og under 3D-kampen.
// Resultatet gemmes i .dev-data/perf/latest.json. Intet sendes ud af maskinen.
//
// Vigtigt: Headless Chromium tegner WebGL i software (SwiftShader). Tallene er til
// sammenligning før/efter en ændring – ikke et mål for en rigtig Android-telefon.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from './local-server.mjs';
import { seed, TEST_ACCOUNTS } from './seed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RESULT_FILE = resolve(ROOT, '.dev-data', 'perf', 'latest.json');
const VIEWPORT = { width: 915, height: 412 };

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    return require('/opt/node-tools/node_modules/playwright');
  }
}

function option(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  return index > 0 ? Number(process.argv[index + 1]) : fallback;
}

const median = (values) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function heapMb(cdp) {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const { metrics } = await cdp.send('Performance.getMetrics');
  const used = metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  return Math.round((used / 1048576) * 10) / 10;
}

async function framesPerSecond(page, ms = 3000) {
  return page.evaluate(
    (duration) =>
      new Promise((resolveFrames) => {
        let frames = 0;
        const start = performance.now();
        const tick = (now) => {
          frames++;
          if (now - start < duration) requestAnimationFrame(tick);
          else resolveFrames(Math.round((frames / ((now - start) / 1000)) * 10) / 10);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function measureOnce(browser, local, cpuRate) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'da-DK' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (cpuRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const external = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname !== '127.0.0.1') external.push(request.url());
  });
  const result = {};
  try {
    // Opstart
    const response = await page.goto(local.url + '/play', { waitUntil: 'load' });
    result.htmlBytes = (await response.body()).length;
    await page.locator('input[type=email]').waitFor({ timeout: 60000 });
    Object.assign(
      result,
      await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadMs: Math.round(nav.loadEventEnd),
          loginFormVisibleMs: Math.round(performance.now()),
        };
      }),
    );
    result.heapAfterStartupMb = await heapMb(cdp);

    // Login
    const account = TEST_ACCOUNTS[2];
    await page.locator('input[type=email]').fill(account.email);
    await page.getByRole('button', { name: /fortsæt/i }).first().click();
    await page.locator('input[type=password]').first().fill(account.password);
    const loginStart = Date.now();
    await page.getByRole('button', { name: /log ind/i }).last().click();
    await page.locator('nav:visible').first().waitFor({ timeout: 60000 });
    result.loginToClubMs = Date.now() - loginStart;
    await page.waitForTimeout(1000);
    result.heapAfterLoginMb = await heapMb(cdp);

    // 3D-kamp
    const matchStart = Date.now();
    await page.locator('button:visible').filter({ hasText: /Spil selv i 3D/ }).first().click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('canvas')].some((canvas) => canvas.width > 300 && canvas.getBoundingClientRect().width > 300 && (canvas.getContext('webgl2') || canvas.getContext('webgl'))),
      null,
      { timeout: 120000 },
    );
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    result.match3dReadyMs = Date.now() - matchStart;
    await page.waitForTimeout(1500);
    result.match3dFps = await framesPerSecond(page);
    result.heapDuring3dMb = await heapMb(cdp);
    result.externalRequests = external.length;
  } finally {
    await context.close();
  }
  return result;
}

export async function runPerf({ runs = 3, cpuRate = 4 } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'touchline-perf-'));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const samples = [];
  try {
    for (let run = 0; run < runs; run++) {
      // Frisk database pr. kørsel, så hver måling starter en ny kamp fra samme udgangspunkt.
      const local = await startLocalServer({ env: {}, port: 0, dataDir: join(dataDir, 'run-' + run) });
      try {
        await seed({ db: local.db, worker: local.worker, pepper: local.env.AUTH_PEPPER });
        samples.push(await measureOnce(browser, local, cpuRate));
        if (local.guard.blocked.length) throw new Error('Testserveren forsøgte udgående forbindelser.');
      } finally {
        await local.close();
      }
    }
  } finally {
    await browser.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  const keys = Object.keys(samples[0]);
  const summary = Object.fromEntries(keys.map((key) => [key, median(samples.map((sample) => sample[key]))]));
  return {
    measuredAt: new Date().toISOString(),
    runs,
    cpuThrottling: cpuRate,
    viewport: VIEWPORT,
    renderer: 'headless Chromium (software-WebGL)',
    summary,
    samples,
  };
}

const LABELS = {
  htmlBytes: ['App-HTML', (v) => (v / 1e6).toFixed(2) + ' MB'],
  domContentLoadedMs: ['DOMContentLoaded', (v) => v + ' ms'],
  loadMs: ['Load-hændelse', (v) => v + ' ms'],
  loginFormVisibleMs: ['Loginformular synlig', (v) => v + ' ms'],
  heapAfterStartupMb: ['JS-heap efter opstart', (v) => v + ' MB'],
  loginToClubMs: ['Login → klubskærm', (v) => v + ' ms'],
  heapAfterLoginMb: ['JS-heap efter login', (v) => v + ' MB'],
  match3dReadyMs: ['"Spil selv i 3D" → kamp tegnet', (v) => v + ' ms'],
  match3dFps: ['Billedrate i 3D-kamp', (v) => v + ' fps'],
  heapDuring3dMb: ['JS-heap under 3D-kamp', (v) => v + ' MB'],
  externalRequests: ['Eksterne forespørgsler', (v) => String(v)],
};

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  const runs = option('runs', 3);
  const cpuRate = option('cpu', 4);
  runPerf({ runs, cpuRate })
    .then((report) => {
      mkdirSync(dirname(RESULT_FILE), { recursive: true });
      writeFileSync(RESULT_FILE, JSON.stringify(report, null, 2) + '\n');
      console.log(`\nTouchline ydeevne – median af ${runs} kørsler, CPU ${cpuRate}× langsommere, ${report.renderer}\n`);
      for (const [key, [label, format]] of Object.entries(LABELS)) {
        const value = report.summary[key];
        console.log(`  ${label.padEnd(34)} ${value === null || value === undefined ? '–' : format(value)}`);
      }
      console.log(`\nGemt i ${RESULT_FILE}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
