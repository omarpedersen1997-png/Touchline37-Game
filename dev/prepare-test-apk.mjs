// En genereret asset-overlay KUN for touchlineTest. Baseline/native-web røres ikke.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'native-web/index.html');
const bytes = await readFile(source);
const origin = 'https://touchline37-engine11-test.glowingconch1.chatgpt.site';
// Læs de eksisterende baselineadresser frem for at duplikere dem i testværktøjer.
const gradle = await readFile(resolve(root, 'android/app/build.gradle'), 'utf8');
const defaults = gradle.slice(gradle.indexOf('defaultConfig {'), gradle.indexOf('buildFeatures {'));
const baselineApi = defaults.match(/https:\/\/[^"\\\s]+/)?.[0];
const share = await readFile(resolve(root, 'src/ClubJourney.jsx'), 'utf8');
const baselineShare = share.match(/url:\s*'([^']+)'/)?.[1];
if (!baselineApi || !baselineShare || !baselineShare.startsWith('https://')) throw new Error('Baselineadresserne kunne ikke findes sikkert.');
let html = bytes.toString('utf8');
for (const original of [baselineShare, baselineApi]) html = html.replaceAll(original, origin);
if ([baselineShare, baselineApi].some(value => html.includes(value))) throw new Error('Produktionslink blev ikke isoleret.');
const destination = resolve(root, '.dev-data/android-web/public/index.html');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html);
if (!bytes.equals(await readFile(source))) throw new Error('Baselinewebindhold ændrede sig under testforberedelsen.');
console.log(JSON.stringify({ testAssets: destination, baselineSha256: createHash('sha256').update(bytes).digest('hex'), testSha256: createHash('sha256').update(html).digest('hex') }));
