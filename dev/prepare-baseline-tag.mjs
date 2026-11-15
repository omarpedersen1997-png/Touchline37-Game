// Forbereder bevaringstagget "bevaring/apk37" – OPRETTER ELLER PUSHER IKKE NOGET.
//
// Scriptet kontrollerer, at main stadig peger på den bevarede baseline, og at
// motorfilerne på main er de frosne. Derefter udskriver det de præcise kommandoer.
// Tagget må først oprettes efter ejerens særskilte godkendelse.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { FROZEN_ENGINE_FILES as FROZEN_ENGINES } from '../tests/engine-freeze-data.mjs';

export const TAG = 'bevaring/apk37';
export const BASELINE_COMMIT = 'e9b04e67d014b544ebe0c383e6b03093277666a1';
export const TAG_MESSAGE =
  'Bevaringspunkt: baseline for APK 1.0.0 (versionCode 37), kampmotor 10. Originalfiler fra c71fbb7. Må ikke flyttes eller slettes.';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

export function checkBaseline() {
  const problems = [];
  const main = git('rev-parse', 'main');
  if (main !== BASELINE_COMMIT) problems.push(`main peger på ${main}, forventet ${BASELINE_COMMIT}.`);
  if (git('tag', '-l', TAG)) problems.push(`Tagget ${TAG} findes allerede lokalt.`);
  for (const engine of FROZEN_ENGINES) {
    const content = execFileSync('git', ['show', `${BASELINE_COMMIT}:${engine.file}`]);
    const hash = createHash('sha256').update(content).digest('hex');
    if (hash !== engine.sha256) problems.push(`${engine.file} på baseline matcher ikke den frosne SHA256.`);
  }
  return problems;
}

if (import.meta.url === new URL('file://' + process.argv[1]).href) {
  const problems = checkBaseline();
  if (problems.length) {
    console.error('Tagget kan ikke forberedes:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log(`Kontrol bestået: main = ${BASELINE_COMMIT.slice(0, 7)}, motor 1–10 matcher de frosne SHA256-værdier.`);
  console.log('Intet er oprettet. Efter ejerens godkendelse oprettes tagget med:\n');
  console.log(`  git tag -a ${TAG} ${BASELINE_COMMIT} -m "${TAG_MESSAGE}"`);
  console.log(`  git push origin refs/tags/${TAG}\n`);
  console.log('Bemærk: Denne Claude-session kan ikke pushe tags (GitHub svarede 403). Alternativt kan');
  console.log('ejeren oprette tagget på github.com: Releases → Draft a new release → tag ' + TAG + ' på main → Save draft.');
}
