import {createMatch,kickOff,setTactics,substitute,PHASE,timeLabel} from './engine.js';
import {FORMATIONS,PRESS} from './teams.js';
import {pitchView} from './pitch.js';
import {createMatchLoop} from './loop.js';
import {matchAudio} from './audio.js';
import {bindSwipe} from './navigation.js';

const find=id=>document.getElementById(id);
const scenes=[...document.querySelectorAll('.scene')];
const nav=[...document.querySelectorAll('.scene-nav a')];
const state=createMatch(), team=state.teams[0], loop=createMatchLoop(state);
const pitch=pitchView(find('demo-pitch')), sound=matchAudio();
const dialog=find('info'),board=find('demo-board');
let scene=-1,frame=0,lastPaint=0,enabled=false,zones=true,eventId=0,wheelTime=0;
function activePlay(){return state.phase===PHASE.PLAYING||state.phase===PHASE.DEAD_BALL;}
function stopped(){cancelAnimationFrame(frame);frame=0;loop.reset();}
function controls(){
  const full=state.phase===PHASE.FULL_TIME;
  find('demo-kick').textContent=full?'Slutfløjt':frame?'Pause':activePlay()?'Genoptag':'Kick Off';
  find('demo-kick').disabled=full;
  document.querySelector('.broadcast').toggleAttribute('data-live',!!frame);
  find('demo-phase').textContent=full?'Kampen er slut':state.phase===PHASE.KICKOFF_READY?(state.kickReason==='half'?'Anden halvleg · klar til afspark':'Mål · klar til afspark'):activePlay()?(frame?state.events[0]?.text||'I gang':'Pause'):'Klar til afspark';
  find('demo-clock').textContent=timeLabel(state);
  find('demo-score').textContent=team.stats.goals+' – '+state.teams[1].stats.goals;
  find('demo-passes').textContent=team.stats.complete+' / '+team.stats.passes;
  find('demo-xg').textContent=team.stats.xg.toLocaleString('da-DK',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function draw(now){
  if(document.hidden||scene!==1){stopped();controls();return;}
  const alpha=loop.advance(now);pitch.render(state,loop.previous,alpha,-1,zones);
  const latest=state.events[0];
  if(latest&&latest.id!==eventId){
    eventId=latest.id;
    if(['goal','full','half'].includes(latest.kind))sound.whistle(latest.kind);
  }
  if(!activePlay()){stopped();controls();return;}
  if(now-lastPaint>160){controls();lastPaint=now;}
  frame=requestAnimationFrame(draw);
}
find('demo-kick').addEventListener('click',()=>{
  if(frame)stopped();
  else if(state.phase!==PHASE.FULL_TIME){
    if(kickOff(state)){eventId=state.eventId;void sound.enable(enabled).then(()=>sound.whistle('kickoff'));}
    loop.reset();frame=requestAnimationFrame(draw);
  }
  controls();
});
find('demo-zones').onclick=e=>{
  zones=!zones;e.currentTarget.setAttribute('aria-pressed',String(zones));
  pitch.render(state,null,1,-1,zones);
};
find('demo-sound').addEventListener('click',event=>{
  enabled=!enabled;void sound.enable(enabled);event.currentTarget.setAttribute('aria-pressed',String(enabled));
  event.currentTarget.textContent=enabled?'Lyd til':'Lyd fra';
});
const shirtNodes=team.players.map(()=>board.appendChild(document.createElement('i')));
function formation(){
  const rect=board.getBoundingClientRect();
  team.players.forEach((p,i)=>{
    const [depth,lane]=FORMATIONS[team.formation][p.roleSlot??i];
    const y=90-depth*82-(i&&team.press==='high'?5:i&&team.press==='low'?-5:0);
    const node=shirtNodes[i];node.textContent=p.number;node.title=p.name;
    node.hidden=p.red;
    node.style.transform='translate('+((50+lane*51)*rect.width/100)+'px,'+(y*rect.height/100)+'px) translate(-50%,-50%)';
  });
}
for(const [id,key,entries] of [['demo-formation','formation',Object.keys(FORMATIONS).map(f=>[f,f])],['demo-press','press',Object.entries(PRESS)]]){
  const select=find(id);
  for(const [value,label] of entries) select.add(new Option(label,value));
  select.value=team[key];
  select.onchange=()=>{setTactics(state,0,{[key]:select.value});formation();controls();};
}
function openDrawer(markup){
  find('drawer-body').innerHTML=markup;
  dialog.showModal();
}
find('demo-sub').onclick=()=>{
  openDrawer('<h2 id="drawer-title">Spillerskift</h2><form id="show-sub"><label>Spiller ud<select name="out"></select></label><label>Spiller ind<select name="incoming"></select></label><button class="cta">Bekræft skift</button></form>');
  const form=find('show-sub'),out=form.elements.out,incoming=form.elements.incoming;
  for(const p of team.players)if(!p.red)out.add(new Option(p.name,p.slot));
  out.value=String(team.players.find(p=>p.slot>0&&!p.red)?.slot??0);
  function candidates(){
    incoming.replaceChildren();
    for(const p of team.bench)if((p.role==='MÅL')===(Number(out.value)===0))incoming.add(new Option(p.name,p.id));
    form.querySelector('button').disabled=!incoming.length||team.subs>=5||state.phase===PHASE.FULL_TIME;
  }
  out.onchange=candidates;candidates();
  form.onsubmit=e=>{e.preventDefault();if(substitute(state,0,Number(out.value),incoming.value)){find('demo-notice').textContent=state.events[0].text;dialog.close();formation();controls();}};
};
const help={
  kontakt:['Kontakt / Support','Har du brug for hjælp til klubben, spillet eller din konto? Send din henvendelse til OPNext Games via Touchlines kontaktformular.','Åbn kontaktformularen','https://playtouchline.dk/contact'],
  privatliv:['Privatliv','Prøvevisningen kører i denne fane. Klubhuset gemmer din lokale klub på enheden. Læs om konto, databehandling og dine rettigheder i Touchlines privatlivspolitik.','Læs privatlivspolitikken','https://playtouchline.dk/privacy'],
  slet:['Kontosletning','Brug formularen til at anmode om sletning af konto og klub. Ejerskab bekræftes først. En lokal Motor 12-klub kan slettes under Klub → Lokale data.','Anmod om kontosletning','https://playtouchline.dk/contact?topic=deletion']
};
document.querySelectorAll('[data-help]').forEach(a=>a.onclick=e=>{
  e.preventDefault();const [heading,body,label,url]=help[a.dataset.help];
  openDrawer('<h2 id="drawer-title">'+heading+'</h2><p>'+body+'</p><a class="cta" href="'+url+'">'+label+' ↗</a>');
});
function layout(){
  if(scene===1&&pitch.layout())pitch.render(state,null,1,-1,zones);
  if(scene===2)formation();
}
function show(index,focus=false){
  if(index===scene)return;
  stopped();scene=index;
  scenes.forEach((s,i)=>{s.hidden=i!==index;s.inert=i!==index;
    if(i===index)nav[i].setAttribute('aria-current','step');else nav[i].removeAttribute('aria-current');
  });
  const heading=scenes[index].querySelector('h1,h2');
  if(focus){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  scenes[index].scrollTop=0;layout();controls();
}
function route(focus){const index=scenes.findIndex(s=>'#'+s.id===location.hash);show(Math.max(0,index),focus);}
function move(delta){const next=scenes[scene+delta];if(next)location.hash=next.id;}
window.addEventListener('hashchange',()=>route(true));
document.querySelector('[data-next]').onclick=()=>move(1);
document.addEventListener('keydown',e=>{
  if(dialog.open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('select,input,textarea'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}
});
bindSwipe(find('scenes'),move);
find('scenes').addEventListener('wheel',e=>{
  if(dialog.open||e.ctrlKey||e.target.closest('select,dialog'))return;
  const current=scenes[scene];
  if(current.scrollHeight>current.clientHeight+2 && Math.abs(e.deltaY)>Math.abs(e.deltaX))return;
  const travel=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  if(Math.abs(travel)<22)return;
  const now=performance.now();
  if(now-wheelTime>420)move(travel>0?1:-1);
  wheelTime=now;
},{passive:true});
new ResizeObserver(layout).observe(find('scenes'));
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopped();controls();}});
window.addEventListener('pagehide',()=>{stopped();controls();});
route(false);
