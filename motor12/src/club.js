import { createMatch, PHASE } from './engine.js';
import { HOME, LEAGUE, FORMATIONS, TACTICS, PRESS, makeSquad } from './teams.js';
const KEY='touchline:motor12:local:v1';
const number=new Intl.NumberFormat('da-DK');
export const money = value => number.format(Math.round(value))+' kr.';
export function newClub(){
  return {schema:1,name:HOME.name,budget:250000,played:0,points:0,formation:HOME.formation,
    roster:makeSquad(HOME,0),history:[],trained:false,sound:false,active:null};
}
function validPlayer(p){
  return p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.role==='string'
    &&[p.number,p.skill,p.energy,p.form].every(Number.isFinite);
}
function finiteBall(b){
  return b&&[b.x,b.y,b.z,b.vx,b.vy,b.vz,b.spin,b.age].every(Number.isFinite)
    && (b.owner===-1||([0,1].includes(b.owner>>4)&&b.owner%16<11));
}
function validMatch(m){
  return m?.version===12&&typeof m.id==='string'&&Number.isInteger(m.tick)&&m.tick>=0&&m.tick<=5400
    &&Number.isInteger(m.rng)&&[1,2].includes(m.half)&&Object.values(PHASE).includes(m.phase)&&finiteBall(m.ball)
    &&Array.isArray(m.events)&&m.teams?.length===2&&m.teams.every(t=>t.players?.length===11
      &&Object.hasOwn(FORMATIONS,t.formation)&&Object.hasOwn(TACTICS,t.mentality)&&Object.hasOwn(PRESS,t.press)
      &&t.players.every(p=>validPlayer(p)&&[p.x,p.y,p.vx,p.vy].every(Number.isFinite))
      &&Array.isArray(t.bench)&&t.bench.every(validPlayer)&&Array.isArray(t.used)&&t.used.every(validPlayer)&&Number.isFinite(t.stats?.goals))
    &&(m.phase!==PHASE.DEAD_BALL||(m.restart&&Number.isInteger(m.restart.slot)&&[0,1].includes(m.restart.side)));
}
export function loadClub(storage){
  try {
    const s=JSON.parse(storage.getItem(KEY));
    if(s?.schema!==1||!s.roster?.every(validPlayer)||s.roster.length!==16||!Object.hasOwn(FORMATIONS,s.formation)
      ||!Array.isArray(s.history)||!Number.isFinite(s.budget)||!Number.isInteger(s.played)||s.played<0
      ||!Number.isFinite(s.points)||typeof s.name!=='string')return newClub();
    if(s.active&&!validMatch(s.active))s.active=null;
    return s;
  } catch {return newClub();}
}
export function saveClub(club,storage){
  try{storage.setItem(KEY,JSON.stringify(club));return true;}catch{return false;}
}
export const nextOpponent=club=>LEAGUE[club.played%LEAGUE.length];
export function nextMatch(club){
  if(club.active)return club.active;
  const match=createMatch({home:{...HOME,name:club.name},away:nextOpponent(club),roster:club.roster,
    formation:club.formation,seed:18+club.played*997,id:'fixture-'+club.played});
  club.active=match;
  return match;
}
export function trainClub(club){
  if(club.active||club.trained||club.budget<8500)return false;
  club.budget-=8500;
  club.trained=true;
  club.roster=club.roster.map(p=>({...p,energy:Math.min(100,p.energy+10),form:Math.min(10,p.form+1)}));
  return true;
}
export function settleMatch(club,match){
  if(match.phase!==PHASE.FULL_TIME||club.active?.id!==match.id||club.played!==Number(match.id.slice(8)))return null;
  const home=match.teams[0], away=match.teams[1], goals=home.stats.goals, conceded=away.stats.goals;
  const points=goals>conceded?3:goals===conceded?1:0, revenue=13500+points*3500;
  const summary={id:match.id,opponent:away.name,goals,conceded,revenue,points,xg:home.stats.xg,
    profile:[...home.players,...home.used].sort((a,b)=>b.impact-a.impact)[0].name};
  const roster=new Map([...home.players,...home.used].map(p=>[p.id,p]));
  club.roster=club.roster.map(p=>{
    const played=roster.get(p.id);
    return {...p,energy:Math.min(100,played?played.energy+28:p.energy+15),
      form:Math.max(3,Math.min(10,p.form+(points===3?1:points===0?-1:0)))};
  });
  club.history.unshift(summary);
  club.played++;club.points+=points;club.budget+=revenue;club.trained=false;club.active=null;
  return summary;
}
