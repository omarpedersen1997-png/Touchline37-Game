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
import * as engine11r2 from './football-engine11-r2.js';
export const ARCADE_VERSION=10;
export {STEP_MS,INPUT_MS,DURATION_MS,INPUT_COUNT,DIRECTIONS} from './arcade-v1.js';
export const FIELD=football.FIELD;
export function getArcadeRules(version=1,revision=1){
 if(version===11){if(revision!==1&&revision!==2)throw Error('Kampmotorrevisionen understøttes ikke.');return revision===2?engine11r2:engine11;}
 return version===10?goals:version===9?receiving:version===8?tactical:version===7?contact:version===6?halves:version===5?pro:version===4?spaced:version===3?modern:version===2?football:legacy;
}
export function validateMask(mask,version=1){return getArcadeRules(version).validateMask(mask);}
export function encodeInputs(inputs,version=1){return getArcadeRules(version).encodeInputs(inputs);}
export function decodeInputs(value,version=1){return getArcadeRules(version).decodeInputs(value);}
export function createArcade(seed,config={}){return getArcadeRules(config.matchVersion,config.engineRevision).createArcade(seed,config);}
export function stepArcade(state,mask){return getArcadeRules(state.version,state.engineRevision).stepArcade(state,mask);}
export function replayArcade(seed,config,inputs){return getArcadeRules(config?.matchVersion,config?.engineRevision).replayArcade(seed,config,inputs);}
