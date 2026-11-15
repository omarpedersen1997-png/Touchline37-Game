// Appens valg af kampmotor til nye kampe, ud fra serverens versionsoversigt.
// En igangværende eller gemt kamp spilles altid med den version, serveren har
// tildelt den (match.manual.version) – det styres ikke herfra.
import { chooseRequestedMatchVersion, LATEST_MATCH_VERSION } from '../shared/engine-versions.js';

let serverInfo = null;

/** Gemmer serverens versionsoversigt fra et /api/game-svar. Ældre servere sender ingen. */
export function rememberServerMatchVersions(data) {
  const info = data?.matchVersions;
  if (info && Number.isInteger(info.latest) && Array.isArray(info.supported)) serverInfo = { latest: info.latest, supported: [...info.supported] };
}

/** Den motorversion, appen beder om til en ny kamp. Uden oversigt antages motor 10. */
export function requestedMatchVersion(clientLatest = LATEST_MATCH_VERSION) {
  return chooseRequestedMatchVersion(serverInfo, clientLatest);
}

/** Kun til tests. */
export function resetServerMatchVersions() {
  serverInfo = null;
}
