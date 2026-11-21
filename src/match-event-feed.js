import {playingTime,PLAY_MS} from '../shared/football-halves.js';
// Only observed engine events/counter changes are announced. No invented cards,
// substitutions or chance statistics. Keep at most three messages on screen.
export function createMatchEventFeed(){
 let previous=null,sequence=0,items=[];
 return{observe(state){
  const stats=state.stats||{},current={home:state.homeScore,away:state.awayScore,homeShots:stats.homeShots||0,awayShots:stats.awayShots||0,homeSaves:stats.homeSaves||0,awaySaves:stats.awaySaves||0};
  if(previous&&state.tick<previous.tick)items=[];
  const minute=Math.min(90,Math.max(0,Math.floor(playingTime(state.tick*50)/PLAY_MS*90)));
  const add=(kind,team,text)=>items=[{id:++sequence,kind,team,text,minute},...items];
  if(previous&&state.tick>=previous.tick){
   if(current.home>previous.home)add('goal','home',`Mål! ${current.home}–${current.away}`);
   else if(current.away>previous.away)add('goal','away',`Modstanderen scorer · ${current.home}–${current.away}`);
   else if(current.homeSaves>previous.homeSaves)add('save','home','Din målmand redder');
   else if(current.awaySaves>previous.awaySaves)add('save','away','Modstanderens målmand redder');
   else if(current.homeShots>previous.homeShots)add('shot','home','Afslutning fra dit hold');
   else if(current.awayShots>previous.awayShots)add('shot','away','Modstanderen afslutter');
  }
  previous={...current,tick:state.tick};items=items.slice(0,3);return items;
 }};
}
