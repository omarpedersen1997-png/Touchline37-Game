// Materialisér serverkilden i det NYE testprojekt. Originalens Sites-ID kopieres aldrig.
import { cp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = '/workspace/sites/touchline37-engine11-test';
const projectId = 'appgprj_6af9bc223af88191b6d68d7616afcc25';
if (await realpath(target) !== target) throw new Error('Testprojektet må ikke være et link til en anden mappe.');
const manifest = JSON.parse(await readFile(resolve(target, '.openai/hosting.json'), 'utf8'));
if (manifest.project_id !== projectId || manifest.d1 !== 'DB' || manifest.r2 !== null) throw new Error('Forkert testprojekt/bindings.');
const files = execFileSync('git', ['ls-files', '--', 'shared', 'worker', 'dev/android-test-worker.js', 'dev/engine-versions-local.js', 'dev/test-host', 'drizzle'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim().split('\n').filter(Boolean);
files.push('release/launch.json', 'release/owner-apk.json', 'release/downloads/current.json');
const inventory = [];
for (const file of files) {
  const source = resolve(root, file), destination = resolve(target, file);
  if (!source.startsWith(root + '/') || !destination.startsWith(target + '/')) throw new Error('Ugyldig kildesti.');
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  const bytes = await readFile(source);
  inventory.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await cp(resolve(root, 'dev/test-host/0005_test_environment.sql'), resolve(target, 'drizzle/0005_test_environment.sql'));
const original = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const originalLock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const esbuild = original.dependencies?.esbuild ?? original.devDependencies?.esbuild;
const pkg = { name: 'touchline37-engine11-test-server', private: true, type: 'module', scripts: { build: 'node dev/test-host/build.mjs' }, devDependencies: { esbuild } };
const lock = { name: pkg.name, lockfileVersion: 3, requires: true, packages: { '': { name: pkg.name, devDependencies: { esbuild } } } };
for (const [name, value] of Object.entries(originalLock.packages)) {
  if (name === 'node_modules/esbuild' || name.startsWith('node_modules/@esbuild/')) lock.packages[name] = value;
}
await writeFile(resolve(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
await writeFile(resolve(target, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
await writeFile(resolve(target, 'SOURCE-INVENTORY.json'), JSON.stringify({
  sourceRepository: 'omarpedersen1997-png/Touchline37-Game',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
  projectId, files: inventory,
}, null, 2) + '\n');
await writeFile(resolve(target, 'README.md'), '# Touchline 37 — særskilt motor 11-testserver\n\nDenne kilde tilhører kun testprojektet. Ingen forbindelse til den aktive hjemmeside.\nRuntimehemmeligheder er ikke med. Build: npm ci && npm run build.\nKomplet spil-/Androidkilde og tests ligger i det private Touchline37-Game-repository.\n');
console.log(`Testserverens kilde forberedt fra ${inventory.length} filer i separat projekt.`);
