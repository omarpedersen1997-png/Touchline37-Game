// Visuel baseline for Touchline 37.
//
//   node dev/visual.mjs capture   – tager referencebilleder til tests/visual/baseline/
//   node dev/visual.mjs check     – tager nye billeder og sammenligner med referencen
//
// Billederne tages i det isolerede testmiljø (dev/local-server.mjs) med en frisk,
// midlertidig database og fiktive testkonti. Animationer slås fra i browseren under
// optagelsen; selve appens kode og CSS ændres ikke.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from './local-server.mjs';
import { seed, TEST_ACCOUNTS } from './seed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_DIR = resolve(ROOT, 'tests', 'visual', 'baseline');
export const ACTUAL_DIR = resolve(ROOT, '.dev-data', 'visual', 'actual');
export const DIFF_DIR = resolve(ROOT, '.dev-data', 'visual', 'diff');

// Telefon i bredformat (CSS-pixels som en typisk Android-telefon på siden).
export const VIEWPORT = Object.freeze({ width: 915, height: 412 });
export const DEVICE_SCALE_FACTOR = 2;
// Indhold, der ændrer sig med tiden, skjules med fast bredde i testbrowseren, så
// layoutet står stille: klubsaldoen tæller op med serverens ur, og gemmestatus skifter
// mellem "Forbinder…" og "Gemt i skyen". Selve appen ændres ikke.
export const DYNAMIC_CSS = `button.balance b{display:inline-block!important;width:4.2em!important;visibility:hidden!important}.save-status{visibility:hidden!important}`;
export const MASK_SELECTORS = Object.freeze([]);
// Resten af billedet skal være næsten pixel-identisk.
export const CHANNEL_TOLERANCE = 24;
export const MAX_DIFF_RATIO = 0.0002;

const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

// Skærme: navn, konto (null = ikke logget ind) og hvordan man når dem.
export const SCREENS = Object.freeze([
  { name: '01-login', account: null },
  { name: '02-klub', account: 2, nav: 'Klub' },
  { name: '03-hold', account: 2, nav: 'Hold' },
  { name: '04-kampe', account: 2, nav: 'Kampe' },
  { name: '05-center', account: 2, nav: 'Center' },
  { name: '06-mere', account: 2, nav: 'Mere' },
  { name: '07-ny-klub', account: 0, nav: 'Klub' },
]);

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    return require('/opt/node-tools/node_modules/playwright');
  }
}

function playwrightVersion() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright/package.json', '/opt/node-tools/node_modules/playwright/package.json']) {
    try {
      return require(id).version;
    } catch {}
  }
  return 'ukendt';
}

async function settle(page) {
  await page.addStyleTag({ content: FREEZE_CSS + DYNAMIC_CSS });
  // Kun til selvtest af sammenligningen: simuler en designændring uden at røre appen.
  if (process.env.VISUAL_SELFTEST_CSS) await page.addStyleTag({ content: process.env.VISUAL_SELFTEST_CSS });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(1200);
}

async function login(page, account) {
  await page.locator('input[type=email]').fill(account.email);
  const next = page.getByRole('button', { name: /fortsæt|næste|videre/i }).first();
  if (await next.count()) await next.click();
  await page.locator('input[type=password]').first().fill(account.password);
  await page.getByRole('button', { name: /log ind/i }).last().click();
  await page.locator('nav:visible').first().waitFor({ timeout: 15000 });
}

async function openScreen(page, nav) {
  if (!nav) return;
  // Navigationsknapperne har aria-labels (fx "Mit hold"), så der vælges på den synlige tekst.
  await page.locator('nav:visible button').filter({ hasText: new RegExp('^\\s*' + nav + '\\s*$') }).first().click();
}

/** Tager alle skærmbilleder og returnerer {navn: PNG-buffer}. */
export async function captureScreens() {
  const dataDir = mkdtempSync(join(tmpdir(), 'touchline-visual-'));
  const local = await startLocalServer({ env: {}, port: 0, dataDir });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const shots = {};
  try {
    await seed({ db: local.db, worker: local.worker, pepper: local.env.AUTH_PEPPER });
    for (const screen of SCREENS) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
        locale: 'da-DK',
        timezoneId: 'Europe/Copenhagen',
      });
      const page = await context.newPage();
      const external = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname !== '127.0.0.1') external.push(request.url());
      });
      await page.goto(local.url + '/play');
      await page.locator('input[type=email]').waitFor({ timeout: 15000 });
      if (screen.account !== null) {
        await login(page, TEST_ACCOUNTS[screen.account]);
        await openScreen(page, screen.nav);
      }
      await settle(page);
      shots[screen.name] = await page.screenshot({
        animations: 'disabled',
        caret: 'hide',
        mask: MASK_SELECTORS.map((selector) => page.locator(selector)),
        maskColor: '#ff00ff',
      });
      if (external.length) throw new Error(`Skærmen ${screen.name} forsøgte eksterne forespørgsler: ${external.join(', ')}`);
      await context.close();
    }
  } finally {
    await browser.close();
    await local.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  return shots;
}

