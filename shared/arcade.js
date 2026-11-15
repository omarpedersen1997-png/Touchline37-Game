import * as legacy from './arcade-v1.js';
import * as football from './football11.js';
import * as modern from './football-modern.js';
import * as spaced from './football-spaced.js';
import * as pro from './football-pro.js';
import * as halves from './football-halves.js';
import * as contact from './football-contact.js';
import * as tactical from './football-tactics.js';
import * as receiving from './football-receiving.js';
import * as goals from './football-goals.js';
// Motor 11 er registreret, men endnu ikke givet til nye kampe (se shared/engine-versions.js).
import * as engine11 from './football-engine11.js';
export const ARCADE_VERSION=10;
export {STEP_MS,INPUT_MS,DURATION_MS,INPUT_COUNT,DIRECTIONS} from './arcade-v1.js';
export const FIELD=football.FIELD;
export function getArcadeRules(version=1){return version===11?engine11:version===10?goals:version===9?receiving:version===8?tactical:version===7?contact:version===6?halves:version===5?pro:version===4?spaced:version===3?modern:version===2?football:legacy;}
export function validateMask(mask,version=1){return getArcadeRules(version).validateMask(mask);}
export function encodeInputs(inputs,version=1){return getArcadeRules(version).encodeInputs(inputs);}
export function decodeInputs(value,version=1){return getArcadeRules(version).decodeInputs(value);}
export function createArcade(seed,config={}){return getArcadeRules(config.matchVersion).createArcade(seed,config);}
export function stepArcade(state,mask){return getArcadeRules(state.version).stepArcade(state,mask);}
export function replayArcade(seed,config,inputs){return getArcadeRules(config?.matchVersion).replayArcade(seed,config,inputs);}
