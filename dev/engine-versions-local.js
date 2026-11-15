// KUN TIL DET LOKALE TESTMILJØ. Bruges aldrig i produktionsbygningen (build.mjs).
//
// dev/build-local-worker.mjs udskifter shared/engine-versions.js med denne fil, når
// testserverens Worker bygges. Her er de eksperimentelle motorer (motor 11) tilladt,
// så de kan spilles lokalt med fiktive testkonti. Reglerne for motor 1–10 er de samme
// som i produktionen (se tests/dev-engine11.test.mjs).
import * as production from '../shared/engine-versions.js';

export const LOCAL_TEST_ENGINE_VERSIONS = true;
export const SUPPORTED_MATCH_VERSIONS = Object.freeze([...production.SUPPORTED_MATCH_VERSIONS, ...production.EXPERIMENTAL_MATCH_VERSIONS]);
export const EXPERIMENTAL_MATCH_VERSIONS = Object.freeze([]);
export const LATEST_MATCH_VERSION = SUPPORTED_MATCH_VERSIONS[SUPPORTED_MATCH_VERSIONS.length - 1];
export const LEGACY_DEFAULT_MATCH_VERSION = production.LEGACY_DEFAULT_MATCH_VERSION;
export const ASSUMED_SERVER_MATCH_VERSION = production.ASSUMED_SERVER_MATCH_VERSION;

export function isSupportedMatchVersion(version) {
  return Number.isInteger(version) && SUPPORTED_MATCH_VERSIONS.includes(version);
}
export function resolveRequestedMatchVersion(requested) {
  if (!Number.isInteger(requested) || requested < 1) return null;
  if (requested > LATEST_MATCH_VERSION) return LATEST_MATCH_VERSION;
  if (requested === LEGACY_DEFAULT_MATCH_VERSION) return null;
  return isSupportedMatchVersion(requested) ? requested : null;
}
export function configMatchVersion(config) {
  const version = config?.matchVersion;
  return isSupportedMatchVersion(version) && version !== LEGACY_DEFAULT_MATCH_VERSION ? version : LEGACY_DEFAULT_MATCH_VERSION;
}
export function matchVersionInfo() {
  return { supported: [...SUPPORTED_MATCH_VERSIONS], latest: LATEST_MATCH_VERSION };
}
export const chooseRequestedMatchVersion = production.chooseRequestedMatchVersion;
