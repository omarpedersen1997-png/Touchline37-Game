// Samlet versionsstyring for kampmotorerne.
//
// Motor 1–10 ligger i deres egne, frosne filer (se tests/engine-freeze.test.mjs) og
// vælges af shared/arcade.js. Denne fil bestemmer kun, HVILKEN version en ny kamp
// får, og hvilke versioner en gemt kamp må genafspilles med. En gemt kamp beholder
// altid sin oprindelige version – den omskrives aldrig til en anden motor.
//
// Når en ny motor (11+) tilføjes: opret en ny motorfil, registrér den i
// shared/arcade.js, og tilføj versionen her. Rør aldrig de frosne motorfiler.

/** Alle motorversioner, som kan spilles og genafspilles. */
export const SUPPORTED_MATCH_VERSIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** Den nyeste motor, som nye kampe kan få. */
export const LATEST_MATCH_VERSION = SUPPORTED_MATCH_VERSIONS[SUPPORTED_MATCH_VERSIONS.length - 1];

/** Motoren for anmodninger uden (gyldigt) versionsnummer – uændret fra de første appversioner. */
export const LEGACY_DEFAULT_MATCH_VERSION = 1;

/** Den version, en app antager, hvis serveren ikke oplyser sine versioner (ældre server). */
export const ASSUMED_SERVER_MATCH_VERSION = 10;

export function isSupportedMatchVersion(version) {
  return Number.isInteger(version) && SUPPORTED_MATCH_VERSIONS.includes(version);
}

/**
 * Motorversion for en NY kamp ud fra appens anmodning (action.manualVersion).
 * - Manglende eller ugyldig værdi (ikke et heltal ≥ 1): null = gammel standardadfærd
 *   (ingen matchVersion i konfigurationen → motor 1), præcis som i baseline.
 * - Understøttet version 2–10: den version.
 * - Version 1: null, fordi baseline altid har lagt motor 1 uden matchVersion i konfigurationen.
 * - Nyere version end serveren kender (fx 11): falder tilbage til LATEST_MATCH_VERSION.
 * @returns {number|null} versionen, der skal lægges i kampkonfigurationen, eller null.
 */
export function resolveRequestedMatchVersion(requested) {
  if (!Number.isInteger(requested) || requested < 1) return null;
  if (requested > LATEST_MATCH_VERSION) return LATEST_MATCH_VERSION;
  if (requested === LEGACY_DEFAULT_MATCH_VERSION) return null;
  return isSupportedMatchVersion(requested) ? requested : null;
}

/**
 * Den motor, en gemt kampkonfiguration bruger. Svarer til baseline:
 * config.matchVersion 2–10 → den version, ellers motor 1.
 */
export function configMatchVersion(config) {
  const version = config?.matchVersion;
  return isSupportedMatchVersion(version) && version !== LEGACY_DEFAULT_MATCH_VERSION ? version : LEGACY_DEFAULT_MATCH_VERSION;
}

/** Versionsoversigten, som serveren sender til appen i /api/game-svaret. */
export function matchVersionInfo() {
  return { supported: [...SUPPORTED_MATCH_VERSIONS], latest: LATEST_MATCH_VERSION };
}

/**
 * Den version, appen skal bede om til en ny kamp: den nyeste, som både appen og
 * serveren kender. Oplyser serveren intet (ældre server), antages motor 10.
 */
export function chooseRequestedMatchVersion(serverInfo, clientLatest = LATEST_MATCH_VERSION) {
  const serverLatest = Number.isInteger(serverInfo?.latest) && serverInfo.latest >= 1 ? serverInfo.latest : ASSUMED_SERVER_MATCH_VERSION;
  const candidates = Array.isArray(serverInfo?.supported)
    ? serverInfo.supported.filter((version) => Number.isInteger(version) && version <= clientLatest && version <= serverLatest)
    : [];
  if (candidates.length) return Math.max(...candidates);
  return Math.min(clientLatest, serverLatest);
}