/** Sammenligner to PNG'er i browseren (ingen ekstra afhængigheder). */
export async function compareImages(baseline, actual) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ({ a, b, tolerance }) => {
        const load = (data) =>
          new Promise((done, fail) => {
            const image = new Image();
            image.onload = () => done(image);
            image.onerror = fail;
            image.src = 'data:image/png;base64,' + data;
          });
        const [left, right] = await Promise.all([load(a), load(b)]);
        if (left.width !== right.width || left.height !== right.height) {
          return { sameSize: false, ratio: 1, differing: -1, width: right.width, height: right.height };
        }
        const canvas = (image) => {
          const c = document.createElement('canvas');
          c.width = image.width;
          c.height = image.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, c.width, c.height);
        };
        const pa = canvas(left).data;
        const pb = canvas(right);
        const out = new ImageData(pb.width, pb.height);
        let differing = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const delta = Math.max(Math.abs(pa[i] - pb.data[i]), Math.abs(pa[i + 1] - pb.data[i + 1]), Math.abs(pa[i + 2] - pb.data[i + 2]));
          if (delta > tolerance) {
            differing++;
            out.data.set([255, 0, 160, 255], i);
          } else {
            const grey = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 9;
            out.data.set([grey, grey, grey, 255], i);
          }
        }
        const c = document.createElement('canvas');
        c.width = pb.width;
        c.height = pb.height;
        c.getContext('2d').putImageData(out, 0, 0);
        return {
          sameSize: true,
          differing,
          ratio: differing / (pb.width * pb.height),
          diff: c.toDataURL('image/png').split(',')[1],
        };
      },
      { a: baseline.toString('base64'), b: actual.toString('base64'), tolerance: CHANNEL_TOLERANCE },
    );
  } finally {
    await browser.close();
  }
}

async function main(mode) {
  if (!['capture', 'check'].includes(mode)) {
    console.error('Brug: node dev/visual.mjs capture|check');
    process.exit(2);
  }
  const shots = await captureScreens();
  if (mode === 'capture') {
    mkdirSync(BASELINE_DIR, { recursive: true });
    const manifest = {
      note: 'Referencebilleder af Touchline-appen i testmiljøet. Opdateres kun med "npm run visual:baseline" efter godkendt designændring.',
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      playwright: loadPlaywright().chromium.name() + ' via playwright ' + playwrightVersion(),
      screens: {},
    };
    for (const [name, png] of Object.entries(shots)) {
      writeFileSync(join(BASELINE_DIR, name + '.png'), png);
      manifest.screens[name] = { bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') };
    }
    writeFileSync(join(BASELINE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Referencebilleder gemt: ${Object.keys(shots).length} i tests/visual/baseline/`);
    return;
  }
  rmSync(DIFF_DIR, { recursive: true, force: true });
  mkdirSync(ACTUAL_DIR, { recursive: true });
  mkdirSync(DIFF_DIR, { recursive: true });
  let failed = 0;
  for (const [name, png] of Object.entries(shots)) {
    writeFileSync(join(ACTUAL_DIR, name + '.png'), png);
    const file = join(BASELINE_DIR, name + '.png');
    if (!existsSync(file)) {
      console.log(`MANGLER  ${name}: intet referencebillede`);
      failed++;
      continue;
    }
    const result = await compareImages(readFileSync(file), png);
    const percent = (result.ratio * 100).toFixed(3) + ' %';
    if (!result.sameSize || result.ratio > MAX_DIFF_RATIO) {
      failed++;
      if (result.diff) writeFileSync(join(DIFF_DIR, name + '.png'), Buffer.from(result.diff, 'base64'));
      console.log(`AFVIGER  ${name}: ${result.sameSize ? percent + ' af pixels' : 'anden billedstørrelse'} (se .dev-data/visual/diff/)`);
    } else {
      console.log(`OK       ${name}: ${percent} af pixels afviger (grænse ${(MAX_DIFF_RATIO * 100).toFixed(2)} %)`);
    }
  }
  if (failed) {
    console.log(`\n${failed} skærm(e) afviger fra referencen. Gennemgå billederne, før ændringen godkendes.`);
    process.exit(1);
  }
  console.log('\nDesignet matcher referencebillederne.');
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  main(process.argv[2]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
