import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGame} from '../../worker/game.js';
import {teamStrengthDetails} from '../../shared/team-strength.js';
import {formations} from '../../worker/management.js';
import {integrateLivingBall} from '../../shared/football-motion-r3.js';
const path=new URL('../TouchlineUnity/Assets/Touchline/Resources/Touchline/Seeds/',import.meta.url);await mkdir(path,{recursive:true});
const game=createGame(Date.parse('2026-11-22T00:00:00Z'));
const club={Name:'Prøvelund BK',Formation:'4-3-3',Tactic:'balanced',Training:1,Coach:0,ClubBonus:0,Money:1500,Players:game.players.map(p=>({Id:p.id,Name:p.name,Position:p.position,Rating:p.rating,Potential:p.potential??99,Development:p.development??0,Number:p.number,Form:70,Energy:100})),SettledMatches:[]};
await writeFile(new URL('sandbox-club.json',path),JSON.stringify(club,null,2)+'\n');
const strengths=[];for(const formation of Object.keys(formations))for(const level of[1,4,10]){
 const players=structuredClone(game.players);if(level===4)[players[0],players[9]]=[players[9],players[0]];
 strengths.push({formation,training:level,players,expected:teamStrengthDetails({players,roles:formations[formation].roles,trainingLevel:level,coach:2,clubBonus:3})});
}
const balls=[];for(const flightKind of['pass','through','loft','shot','loose'])for(const air of[false,true]){
 const input={x:3,y:-5,z:air?2:.22,vx:24,vy:5,vz:air?-3:0,curl:4,flightKind};const expected=integrateLivingBall(structuredClone(input),.05);balls.push({input,seconds:.05,expected});
}
const frozen={};for(const p of['shared/football-engine11-r2.js','shared/football-engine11-r3.js','shared/team-strength.js','shared/football-motion-r3.js'])frozen[p]=createHash('sha256').update(await readFile(new URL('../../'+p,import.meta.url))).digest('hex');
await writeFile(new URL('../golden-domain.json',path),JSON.stringify({provenance:'Read-only export of existing JS domain rules. NEW Unity sandbox is not a Motor 11 replay implementation.',strengths,balls,frozen},null,2)+'\n');
console.log('Fiktiv klub, 12 styrkefixtures og 10 boldfixtures eksporteret. Ingen produktionsdata.');
