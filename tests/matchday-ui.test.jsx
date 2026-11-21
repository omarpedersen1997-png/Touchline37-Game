import ClubJourney from '../src/ClubJourney.jsx';
import React from 'react';import {test} from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import ClubBriefing,{clubDecisions} from '../src/ClubBriefing.jsx';import MatchAnalysis from '../src/MatchAnalysis.jsx';import MatchLivePulse from '../src/MatchLivePulse.jsx';
test('briefing connects actual ready rewards and licences without inventing a withdrawal or credit',()=>{
 const state={missions:[{ready:true,claimed:false}],competition:{license:{ready:false}},formation:'4-3-3',strength:59};const before=structuredClone(state),items=clubDecisions(state);assert.deepEqual(items.map(i=>i.to),['goals','upgrades','team']);
 const html=renderToStaticMarkup(<ClubBriefing state={state} offline={{earned:1234,seconds:300}} onNavigate={()=>{}}/>);assert(html.includes('1.234 kr.'));assert(html.includes('allerede tilføjet af serveren'));assert(!html.includes('Hent penge'));assert.deepEqual(state,before);assert(!renderToStaticMarkup(<ClubBriefing state={{}}/>).includes('Velkommen tilbage.'));
});
test('analysis preserves missing individual data and catch-up text describes clock work without a stuck resume claim',()=>{
 const html=renderToStaticMarkup(<MatchAnalysis analysis={{accuracy:null,tired:null,star:null,advice:['Se planen.']}}/>);assert(!html.includes('Kampens spiller'));assert(!html.includes('Lav kampenergi'));
 const live=renderToStaticMarkup(<MatchLivePulse catchingUp/>);assert(live.includes('Indhenter kampuret'));assert(!live.includes('Genoptager kampen'));
});

test('empty legacy milestone lists render a valid progress range without NaN',()=>{const html=renderToStaticMarkup(<ClubJourney state={{name:'Klub',missions:[]}} onNavigate={()=>{}}/>);assert(!html.includes('NaN'));assert(html.includes('aria-valuemax="1"'));assert(html.includes('width:0%'));});
