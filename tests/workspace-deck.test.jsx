import React from'react';import{test}from'node:test';import assert from'node:assert/strict';import{renderToStaticMarkup}from'react-dom/server';
import WorkspaceDeck,{workspaceKeyIndex}from'../src/WorkspaceDeck.jsx';import ClubHub from'../src/ClubHub.jsx';import{focusCareerSection}from'../src/career-navigation.js';import{createGame,publicState}from'../worker/game.js';
test('workspace shows one panel and keeps edited forms mounted while deferring the unopened arena',()=>{
 const items=[{id:'match',label:'Kamp',content:<button>Spil</button>},{id:'edit',label:'Klub',content:<input defaultValue="Mit navn"/>},{id:'stadium',label:'Stadion',defer:true,content:<div>ARENA-EXPENSIVE</div>}];
 const html=renderToStaticMarkup(<WorkspaceDeck id="club" label="Klubben" items={items}/>);
 assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert.equal((html.match(/hidden=""/g)||[]).length,2);assert(html.includes('value="Mit navn"'));assert(!html.includes('ARENA-EXPENSIVE'));
 for(const item of items){assert(html.includes(`aria-controls="club-${item.id}-panel"`));assert(html.includes(`aria-labelledby="club-${item.id}-tab"`));}
 const selected=renderToStaticMarkup(<WorkspaceDeck id="club" label="Klubben" items={items} selected="stadium"/>);assert(selected.includes('ARENA-EXPENSIVE'));assert(selected.includes('value="Mit navn"'));
});
test('workspace keyboard navigation wraps, ignores modified keys and keeps the native Tab path',()=>{
 assert.equal(workspaceKeyIndex({key:'ArrowLeft'},0,3),2);assert.equal(workspaceKeyIndex({key:'ArrowRight'},2,3),0);assert.equal(workspaceKeyIndex({key:'Home'},2,3),0);assert.equal(workspaceKeyIndex({key:'End'},0,3),2);
 for(const e of[{key:'Tab'},{key:'ArrowLeft',altKey:true},{key:'Home',defaultPrevented:true},{key:'ArrowRight',ctrlKey:true}])assert.equal(workspaceKeyIndex(e,1,3),null);
});
test('club match page contains both play choices without the stacked destinations and facilities',()=>{
 const state=publicState(createGame(0),0),props={state,money:state.money,now:0,rank:1,onPlay:()=>{},onSimulate:()=>{},onNavigate:()=>{}};
 const match=renderToStaticMarkup(<ClubHub {...props} area="match"/>);assert(match.includes('data-match-mode="manual"'));assert(match.includes('data-match-mode="simulation"'));assert(!match.includes('Aurora Europa Cup'));assert(!match.includes('console-facilities'));assert(!match.includes('hub-shortcuts'));
 const worlds=renderToStaticMarkup(<ClubHub {...props} area="worlds"/>);for(const label of['Aurora Europa Cup','Sæsonpokalen','Transfers','Akademi'])assert(worlds.includes(label));assert(!worlds.includes('game-career-feature'));assert(!worlds.includes('arena-model'));
});
test('career shortcuts reveal a hidden workspace before scrolling and focusing the target',()=>{
 const prior={document:globalThis.document,CustomEvent:globalThis.CustomEvent,requestAnimationFrame:globalThis.requestAnimationFrame},calls=[];
 try{globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};const target={scrollIntoView:()=>calls.push('scroll'),focus:()=>calls.push('focus')};globalThis.document={getElementById:()=>target,dispatchEvent:e=>{assert.equal(e.type,'touchline:reveal-section');assert.equal(e.detail.id,'pc-season-title');calls.push('reveal');}};let frame;globalThis.requestAnimationFrame=fn=>{frame=fn;};focusCareerSection('pc-season-title');assert.deepEqual(calls,['reveal']);frame();assert.deepEqual(calls,['reveal','scroll','focus']);assert.equal(target.tabIndex,-1);}finally{Object.assign(globalThis,prior);}
});
