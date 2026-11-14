import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import ClubHub from '../src/ClubHub.jsx';

const base=()=>({
 name:'Nordhavn FC',season:3,tier:2,played:4,formation:'4-3-3',strength:63,supporters:680,
 rate:12,players:Array(11).fill({}),reserves:[],academyFacility:{program:null},
 clubStyle:{color:'lime',pattern:'solid',crest:'shield',motto:'Vores klub. Vores vej.'},
 stadium:{name:'Klubstadion',capacity:1688,level:3,stage:1},
 active:null,playerCareer:null,europe:null,
});
const view=(state,now=1000)=>renderToStaticMarkup(<ClubHub state={state} money={12345} now={now} rank={2} busy={false} onPlay={()=>{}} onNavigate={()=>{}}/>);

test('refreshed clubhouse keeps its match action and three club shortcuts while exposing optional careers and Europe',()=>{
 const html=view(base());
 for(const label of ['Spil selv i 3D','Mit hold','Transfers','Akademi','Spillerkarriere','Aurora Europa Cup','Vores klub. Vores vej.'])assert(html.toLowerCase().includes(label.toLowerCase()),label);
 assert.equal((html.match(/class="hub-shortcut /g)||[]).length,3);
 assert.equal((html.match(/class="hub-world-card /g)||[]).length,2);
 assert(html.includes('aria-label="Opret din egen spillerkarriere"'));
 assert(html.includes('Kvalificér klubben i Superligaen'));
 assert(!html.includes('Din plads er klar'));
 assert(!/NaN|undefined|Infinity/.test(html.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,'')));
});

test('career entry uses real saved progress and distinguishes running tasks from tasks ready to update',()=>{
 const state=base();
 state.playerCareer={name:'Oliver',level:8,rating:62,club:{name:'Fjordby BK'},active:null};
 let html=view(state);
 assert(html.includes('Fortsæt spillerkarrieren for Oliver'));
 assert(html.includes('Niveau 8 · 62 i styrke'));
 assert(html.includes('Fjordby BK'));
 state.playerCareer.active={kind:'training',started:0,ends:2000};
 html=view(state,1000);assert(html.includes('Træning i gang'));assert(!html.includes('Træningen er klar'));
 html=view(state,2000);assert(html.includes('Træningen er klar'));
 state.playerCareer.active={kind:'match',started:0,ends:2000};
 html=view(state,2000);assert(html.includes('Kampen afsluttes'));assert(!html.includes('Du vandt'));
 state.playerCareer.active={kind:'recovery',started:0,ends:2000};
 html=view(state,1000);assert(html.includes('Restitution i gang'));assert(!html.includes('Kamp i gang'));
 html=view(state,2000);assert(html.includes('Restitutionen afsluttes'));
});

test('Europe entry describes earned places, ongoing knockout rounds and completed campaigns correctly',()=>{
 const state=base();
 state.europe={canEnter:true,pendingEntry:{clubSeason:12},campaign:null,active:false};
 let html=view(state);assert(html.includes('Din plads er klar'));assert(html.includes('Optjent i sæson 12'));
 state.europe={canEnter:false,pendingEntry:{clubSeason:13},active:false,campaign:{champion:false,eliminated:false,nextMatch:{label:'Semifinale',opponent:'Torino Stella'}}};
 html=view(state);assert(html.includes('Semifinale'));assert(html.includes('Torino Stella'));assert(!html.includes('Din plads er klar'));
 state.europe.campaign={champion:true,eliminated:false};
 html=view(state);assert(html.includes('Plads optjent'));assert(!html.includes('Regerende Europa-mester'));
 state.europe.pendingEntry=null;
 html=view(state);assert(html.includes('Regerende Europa-mester'));
 state.europe.campaign={champion:false,eliminated:true};
 html=view(state);assert(html.includes('Jagten på næste kvalifikation'));assert(!html.includes('Regerende Europa-mester'));
});

test('clubhouse resumes live European matches and formats negative income without contradictory signs',()=>{
 const state=base();state.rate=-2;
 state.active={competition:'europe',started:0,ends:36000,home:1,away:0,opponent:'Torino Stella'};
 const html=view(state,18000);
 assert(html.includes('Se live'));assert(!html.includes('Spil selv i 3D'));
 assert(html.includes('EUROPA'));assert(html.includes('45′'));
 assert(html.includes('-7.200 kr./t.'));assert(!html.includes('+-'));
 assert(!/NaN|undefined|Infinity/.test(html.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,'')));
});
