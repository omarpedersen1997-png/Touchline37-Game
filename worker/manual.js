import {GameError} from './management.js';
import {getArcadeRules,decodeInputs,replayArcade} from '../shared/arcade.js';
import {isSupportedMatchVersion,configMatchVersion} from '../shared/engine-versions.js';
export const MANUAL_GRACE_MS=180000;
export const MANUAL_RECOVERY_MS=86400000;
export function extendManualRecovery(active){
 const m=active?.manual;
 if(m&&m.version>=6&&!m.recoveryWindow&&m.expiresAt===active.ends+MANUAL_GRACE_MS){m.expiresAt=active.ends+MANUAL_RECOVERY_MS;m.recoveryWindow=1;}
}
export function createManualChallenge(config,now){
 const version=configMatchVersion(config),rules=getArcadeRules(version);
 return {version,seed:crypto.randomUUID(),duration:rules.DURATION_MS,inputCount:rules.INPUT_COUNT,expiresAt:now+rules.DURATION_MS+(version>=6?MANUAL_RECOVERY_MS:MANUAL_GRACE_MS),recoveryWindow:1,config:structuredClone(config)};
}
export function playManualReplay(active,action,now){
 if(!active?.manual||active.id!==action.matchId)throw new GameError('Den spillede kamp er ikke længere aktiv.');
 extendManualRecovery(active);
 // En gemt kamp genafspilles altid med sin oprindelige motor; den omskrives aldrig.
 if(!isSupportedMatchVersion(active.manual.version)||active.manual.version!==configMatchVersion(active.manual.config))throw new GameError('Kampversionen understøttes ikke.');
 if(now<active.ends)throw new GameError('Kampen er ikke færdigspillet endnu.');
 if(now>active.manual.expiresAt)throw new GameError('Fristen for at gemme kampen er udløbet.');
 let inputs;try{inputs=decodeInputs(action.inputs,active.manual.version)}catch{throw new GameError('Kampforløbet indeholder ugyldig styring.');}
 return replayArcade(active.manual.seed,active.manual.config,inputs);
}
export function manualForfeit(active){
 active.gate=null;active.forfeited=true;active.home=0;active.away=3;active.reward=0;active.replayVerified=true;
 active.events=[30,60,90].map(minute=>({minute,kind:'goal',side:'away',text:'Kampen blev ikke gemt inden fristen og registreres som et 0–3-nederlag.'}));
 if(active.competition==='cup')active.cupWon=false;
 if(active.competition==='europe')active.europeWon=false;
 delete active.penalties;
}
export function prepareClubManual(active,config,now){
 active.manual=createManualChallenge(config,now);active.control='manual';active.ends=now+active.manual.duration;
 active.home=0;active.away=0;active.events=[];active.reward=0;
 delete active.cupWon;delete active.europeWon;delete active.penalties;
 return active;
}
