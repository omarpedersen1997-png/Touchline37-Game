import React from'react';
import{test}from'node:test';import assert from'node:assert/strict';import{renderToStaticMarkup}from'react-dom/server';
import ExpansionCenter,{ExpansionSummary}from'../src/ExpansionCenter.jsx';
import{createGame,publicState}from'../worker/game.js';
const noop=()=>{};
const view=()=>publicState(createGame(0),0);
const render=(s,tab='dna',now=0)=>renderToStaticMarkup(<ExpansionCenter state={s} initialTab={tab} now={now} busy={false} onAction={noop}/>);

test('strategic center renders legacy-normalized DNA and an accessible three-tab navigation',()=>{const s=view();const html=render(s);assert.equal((html.match(/role="tab"/g)||[]).length,3);assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert(html.includes('role="tabpanel"'));assert(html.includes('Klubbens DNA'));assert(html.includes('Første valg er gratis'));assert(html.includes('1.500 kr.'));assert(html.includes('Gratis valg'));assert(!/NaN|undefined|Infinity/.test(html));const fallback=renderToStaticMarkup(<ExpansionCenter state={{}} now={0} onAction={noop}/>);assert(fallback.includes('Forbind til klubben'));});

test('research panel renders branches, server resource prices and a matured project without waiting for ready poll',()=>{const s=view();s.money=10000;s.expansion.points=10;s.expansion.activeResearch={id:'commerce1',name:'Billetanalyse',started:0,ends:180000,ready:false};const html=render(s,'research',180001);assert.equal((html.match(/class="exp-research-branch"/g)||[]).length,3);assert.equal((html.match(/class="exp-research-node /g)||[]).length,6);assert(html.includes('Gennembrud klar'));assert(html.includes('Aktivér opdagelsen'));assert(html.includes('3:00'));assert(html.includes('5:00'));assert(!/NaN|undefined|Infinity/.test(html));const summary=renderToStaticMarkup(<ExpansionSummary state={s} now={180001} onOpen={noop}/>);assert(summary.includes('Dit næste gennembrud er klar.'));});

test('research can use accrued projected money despite a stale available flag',()=>{const s=view();s.money=10000;s.expansion.points=10;for(const n of s.expansion.researchNodes)n.available=false;const html=render(s,'research');const first=[...html.matchAll(/<article class="exp-research-node [\s\S]*?<\/article>/g)].map(m=>m[0]).find(h=>h.includes(s.expansion.researchNodes[0].name));assert(first);assert(first.includes('Start forskning'));assert(!first.match(/<button[^>]+disabled/));});

test('board cards label goals correctly and reopen elapsed cooldown using current time',()=>{const s=view();for(const c of s.expansion.contracts){c.availableAt=1000;c.available=false}const html=render(s,'board',1001);assert(html.includes('5 mål'));assert(!html.includes('5 fremskridt'));assert(!html.includes('Klar om'));for(const card of html.matchAll(/<article class="exp-contract-card [\s\S]*?<\/article>/g)){assert(card[0].includes('Acceptér kontrakten'));assert(!card[0].match(/<button[^>]+disabled/))}const cooling=render(s,'board',0);assert(cooling.includes('Klar om 0:01'));const contract=s.expansion.contracts[0];s.expansion.activeContract={...contract,progress:contract.target,ready:true};const ready=render(s,'board',1001);assert(ready.includes('Belønning klar'));assert(ready.includes('Hent '+contract.reward.toLocaleString('da-DK')+' kr.'));assert(!/NaN|undefined|Infinity/.test(ready));});

test('DNA has one shared total-benefits section outside the three direction cards',()=>{
 const s=view();
 for(const dna of [null,...s.expansion.identities.map(item=>item.id)]){
  s.expansion.dna=dna;
  const html=render(s);
  assert.equal((html.match(/>Din samlede fordel<\/h3>/g)||[]).length,1);
  assert.equal((html.match(/class="exp-total-benefits"/g)||[]).length,1);
  assert.equal((html.match(/aria-label="Dine aktive bonusser"/g)||[]).length,1);
  const cards=[...html.matchAll(/<article class="exp-dna-card [\s\S]*?<\/article>/g)];
  assert.equal(cards.length,3);
  for(const [card] of cards)assert(!card.includes('Din samlede fordel'));
  for(const tab of ['research','board'])assert(!render(s,tab).includes('Din samlede fordel'));
 }
});
