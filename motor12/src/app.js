import { PHASE, createMatch, kickOff,timeLabel,setTactics,substitute,swapRoles } from './engine.js';
import { FORMATIONS, TACTICS, PRESS, fieldRole } from './teams.js';
import { loadClub, saveClub, newClub, nextMatch, nextOpponent, trainClub, settleMatch, money } from './club.js';
import { pitchView } from './pitch.js';
import { createMatchLoop } from './loop.js';
import { matchAudio } from './audio.js';

const container=document.querySelector('#game');
const demo=new URLSearchParams(location.search).get('demo')==='1';
let storage;
try{storage=localStorage;}catch{}
let club=demo?newClub():loadClub(storage);
let match=demo?createMatch():club.active;
let paused=true, speed=1, frame=0, lastPaint=0, lastEvent=0, savedTime=0, loop, pitch, observer;
let notice='', view=initialView();
const audio=matchAudio();
const nav=[['overview','Forside'],['match','Kamp'],['tactics','Taktik'],['squad','Trup'],['club','Klubstatus']];
const eventLabels={kickoff:'Afspark',shot:'Skud',chance:'Chance',save:'Redning',restart:'Dødbold',goal:'Mål',card:'Kort',sub:'Udskiftning',half:'Halvleg',full:'Slutfløjt',tactics:'Taktik'};
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[char]));
const decimalFormat=new Intl.NumberFormat('da-DK',{maximumFractionDigits:2,minimumFractionDigits:2});
const decimal=value=>decimalFormat.format(value);
const selected=(value,current)=>value===current?' selected':'';
function initialView(){
  if(demo)return 'match';
  const hash=location.hash.slice(1);
  return ['overview','match','tactics','squad','club'].includes(hash)?hash:'overview';
}
function save(){if(!demo&&!saveClub(club,storage))notice='Lokal lagring er utilgængelig. Behold fanen åben.';}
function prepare(){
  if(!match)match=demo?createMatch():nextMatch(club);
  loop=createMatchLoop(match);lastEvent=match.eventId;
  paused=true;save();
}
function title(head,sub,label){
  return `<div class="app-heading"><div><p class="kicker">${label}</p><h1>${head}</h1></div><p>${sub}</p></div>`;
}
function overview(){
  const opponent=match?.teams[1]||nextOpponent(club);
  const strength=Math.round(club.roster.slice(0,11).reduce((sum,p)=>sum+p.skill,0)/11);
  return title(escape(club.name),'', 'DIT KLUBHUS')+
    `<section class="fixture"><div class="fixture-info"><p class="kicker">NÆSTE KAMP</p><span>${escape(opponent.formation)} · Styrke ${opponent.rating}</span></div>
    <div class="fixture-teams"><span>${escape(club.name)}</span><span>mod</span><strong>${escape(opponent.name)}</strong></div>
    <div class="fixture-actions"><button class="primary" data-action="match">${match?'Åbn kampen':'Gør klar til kamp'}</button><button data-action="tactics">Sæt kampplan</button></div></section>
    <dl class="club-ledger"><div><dt>Klubkasse</dt><dd>${money(club.budget)}</dd></div><div><dt>Ligapoint</dt><dd>${club.points}</dd></div><div><dt>Startelleverens rating</dt><dd>${strength}</dd></div></dl>`;
}
function phaseLabel(){
  switch(match.phase){
    case PHASE.PRE_KICKOFF:return 'Klar til afspark';
    case PHASE.KICKOFF_READY:return match.kickReason==='half'?'Halvleg · klar til 2. halvleg':'Mål · klar til nyt afspark';
    case PHASE.FULL_TIME:return 'Slutfløjt';
    case PHASE.DEAD_BALL:return 'Dødbold';
    default:return paused?'Pause':'I gang';
  }
}
function possession(){
  const h=match.teams[0].stats.possession,a=match.teams[1].stats.possession;
  return h+a?Math.round(h/(h+a)*100):50;
}
function statMarkup(){
  const a=match.teams[0].stats,b=match.teams[1].stats,p=possession();
  return [['Boldbesiddelse',p+' %',(100-p)+' %'],['Chancer · xG',decimal(a.xg),decimal(b.xg)],
    ['Skud på mål',a.onTarget+' / '+a.shots,b.onTarget+' / '+b.shots],
    ['Afleveringer',a.complete+' / '+a.passes,b.complete+' / '+b.passes],['Redninger',a.saves,b.saves]].
    map(([label,x,y])=>`<div class="stat-row"><b>${x}</b><span>${label}</span><b>${y}</b></div>`).join('');
}
function eventMarkup(){
  if(!match.events.length)return '<p class="muted">Kamphændelser vises efter dit første afspark.</p>';
  return match.events.slice(0,12).map(e=>`<li><time>${e.minute}′</time><div><strong>${escape(e.text)}</strong><small>${escape(e.subject||eventLabels[e.kind]||'')}</small></div><span class="event-dot side-${e.side}"></span></li>`).join('');
}
function reportMarkup(){
  const home=match.teams[0],away=match.teams[1];
  const profile=[...home.players,...home.used,...away.players,...away.used].sort((a,b)=>b.impact-a.impact)[0];
  return `<section class="report"><p class="kicker">SLUTFLØJT · KAMPRAPPORT</p><h2>${home.stats.goals} : ${away.stats.goals}</h2><p>Kampens profil <strong>${escape(profile.name)}</strong> · ${decimal(home.stats.xg)} / ${decimal(away.stats.xg)} xG</p>
    <button class="primary" data-action="settle">${demo?'Spil igen':'Afregn og gå til klubben'}</button></section>`;
}
function matchMarkup(){
  const [home,away]=match.teams;
  return `<section class="match-sheet" aria-label="Kampvisning">
    <div class="scoreboard"><div class="score-team home"><span class="team-code">${escape(home.code)}</span><strong>${escape(home.name)}</strong></div>
    <div class="score-centre"><time id="clock">00:00</time><strong id="score"></strong></div>
    <div class="score-team away"><span class="team-code">${escape(away.code)}</span><strong>${escape(away.name)}</strong></div></div>
    <div class="arena"><canvas id="pitch" aria-label="Taktisk bane med begge holds spillere"></canvas></div>
    <div class="match-desk"><div class="play-state"><span id="phase" role="status"></span><button id="play-control" class="primary" data-action="play">Kick Off</button></div>
    <div class="controls"><div class="speeds" role="group" aria-label="Kamphastighed">${[1,2,4].map(n=>`<button data-speed="${n}" aria-pressed="${speed===n}">${n}×</button>`).join('')}</div>
    <div class="match-options"><button data-action="sound" aria-pressed="${club.sound}">${club.sound?'Lyd til':'Lyd fra'}</button><button data-action="tactics">Taktik</button></div></div></div>
    <div id="match-report">${match.phase===PHASE.FULL_TIME?reportMarkup():''}</div></section>
    <div class="insights"><section class="live-stats"><h2>Kampstatistik</h2><div id="stats"></div><div class="momentum"><span>Momentum</span><meter id="momentum" min="0" max="100" value="50" aria-label="Momentum for hjemmeholdet"></meter></div></section>
    <section class="timeline"><h2>Kampforløb</h2><ol id="events"></ol></section></div>`;
}
function tactical(){
  const team=match?.teams[0];
  const formation=team?.formation||club.formation;
  const players=team?.players||club.roster.slice(0,11);
  const options=players.slice(1).map((p,i)=>`<option value="${i+1}" ${p.red?'disabled':''}>${escape(p.name)}</option>`).join('');
  return title('Taktiktavlen','Se kæderne og tilpas kampplanen.','HOLD & KAMPPLAN')+
    `<div class="strategy"><section class="tactic-board" aria-label="Startopstillingen"><span class="tactic-line"></span><span class="tactic-circle"></span>
    ${players.map((p,i)=>{
      if(p.red)return '';
      const [x,y]=FORMATIONS[formation][p.roleSlot??i];
      return `<div class="tactic-player" style="--x:${50+y*47}%;--y:${90-x*91}%"><b>${p.number}</b><small>${escape(p.name.split(' ').at(-1))}</small></div>`;
    }).join('')}</section>
    <section class="tile tactics-form"><h2>Kampplan</h2><label>Formation<select data-setting="formation">${Object.keys(FORMATIONS).map(key=>`<option${selected(key,formation)}>${key}</option>`).join('')}</select></label>
    <label>Mentalitet<select data-setting="mentality">${Object.entries(TACTICS).map(([key,t])=>`<option value="${key}"${selected(key,team?.mentality||'balanced')}>${t.label}</option>`).join('')}</select></label>
    <label>Preshøjde<select data-setting="press">${Object.entries(PRESS).map(([key,label])=>`<option value="${key}"${selected(key,team?.press||'medium')}>${label}</option>`).join('')}</select></label>
    <p class="muted">${match?'Ændringer registreres i kampforløbet.':'Din kampplan bruges ved næste afspark.'}</p>
    <form id="roles"><label>Byt position for<select name="first">${options}</select></label><label>Med<select name="second">${options}</select></label>
    <button type="submit">Byt positioner</button><p role="status">${escape(notice)}</p></form>
    <button class="primary" data-action="match">${match?'Tilbage til kampen':'Til afspark'}</button></section></div>`;
}
function squad(){
  const team=match?.teams[0], players=team?.players||club.roster.slice(0,11),bench=team?.bench||club.roster.slice(11);
  return title('Startellever og reserver',match?team.subs+' af 5 udskiftninger brugt':'Vælg din startellever før afspark.','TRUP & FORM')+
    `<div class="squad-grid"><section class="tile roster"><div class="roster-head"><span>Spiller</span><span>Form</span><span>Kondition</span></div>${players.map((p,i)=>`<div class="roster-row"><span class="squad-name"><b>${p.number}</b><span>${escape(p.name)}<small>${fieldRole(team?.formation||club.formation,p.roleSlot??i)}${p.red?' · Udvist':p.yellow?' · Gult kort':''}</small></span></span><strong>${p.form}/10</strong><span><meter min="0" max="100" value="${p.energy}" aria-label="Kondition for ${escape(p.name)}"></meter><small>${Math.round(p.energy)} %</small></span></div>`).join('')}</section>
    <section class="tile subs"><h2>Skift spiller</h2>
    <form id="subs"><label>Spiller ud<select name="slot">${players.map((p,i)=>`<option value="${i}" ${p.red?'disabled':''}>${escape(p.name)}</option>`).join('')}</select></label>
    <label>Spiller ind<select name="bench" required>${bench.map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · ${p.role}</option>`).join('')}</select></label>
    <button class="primary" ${bench.length?'':'disabled'}>Bekræft skift</button></form><p class="muted">Målmænd kan skiftes med en anden målmand. Kendte form- og konditionstal følger spilleren.</p><p role="status" id="notice">${escape(notice)}</p></section></div>`;
}
function clubView(){
  return title('Klubstatus','Fremdrift, træning og resultater for denne enhed.','KLUBDRIFT')+
  `<div class="dashboard dashboard-three"><section class="tile"><p class="kicker">BUDGET</p><strong>${money(club.budget)}</strong></section><section class="tile"><p class="kicker">POINT</p><strong>${club.points}</strong></section><section class="tile"><p class="kicker">KAMPE</p><strong>${club.played}</strong></section></div>
    <div class="club-details"><section class="tile"><h2>Restitutionstræning</h2><p>8.500 kr. giver op til 10 konditionspoint og ét formpoint før næste kamp.</p><button class="primary" data-action="train" ${club.active||club.trained||club.budget<8500?'disabled':''}>Planlæg træning</button><p role="status">${escape(notice)}</p></section>
    <section class="tile"><h2>Seneste resultater</h2>${club.history.length?club.history.slice(0,6).map(item=>`<div class="history"><b>${item.goals} : ${item.conceded}</b><span>${escape(item.opponent)}</span><strong>${money(item.revenue)}</strong></div>`).join(''):'<p class="muted">Spil den første kamp for at se dit resultat og din indtægt.</p>'}</section></div>
    ${demo?'':'<details class="local-data"><summary>Lokale data</summary><p>Slet din Motor 12-klub og den aktive kamp på denne enhed.</p><button data-action="reset">Slet lokal klub</button></details>'}`;
}
function put(id,value){const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value;}
let renderedEvent=-1, renderedStats='', renderedPhase='';
function paintHUD(){
  put('clock',timeLabel(match));
  put('score',match.teams[0].stats.goals+' : '+match.teams[1].stats.goals);
  put('phase',phaseLabel());
  const phase=match.phase===PHASE.FULL_TIME?'Slutfløjt':
    match.phase===PHASE.PRE_KICKOFF||match.phase===PHASE.KICKOFF_READY?'Kick Off':paused?'Genoptag':'Pause';
  if(phase!==renderedPhase){const button=document.querySelector('#play-control');button.textContent=phase;button.disabled=phase==='Slutfløjt';renderedPhase=phase;}
  const stats=statMarkup();
  if(renderedStats!==stats){document.querySelector('#stats').innerHTML=stats;renderedStats=stats;}
  document.querySelector('#momentum').value=Math.round(match.momentum*100);
  if(renderedEvent!==match.eventId){
    const events=document.querySelector('#events');
    if(events.tagName==='OL')events.classList.toggle('no-items',!match.events.length);
    events.innerHTML=match.events.length?eventMarkup():'<li class="muted">Kamphændelser vises efter dit første afspark.</li>';
    renderedEvent=match.eventId;
  }
}
function stop(){paused=true;loop?.reset();cancelAnimationFrame(frame);frame=0;}
function render(){
  stop();observer?.disconnect();
  renderedEvent=-1;renderedStats='';renderedPhase='';
  if(view==='match')prepare();
  const content=({overview,match:matchMarkup,tactics:tactical,squad,club:clubView})[view]();
  container.innerHTML=`${demo?'<div class="preview-bar"><span>LOKAL PRØVEKAMP</span><a href="./index.html">Til klubhuset</a></div>':`<nav class="app-nav" aria-label="Klubmenu">${nav.map(([id,label])=>`<a href="#${id}" ${id===view?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`}${content}`;
  if(view==='match'){
    const canvas=document.querySelector('#pitch');
    pitch=pitchView(canvas);
    const layout=()=>{if(pitch.layout())pitch.render(match,null);};
    if(typeof ResizeObserver==='function'){observer=new ResizeObserver(layout);observer.observe(canvas);}
    layout();
    paintHUD();
  }
}
function go(next){
  notice='';view=next;
  if(!demo)history.replaceState(null,'','#'+next);
  render();save();
}
function onFrame(now){
  const alpha=loop.advance(now,speed);
  pitch.render(match,loop.previous,alpha);
  if(now-lastPaint>145){paintHUD();lastPaint=now;}
  const latest=match.events[0];
  if(latest?.id>lastEvent){
    lastEvent=latest.id;
    if(['goal','half','full'].includes(latest.kind))audio.whistle(latest.kind);
  }
  if(now-savedTime>4000){save();savedTime=now;}
  if(match.phase===PHASE.PLAYING||match.phase===PHASE.DEAD_BALL){frame=requestAnimationFrame(onFrame);return;}
  stop();save();paintHUD();
  if(match.phase===PHASE.FULL_TIME)document.querySelector('#match-report').innerHTML=reportMarkup();
}
function start(){
  if(paused||!frame){paused=false;loop.reset();frame=requestAnimationFrame(onFrame);}
  paintHUD();
}
container.addEventListener('click',event=>{
  const button=event.target.closest('button');
  const link=event.target.closest('.app-nav a');
  if(link){event.preventDefault();go(link.hash.slice(1));return;}
  if(!button)return;
  if(button.dataset.speed){
    speed=Number(button.dataset.speed);
    for(const item of container.querySelectorAll('[data-speed]'))item.setAttribute('aria-pressed',String(Number(item.dataset.speed)===speed));
    return;
  }
  const action=button.dataset.action;
  if(action==='play'){
    if(kickOff(match)){
      lastEvent=match.eventId;void audio.enable(club.sound).then(()=>audio.whistle('kickoff'));
      save();start();
    }else if(paused)start();
    else{stop();save();paintHUD();}
  }else if(action==='sound'){
    club.sound=!club.sound;void audio.enable(club.sound);
    button.textContent=club.sound?'Lyd til':'Lyd fra';button.setAttribute('aria-pressed',String(club.sound));save();
  }else if(action==='match'||action==='tactics'){go(action);}
  else if(action==='settle'){
    if(demo){match=createMatch();go('match');return;}
    if(settleMatch(club,match)){match=null;go('club');}
  }else if(action==='train'){
    if(trainClub(club)){notice='Træningen er gennemført.';save();render();}
  }else if(action==='reset'&&confirm('Vil du slette din lokale Motor 12-klub og aktive kamp?')){
    club=newClub();match=null;void audio.enable(false);save();go('overview');
  }
});
container.addEventListener('change',event=>{
  const key=event.target.dataset.setting;
  if(!key)return;
  const control=event.target;
  if(!match)prepare();
  if(setTactics(match,0,{[key]:control.value})){
    if(!demo)club.formation=match.teams[0].formation;
    save();render();container.querySelector(`[data-setting="${key}"]`)?.focus();
  }
});
container.addEventListener('submit',event=>{
  if(event.target.id==='roles'){
    event.preventDefault();
    const data=new FormData(event.target);
    if(!match)prepare();
    const changed=swapRoles(match,0,Number(data.get('first')),Number(data.get('second')));
    notice=changed?'Positionerne er byttet.':'Vælg to forskellige markspillere.';
    if(changed)save();
    render();
    return;
  }
  if(event.target.id!=='subs')return;
  event.preventDefault();
  const form=new FormData(event.target);
  if(!match)prepare();
  const changed=substitute(match,0,Number(form.get('slot')),form.get('bench'));
  notice=changed?'Skiftet er gennemført.':'Spilleren kan ikke bruges til det valgte skift.';
  if(changed){
    if(!demo&&match.phase===PHASE.PRE_KICKOFF){
      const rosterById=new Map(club.roster.map(p=>[p.id,p]));
      const team=match.teams[0];
      club.roster=[...team.players,...team.bench].map(p=>rosterById.get(p.id));
    }
    save();
  }
  render();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();save();if(view==='match')paintHUD();}});
window.addEventListener('pagehide',()=>{stop();save();});
window.addEventListener('hashchange',()=>{if(!demo&&view!==initialView())go(initialView());});
render();
