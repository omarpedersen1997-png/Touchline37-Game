import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup as render} from 'react-dom/server';
import PlayerCareer from '../src/PlayerCareer.jsx';
import {CareerContractTerms} from '../src/CareerJourney.jsx';
import {playerCareerAction as act,playerCareerView as view,settlePlayerCareer as settle} from '../worker/player-career.js';
const make=()=>{const s={};act(s,{id:'new',type:'player-career-create',name:'Omar Nord',position:'ANG',journeyVersion:1},0);return s;};
const screen=(s,now)=>render(<PlayerCareer career={view(s,now)} now={now} onAction={()=>{}}/>);
test('the real modern career exposes plans, personal objectives, fitness and earned contract roles',()=>{
 const html=screen(make(),0);
 for(const text of ['Trænerens tillid','100 energi','Hvilket aftryk','Spil for holdet','Tag initiativet','Træneren regner med dig','Bliv en fast del','Restituér','Udviklingsspiller','Fast starter','Nøglespiller','Genveje til spillerkarrieren'])assert(html.includes(text),text);
 for(const id of ['pc-gameplan-title','pc-objectives-title','pc-training-title','pc-contracts-title']){
  assert(html.includes(`id="${id}"`));assert(html.includes(`href="#${id}"`));
 }
 assert.equal((html.match(/name="career-gameplan"/g)||[]).length,3);
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 assert(html.indexOf('id="pc-match-title"')<html.indexOf('id="pc-gameplan-title"'));
 assert(html.indexOf('id="pc-match-title"')<html.indexOf('id="pc-attributes-title"'));
 for(const text of ['6 personlige mål','Tillid 65','Form 6,8','12 personlige mål','Tillid 80','4 vindersæsoner'])assert(html.includes(text),text);
 assert(!/NaN|undefined|Infinity/.test(html));
});
test('a running personal match renders only the elapsed scoreboard and its actual highlights',()=>{
 const s=make();act(s,{id:'live',type:'player-career-match',journeyVersion:1},0,()=>0);
 const initial=screen(s,0);assert(initial.includes('DIN KAMPDAG · 0'));
 assert(!initial.includes('Du sender bolden i nettet!'));assert(initial.includes('Kun hændelser, der allerede er spillet'));
 const played=screen(s,30000);assert(played.includes('Du sender bolden i nettet!'));
 assert(played.includes('SIMULERET KAMP'));assert(!played.includes('pc-latest-rewards'));assert.equal(view(s,30000).wallet,100);
 assert(!initial.includes('Kampen er færdig'));
});
test('a tired player can find recovery and does not receive a fake match result for resting',()=>{
 const s=make();s.playerCareer.journey.fitness=12;
 const tired=screen(s,0);assert(tired.includes('mindst 25 energi'));
 act(s,{id:'rest',type:'player-career-rest',journeyVersion:1},0);
 const active=screen(s,1000);assert(active.includes('Igangværende restitution'));
 assert(active.includes('Restitution'));assert(!active.includes('Kamp mod din næste modstander'));
 settle(s,45000);const completed=screen(s,45000);
 assert(completed.includes('Du har genvundet kræfterne'));assert(completed.includes('+35 energi'));
 assert(!completed.includes('0–0'));assert(!completed.includes('Kampen er færdig'));
});
test('contract roles stay readable and unavailable high-pressure roles cannot be selected',()=>{
 const s=make(),html=render(<CareerContractTerms journey={view(s,0).journey} value="development" onChange={()=>{}} disabled={false}/>);
 assert.equal((html.match(/type="radio"/g)||[]).length,3);
 assert.equal((html.match(/disabled=""/g)||[]).length,2);
 assert(html.includes('10 karrierekampe'));assert(html.includes('20 karrierekampe'));
 assert(html.includes('15% højere'));assert(html.includes('30% højere'));
});
test('goal rewards, completed goals and automatic season payments have explicit outcome copy',()=>{
 const s=make();let now=0;
 for(let i=0;i<3;i++){act(s,{id:'train'+i,type:'player-career-train',key:'physical',journeyVersion:1},now);now+=60000;settle(s,now);}
 let html=screen(s,now);assert(html.includes('Hent belønning'));
 const goal=view(s,now).journey.objectives.find(x=>x.key==='training');
 act(s,{id:'claim',type:'player-career-claim-objective',key:goal.id,journeyVersion:1},now);
 html=screen(s,now);assert(html.includes('Hentet'));assert(html.includes('udbetales automatisk'));
 assert(!/NaN|undefined|Infinity/.test(html));
});
