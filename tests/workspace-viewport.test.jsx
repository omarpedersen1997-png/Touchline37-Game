import SquadAnalysis from '../src/SquadAnalysis.jsx';
import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import SquadPitch from '../src/SquadPitch.jsx';
import {LeagueStandings,LeagueRoundResults} from '../src/LeagueStandings.jsx';
import {LeagueTabs,leagueTabKeyIndex} from '../src/EuropeCompetition.jsx';
import {createGame,publicState} from '../worker/game.js';
import {squadDisplayCoordinates} from '../src/squad-layout.js';
import {pitchCoordinates} from '../worker/management.js';

const walk=node=>React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(walk)]:[];
const game=()=>publicState(createGame(0),0);

test('all eleven player actions and formation coordinates survive the separate pitch/details layout',()=>{
 for(const formation of ['4-3-3','4-4-2','3-5-2','4-5-1']){
  const state=game(),calls=[];state.formation=formation;
  const tree=SquadPitch({state,onPlayer:p=>calls.push(p.id),onRecruit:()=>calls.push('recruit'),onManage:()=>calls.push('manage')});
  const nodes=walk(tree),players=nodes.find(n=>n.props.className==='game-squad-players');
  const buttons=walk(players).filter(n=>n.type==='button');
  assert.equal(buttons.length,11);
  for(const [i,button] of buttons.entries()){
   assert.equal(button.props.style.left,squadDisplayCoordinates(pitchCoordinates(formation))[i][0]+'%');
   assert.equal(button.props.style.top,squadDisplayCoordinates(pitchCoordinates(formation))[i][1]+'%');
   assert(button.props['aria-label'].includes(state.players[i].name));
   button.props.onClick();
  }
  const details=nodes.find(n=>n.props.className==='game-squad-details');
  for(const button of walk(details).filter(n=>n.type==='button'))button.props.onClick();
  assert.deepEqual(calls,[...state.players.map(p=>p.id),'recruit','manage']);
  assert(!walk(details).includes(players));
 }
});

test('standings preserve all clubs, rank, signed goal difference, points and the current-team marker',()=>{
 const state=game(),teams=[
  {name:'Nordby',played:5,goalsFor:9,goalsAgainst:3,points:12},
  {name:state.name,self:true,played:5,goalsFor:4,goalsAgainst:6,points:6},
  {name:'Havneby',played:4,goalsFor:2,goalsAgainst:2,points:4},
 ];
 const html=renderToStaticMarkup(<LeagueStandings state={state} teams={teams}/>);
 assert.equal((html.match(/<tbody><tr|<\/tr><tr/g)||[]).length,3);
 for(const text of ['Nordby','Havneby',state.name,'+6','-2','DIG','Rul i ligatabellen','frirunde'])assert(html.includes(text),text);
 assert.equal((html.match(/scope="col"/g)||[]).length,5);
 assert.equal((html.match(/your-team/g)||[]).length,1);
 assert(!html.includes('Seneste runde'));
});

test('moving round results out of the table preserves every fixture and the schedule explanation',()=>{
 const fixtures=[{homeTeam:'Nordby',awayTeam:'Havneby',home:2,away:1,self:true},{homeTeam:'Søby',awayTeam:'Fjordby',home:0,away:0}];
 const html=renderToStaticMarkup(<LeagueRoundResults fixtures={fixtures}/>);
 for(const text of ['Nordby','Havneby','Søby','Fjordby','2–1','0–0','10 kampe','frirunde'])assert(html.includes(text),text);
 assert.equal((html.match(/class="fixture-row/g)||[]).length,2);
 const empty=renderToStaticMarkup(<LeagueRoundResults/>);
 assert(empty.includes('Spil den første ligakamp'));
 assert(!empty.includes('class="fixture-row'));
});

test('vertical competition tabs use vertical keyboard navigation and retain horizontal defaults',()=>{
 assert.equal(leagueTabKeyIndex({key:'ArrowDown'},2,'vertical'),0);
 assert.equal(leagueTabKeyIndex({key:'ArrowUp'},0,'vertical'),2);
 assert.equal(leagueTabKeyIndex({key:'ArrowRight'},0,'vertical'),null);
 assert.equal(leagueTabKeyIndex({key:'Home'},2,'vertical'),0);
 assert.equal(leagueTabKeyIndex({key:'End'},0,'vertical'),2);
 assert.equal(leagueTabKeyIndex({key:'ArrowRight'},2),0);
 assert.equal(leagueTabKeyIndex({key:'ArrowLeft'},0),2);
 for(const modifier of ['defaultPrevented','altKey','ctrlKey','metaKey','shiftKey'])assert.equal(leagueTabKeyIndex({key:'ArrowDown',[modifier]:true},0,'vertical'),null);
 const html=renderToStaticMarkup(<LeagueTabs selected="cup" orientation="vertical" onChange={()=>{}} europeReady/>);
 assert(html.includes('aria-orientation="vertical"'));
 assert.equal((html.match(/role="tab"/g)||[]).length,3);
 assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
 assert(html.includes('Europaplads klar'));
 for(const id of ['league','cup','europe'])assert(html.includes(`aria-controls="club-competition-${id}-panel"`));
});

test('display spacing separates four lines evenly without mutating simulation coordinates',()=>{
 const original=pitchCoordinates('4-3-3'),snapshot=structuredClone(original),display=squadDisplayCoordinates(original);
 assert.deepEqual(original,snapshot);assert(display.every(([x])=>x>=8&&x<=92));
 assert.deepEqual([...new Set(display.map(([,y])=>y))].sort((a,b)=>a-b),[8,36,64,92]);
 assert.deepEqual(squadDisplayCoordinates([]),[]);assert.deepEqual(squadDisplayCoordinates([[25,45],[75,45]]),[[28,50],[72,50]]);
});

test('tactics analysis renders the actual public game state without requiring raw server fields',()=>{
 const state=game();const html=renderToStaticMarkup(<SquadAnalysis state={state}/>);
 assert(html.includes(String(state.strength)));assert(html.includes('Balanceret'));assert(!/NaN|undefined/.test(html));
});
