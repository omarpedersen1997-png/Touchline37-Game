// Kontrollerer i en rigtig browser, at appens eksisterende 3D-kampvisning kører med
// kampmotor 11 i det lokale testmiljø (frisk midlertidig database, fiktiv testkonto).
//   node dev/check-engine11-view.mjs   → skærmbilleder i .dev-data/engine11/
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from './local-server.mjs';
import { seed, TEST_ACCOUNTS } from './seed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '.dev-data', 'engine11');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); }
}

export async function checkEngine11View() {
  const dataDir = mkdtempSync(join(tmpdir(), 'touchline-e11-view-'));
  const local = await startLocalServer({ env: {}, port: 0, dataDir });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const result = { errors: [], external: [] };
  try {
    await seed({ db: local.db, worker: local.worker, pepper: local.env.AUTH_PEPPER });
    const context = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => result.errors.push(error.message));
    page.on('request', (request) => { const url = new URL(request.url()); if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') result.external.push(request.url()); });
    await page.goto(local.url + '/dev/motor11');
    result.chooser = await page.textContent('main');
    await page.goto(local.url + '/play');
    const account = TEST_ACCOUNTS[2];
    await page.locator('input[type=email]').fill(account.email);
    await page.getByRole('button', { name: /fortsæt/i }).first().click();
    await page.locator('input[type=password]').first().fill(account.password);
    await page.getByRole('button', { name: /log ind/i }).last().click();
    await page.locator('nav:visible').first().waitFor({ timeout: 30000 });
    await page.locator('button:visible').filter({ hasText: /Spil selv i 3D/ }).first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.width > 300 && c.getBoundingClientRect().width > 300), null, { timeout: 60000 });
    // Spil lidt med tastaturet (pil op + sprint) for at se bevægelse.
    await page.waitForTimeout(2500);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowUp');
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, 'motor11-kamp.png') });
    const status = await page.evaluate(async () => (await fetch('/dev/status')).json());
    const game = await page.evaluate(async () => (await fetch('/api/game', { credentials: 'same-origin' })).json());
    result.engine = status.engine;
    result.matchVersion = game.state?.active?.manual?.version;
    result.blocked = local.guard.blocked.length;
    await context.close();
  } finally {
    await browser.close();
    await local.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  return result;
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  const result = await checkEngine11View();
  console.log(JSON.stringify({ ...result, chooser: result.chooser?.slice(0, 80) }, null, 2));
  if (result.errors.length || result.external.length || result.matchVersion !== 11) process.exit(1);
  console.log(`Skærmbillede: ${join(OUT, 'motor11-kamp.png')}`);
}
