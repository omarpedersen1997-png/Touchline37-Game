import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import MatchStatistics from '../src/MatchStatistics.jsx';
import {matchStatistics,matchStatisticText} from '../src/match-statistics.js';

test('possession percentages use the actual recorded possession ticks and do not invent an even split',()=>{
 const live=matchStatistics({homeShots:5,awayShots:2,homeSaves:1,awaySaves:3,homePossession:180,awayPossession:60});
 assert.deepEqual(live.rows.find(row=>row.key==='possession'),{key:'possession',label:'Boldbesiddelse',home:75,away:25,percent:true});
 const start=matchStatistics({homeShots:0,awayShots:0,homeSaves:0,awaySaves:0,homePossession:0,awayPossession:0});
 assert(start.available);assert(!start.hasPossession);assert.equal(start.rows[0].home,0);assert.equal(start.rows[2].home,null);assert.equal(start.rows[2].away,null);assert.equal(matchStatisticText(start.rows[2].home,true),'—');
});

test('legacy home-only passing and tackling counters never become invented away or combined totals',()=>{
 const data=matchStatistics({homeShots:3,awayShots:2,passes:17,completedPasses:11,tackles:4});
 assert.equal(data.rows.length,3);assert.deepEqual(data.homeOnly.map(row=>[row.label,row.value]),[['Afleveringsforsøg',17],['Fuldførte afleveringer',11],['Vundne tacklinger',4]]);
 assert.equal(data.rows.find(row=>row.key==='passAttempts'),undefined);
 const html=renderToStaticMarkup(<MatchStatistics stats={{homeShots:3,awayShots:2,passes:17,completedPasses:11,tackles:4}} club="Havnebro BK" opponent="Nordby IF"/>);
 assert(html.includes('Havnebro BK · registrerede handlinger'));assert(html.includes('Modstanderens tal for disse handlinger er ikke registreret')); assert(!html.includes('begge hold'));assert(!html.includes('samlet'));
});

test('new engine side-specific counters show actual differences without duplicating legacy counters',()=>{
 const data=matchStatistics({homeShots:8,awayShots:4,homePossession:7,awayPossession:3,passes:99,completedPasses:88,tackles:77,homePassAttempts:20,awayPassAttempts:12,homeCompletedPasses:14,awayCompletedPasses:9,homeTackles:5,awayTackles:3});
 assert.equal(data.homeOnly.length,0);assert.equal(data.rows.length,6);
 assert.deepEqual(data.rows.slice(3).map(row=>[row.home,row.away]),[[20,12],[14,9],[5,3]]);
 const html=renderToStaticMarkup(<MatchStatistics stats={{homeShots:8,awayShots:4,homeSaves:2,awaySaves:1,homePossession:7,awayPossession:3,homePassAttempts:20,awayPassAttempts:12,homeCompletedPasses:14,awayCompletedPasses:9,homeTackles:5,awayTackles:3}} club="Havnebro BK" opponent="Nordby IF"/>);
 assert(html.includes('70 %'));assert(html.includes('30 %'));assert(html.includes('Afleveringsforsøg'));assert(!html.includes('Modstanderens tal for disse handlinger')); 
});

test('invalid or absent measurements stay bounded and cannot produce NaN, Infinity or a fabricated value',()=>{
 for(const raw of[null,undefined,[],{},{homeShots:NaN,awayShots:Infinity,homePossession:'60',awayPossession:20},{homeShots:-4,awayShots:4.9,homePossession:-5,awayPossession:10,homePassAttempts:2,awayPassAttempts:4,homeCompletedPasses:20,awayCompletedPasses:Infinity}]){
  const data=matchStatistics(raw);for(const row of data.rows)for(const value of[row.home,row.away])assert(value===null||Number.isInteger(value)&&value>=0&&value<=1000000);
  const html=renderToStaticMarkup(<MatchStatistics stats={raw}/>);assert(!/NaN|Infinity|undefined/.test(html));
 }
 const corrupt=matchStatistics({homePassAttempts:2,awayPassAttempts:4,homeCompletedPasses:20,awayCompletedPasses:8});assert.deepEqual(corrupt.rows.find(row=>row.key==='completedPasses'),{key:'completedPasses',label:'Fuldførte afleveringer',home:2,away:4});
 assert(!matchStatistics(null).available);
});

test('statistics use accessible row/column headers and personal contributions appear only when requested',()=>{
 const stats={homeShots:3,awayShots:1,homePossession:2,awayPossession:1,userGoals:1,userAssists:2,userSaves:0,userPasses:8,userTackles:4};
 const normal=renderToStaticMarkup(<MatchStatistics stats={stats} club="Mit & dit" opponent="Nordby"/>),personal=renderToStaticMarkup(<MatchStatistics stats={stats} club="Mit & dit" opponent="Nordby" personal/>);
 assert(normal.includes('aria-label="Kampstatistik"'));assert(normal.includes('<caption'));assert(normal.includes('scope="col"'));assert(normal.includes('scope="row"'));assert(normal.includes('Mit &amp; dit'));assert(!normal.includes('Din indsats'));
 assert(personal.includes('<summary>Din indsats</summary>'));assert(personal.includes('<dt>Mål</dt><dd>1</dd>'));assert(personal.includes('<dt>Oplæg</dt><dd>2</dd>'));assert(!personal.includes('xG'));assert(!personal.includes('rating'));
});
