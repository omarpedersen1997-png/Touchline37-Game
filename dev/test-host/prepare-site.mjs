// Materialisér serverkilden i det NYE testprojekt. Originalens Sites-ID kopieres aldrig.
import { cp, mkdir, readFile, writeFile, realpath, unlink } from 'node:fs/promises';
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
}).trim().split('\n').filter(file => file && !file.startsWith('drizzle/'));
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
// Den NYE database har ingen anvendte migrationer. Pak et schema-only
// Drizzle-startskema med journal og statement-breakpoints. Den historiske
// recovery-backfill ændrer ingen tomme tabeller og hører ikke til et startskema.
// Originalens SQL-filer bevares altid uændret i Game-repositoryet.
const schemaInputs = ['drizzle/0000_clubs.sql', 'drizzle/0001_email_auth.sql', 'drizzle/0002_support_messages.sql', 'drizzle/0003_account_mail.sql', 'dev/test-host/0005_test_environment.sql'];
const statements = [];
for (const file of schemaInputs) {
  const sql = await readFile(resolve(root, file), 'utf8');
  for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
    const checked = statement.replace(/^\s*--[^\n]*(?:\n|$)/gm, '').trim();
    if (!/^(CREATE|ALTER)\b/i.test(checked)) throw new Error('Teststartskema må kun indeholde DDL.');
    statements.push(statement + ';');
  }
}
const schemaDirectory = resolve(target, 'drizzle');
await mkdir(resolve(schemaDirectory, 'meta'), { recursive: true });
for (const file of ['0000_clubs.sql', '0001_email_auth.sql', '0002_support_messages.sql', '0003_account_mail.sql', '0004_remove_recovery_codes.sql', '0005_test_environment.sql']) {
  try { await unlink(resolve(schemaDirectory, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(resolve(schemaDirectory, '0000_engine11_test.sql'), statements.join('\n--> statement-breakpoint\n') + '\n');
await writeFile(resolve(schemaDirectory, 'meta/_journal.json'), JSON.stringify({
  version: '7', dialect: 'sqlite', entries: [{ idx: 0, version: '6', when: 1794740000000, tag: '0000_engine11_test', breakpoints: true }],
}, null, 2) + '\n');
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
