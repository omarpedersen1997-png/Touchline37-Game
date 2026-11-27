import {bindSwipe} from './navigation.js';
import {matchRadar} from './radar.js';
import {bindControls} from './controls.js';
import { PHASE, playerRestart, createMatch, kickOff,timeLabel,setTactics,substitute,swapRoles } from './engine.js';
import { FORMATIONS, TACTICS, PRESS, fieldRole } from './teams.js';
import { SEASON_LENGTH,PROMOTION_POINTS,SAFETY_POINTS,loadClub, saveClub, newClub, nextMatch, nextOpponent, trainClub, settleMatch, money } from './club.js';
import { pitchView } from './pitch.js';
import { createMatchLoop } from './loop.js';
import { matchAudio } from './audio.js';
import { SCENARIOS, scenarioMatch, scenarioResult } from './scenarios.js';

const container=document.querySelector('#game');
const demo=new URLSearchParams(location.search).get('demo')==='1';
let storage;
try{storage=localStorage;}catch{}
let club=demo?newClub():loadClub(storage);
let match=demo?createMatch():club.active;
let scenario=null, manual=match?.controlMode!=='simulation', controls=null, radar=null;
let paused=true, speed=1, frame=0, lastPaint=0, lastEvent=0, savedTime=0, loop, pitch, observer;
let arena, arenaToken=0, arenaMode='2d', arenaLoading=false;
let presentationFrame=0;
let notice='', view=initialView();
const audio=matchAudio();
const nav=[['match','Kamp'],['tactics','Taktik'],['squad','Trup'],['club','Klub']];
const eventLabels={kickoff:'Afspark',shot:'Skud',chance:'Chance',save:'Redning',restart:'Dødbold',goal:'Mål',card:'Kort',sub:'Udskiftning',half:'Halvleg',full:'Slutfløjt',tactics:'Taktik'};
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[char]));
const decimalFormat=new Intl.NumberFormat('da-DK',{maximumFractionDigits:2,minimumFractionDigits:2});
const decimal=value=>decimalFormat.format(value);
const selected=(value,current)=>value===current?' selected':'';
function initialView(){
  if(demo)return 'match';
  const hash=location.hash.slice(1);
  return ['overview','match','tactics','squad','club','scenarios'].includes(hash)?hash:'overview';
}
function save(){if(!demo&&!scenario&&!saveClub(club,storage))notice='Lokal lagring er utilgængelig. Behold fanen åben.';}
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
  return `<div class="club-hub"><section class="hub-fixture"><div class="fixture-copy"><p class="kicker">LEAGUE ${club.division} · RUNDE ${club.round+1}/${SEASON_LENGTH}</p>
    <h1>${escape(club.name)}<small>mod</small>${escape(opponent.name)}</h1>
    <div class="hub-actions"><button class="primary" data-mode="manual">Spil selv</button><button data-mode="simulation">Simulér kampen</button></div></div></section>
    <aside class="team-brief"><p class="kicker">Dagens modstander</p><h2>${escape(opponent.name)}</h2><div class="brief-row"><span>Formation</span><b>${escape(opponent.formation)}</b></div><div class="brief-row"><span>Holdstyrke</span><b>${opponent.rating}</b></div>
    <button data-action="scenarios">Kampsituationer <b aria-hidden="true">↗</b></button></aside>
    <dl class="club-ledger"><div><dt>Ligapoint</dt><dd>${club.seasonPoints}</dd></div><div><dt>Klubkasse</dt><dd>${money(club.budget)}</dd></div><div><dt>Startelleverens rating</dt><dd>${strength}</dd></div></dl></div>`;

}
function scenarioMenu(){
  return title('Kampsituationer','Spil de sidste minutter med en fast stilling og et klart mål.','MOTOR 12')+
    `<div class="scenario-list">${SCENARIOS.map(item=>`<article class="scenario-card"><div class="scenario-score"><b>${item.goals} : ${item.conceded}</b><time>${item.minute}:00</time></div>
    <div><h2>${item.title}</h2><p>${item.description}</p><p><strong>Mål:</strong> ${item.target}</p></div>
    <div class="scenario-actions"><button class="primary" data-scenario="${item.id}" data-mode="manual" aria-label="Spil ${item.title}">Spil selv</button><button data-scenario="${item.id}" data-mode="simulation" aria-label="Simulér ${item.title}">Simulér</button></div></article>`).join('')}</div>
    <p class="scenario-note">Situationer bruger en fast trup. Resultaterne påvirker ikke din ligakamp eller klubkasse.</p>`;
}
function phaseLabel(){
  switch(match.phase){
    case PHASE.PRE_KICKOFF:return 'Klar til afspark';
    case PHASE.KICKOFF_READY:return scenario&&match.tick===scenario.minute*60?'Klar til situationen':
      match.kickReason==='half'?'Halvleg · klar til 2. halvleg':'Mål · klar til nyt afspark';
    case PHASE.FULL_TIME:return 'Slutfløjt';
    case PHASE.DEAD_BALL:return manual&&playerRestart(match)?(match.restart.kind==='goal-kick'?'Dit målspark':'Dit frispark'):'Dødbold';
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
    ${scenario?`<p class="scenario-outcome" role="status">${scenarioResult(scenario,match)?'Målet er nået':'Målet blev ikke nået'} · ${scenario.title}</p>`:''}
    <button class="primary" data-action="settle">${demo||scenario?'Spil igen':'Afregn og gå til klubben'}</button></section>`;
}
function matchMarkup(){
  const [home,away]=match.teams;
  return `<section class="match-sheet ${manual?'user-match':'sim-match'}" aria-label="Kampvisning">
    <div class="scoreboard"><div class="score-team home"><span class="team-code">${escape(home.code)}</span><strong>${escape(home.name)}</strong></div>
    <div class="score-centre"><time id="clock">00:00</time><strong id="score"></strong></div>
    <div class="score-team away"><span class="team-code">${escape(away.code)}</span><strong>${escape(away.name)}</strong></div></div>
    <div class="arena"><canvas id="pitch" aria-label="Taktisk bane med begge holds spillere"></canvas><canvas id="pitch3d" hidden aria-label="Touchline stadion med animerede spillere"></canvas>
    ${manual?`<div class="field-input"><button class="field-stick" aria-label="Styrepude"><i></i></button>
    <div class="radar"><canvas id="mini-pitch" width="180" height="100" aria-label="Minikort over spillere og bold"></canvas><output id="active-player"></output></div><div class="field-actions">${[['switch','Skift'],['tackle','Tackl'],['sprint','Sprint'],['through','Stikning'],['pass','Aflever'],['shoot','Skyd']].map(([id,label])=>`<button id="field-${id}" data-field="${id}">${label}</button>`).join('')}</div></div>`:''}</div>
    <button class="broadcast-menu" data-action="broadcast-menu" aria-expanded="false">Kampmenu</button>
    <div class="camera-desk" role="group" aria-label="Kampkamera"><button data-camera="tv" aria-pressed="false">Arena 3D</button><button data-camera="near" aria-pressed="false">Nærkamera</button><button data-camera="2d" aria-pressed="true">Taktisk</button><button data-action="expand" aria-pressed="false">Udvid</button><span id="arena-status" role="status"></span></div>
    <div class="match-desk"><div class="play-state"><span id="phase" role="status"></span><button id="play-control" class="primary" data-action="play">Kick Off</button></div>
    <div class="controls">${manual?'':`<div class="speeds" role="group" aria-label="Kamphastighed">${[1,2,4].map(n=>`<button data-speed="${n}" aria-pressed="${speed===n}">${n}×</button>`).join('')}</div>`}
    <div class="match-options"><span class="mode-label">${manual?'Spil selv':'Simulering'}</span><button data-action="sound" aria-pressed="${club.sound}">${club.sound?'Lyd til':'Lyd fra'}</button><button data-action="tactics">Taktik</button><button data-action="quick-sub">Skift spiller</button><button data-action="stats">Kampdata</button><button data-action="overview">Kampvalg</button></div></div></div>
    <div id="ticker" class="ticker" aria-label="Seneste kamphændelse"></div><div id="match-report">${match.phase===PHASE.FULL_TIME?reportMarkup():''}</div></section>
    <dialog id="match-data" aria-label="Kampdata"><form method="dialog"><button>Luk ×</button></form><div class="insights"><section class="live-stats"><h2>Kampstatistik</h2><div id="stats"></div><div class="momentum"><span>Momentum</span><meter id="momentum" min="0" max="100" value="50" aria-label="Momentum for hjemmeholdet"></meter></div></section>
    <section class="timeline"><h2>Kampforløb</h2><ol id="events"></ol></section></div></dialog><dialog id="quick-change" aria-label="Hurtig udskiftning"><form method="dialog"><button>Luk ×</button></form></dialog>`;
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
    <details><summary>Byt positioner</summary><form id="roles"><label>Byt position for<select name="first">${options}</select></label><label>Med<select name="second">${options}</select></label>
    <button type="submit">Byt positioner</button><p role="status">${escape(notice)}</p></form></details>
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
  `<section class="league-table"><h2>League ${club.division}</h2><p>${club.seasonPoints} point efter ${club.round} af ${SEASON_LENGTH} kampe. ${PROMOTION_POINTS} point giver ${club.division===1?'mesterskabet':'oprykning'}. Under ${SAFETY_POINTS} point giver ${club.division===10?'en ny sæson i League 10':'nedrykning'}.</p>${club.history[0]?.seasonResult?'<strong>'+escape(club.history[0].seasonResult)+'</strong>':''}</section>
    <div class="dashboard dashboard-three"><section class="tile"><p class="kicker">BUDGET</p><strong>${money(club.budget)}</strong></section><section class="tile"><p class="kicker">POINT</p><strong>${club.points}</strong></section><section class="tile"><p class="kicker">KAMPE</p><strong>${club.played}</strong></section></div>
    <div class="club-details"><section class="tile"><h2>Restitutionstræning</h2><p>8.500 kr. giver op til 10 konditionspoint og ét formpoint før næste kamp.</p><button class="primary" data-action="train" ${club.active||club.trained||club.budget<8500?'disabled':''}>Planlæg træning</button><p role="status">${escape(notice)}</p></section>
    <section class="tile"><h2>Seneste resultater</h2>${club.history.length?club.history.slice(0,6).map(item=>`<div class="history"><b>${item.goals} : ${item.conceded}</b><span>${escape(item.opponent)}</span><strong>${money(item.revenue)}</strong></div>`).join(''):'<p class="muted">Spil den første kamp for at se dit resultat og din indtægt.</p>'}</section></div>
    ${demo?'':'<details class="local-data"><summary>Lokale data</summary><p>Slet din Motor 12-klub og den aktive kamp på denne enhed.</p><button data-action="reset">Slet lokal klub</button></details>'}`;
}
function put(id,value){const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value;}
let renderedEvent=-1, renderedStats='', renderedPhase='';
function paintHUD(){
  const focus=match.teams[0].players[controls?.state.slot];
  put('field-shoot',playerRestart(match)&&match.restart.kind==='goal-kick'?'Langt':'Skyd');
  radar?.(match,controls?.state.slot);
  const actions=container.querySelector('.field-actions');
  if(actions)actions.classList.toggle('defending',(match.ball.owner<0?match.ball.lastTeam:match.ball.owner>>4)===1);
  put('active-player',manual&&playerRestart(match)?phaseLabel():focus?focus.number+' · '+focus.name:'');
  put('clock',timeLabel(match));
  put('score',match.teams[0].stats.goals+' : '+match.teams[1].stats.goals);
  put('phase',phaseLabel());
  const phase=match.phase===PHASE.FULL_TIME?'Slutfløjt':
    match.phase===PHASE.PRE_KICKOFF||match.phase===PHASE.KICKOFF_READY?'Kick Off':paused?'Genoptag':'Pause';
  if(phase!==renderedPhase){container.querySelector('.match-sheet').dataset.status=phase==='Kick Off'?'ready':phase==='Pause'?'live':'stopped';const button=document.querySelector('#play-control');button.textContent=phase;button.disabled=phase==='Slutfløjt';renderedPhase=phase;}
  const stats=statMarkup();
  if(renderedStats!==stats){document.querySelector('#stats').innerHTML=stats;renderedStats=stats;}
  document.querySelector('#momentum').value=Math.round(match.momentum*100);
  if(renderedEvent!==match.eventId){
    const events=document.querySelector('#events');
    if(events.tagName==='OL')events.classList.toggle('no-items',!match.events.length);
    events.innerHTML=match.events.length?eventMarkup():'<li class="muted">Kamphændelser vises efter dit første afspark.</li>';
    const latest=match.events[0];
    put('ticker',latest?latest.minute+'′  ·  '+latest.text:'Bolden ligger på midterpletten');
    if(latest?.kind==='goal'&&renderedEvent>=0){
      const sheet=container.querySelector('.match-sheet');
      sheet.classList.remove('goal-flash');
      requestAnimationFrame(()=>{if(sheet.isConnected)sheet.classList.add('goal-flash');});
      sheet.animate?.([{boxShadow:'inset 0 0 0 4px #ffd475'},{boxShadow:'inset 0 0 0 0 transparent'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:750});
    }
    renderedEvent=match.eventId;
  }
}
function stop(){cancelAnimationFrame(presentationFrame);presentationFrame=0;controls?.reset();paused=true;loop?.reset();cancelAnimationFrame(frame);frame=0;}
function expandMatch(expanded){
  const sheet=container.querySelector('.match-sheet'),button=container.querySelector('[data-action="expand"]');
  if(!sheet||!button)return;
  if(match.phase===PHASE.FULL_TIME){expanded=false;button.disabled=true;}
  sheet.classList.toggle('match-expanded',expanded);
  sheet.classList.remove('desk-open');
  sheet.querySelector('.broadcast-menu').setAttribute('aria-expanded','false');
  document.body.classList.toggle('match-on-top',expanded);
  button.textContent=expanded?'Luk udvidet':'Udvid';
  button.setAttribute('aria-pressed',String(expanded));
}
function drawPitch(previous,alpha=1,running=false){
  if(arena&&arenaMode!=='2d')arena.render(match,previous,alpha,running,arenaMode,speed,manual?(controls?.state.slot??-1):-1);
  else pitch.render(match,previous,alpha,manual?(controls?.state.slot??-1):-1);
}
function showCamera(mode){
  if(view!=='match')return;
  arenaMode=mode;
  const canvas=document.querySelector('#pitch'),gl=document.querySelector('#pitch3d');
  const ready=arena&&mode!=='2d';
  canvas.hidden=!!ready;gl.hidden=!ready;
  for(const button of container.querySelectorAll('[data-camera]')){
    button.setAttribute('aria-pressed',String(button.dataset.camera===(ready?mode:'2d')));
  }
  if(ready){arena.layout();drawPitch(null);put('arena-status','');return;}
  pitch.layout();drawPitch(null);
  if(mode==='2d'){put('arena-status','');return;}
  put('arena-status','Stadionet gøres klar…');
  if(arenaLoading)return;
  arenaLoading=true;
  const token=arenaToken;
  import('../assets/arena.js').then(module=>module.createArena(gl)).then(result=>{
    if(token!==arenaToken){result.dispose();return;}
    arena=result;arenaLoading=false;showCamera(arenaMode);
  }).catch(()=>{
    if(token!==arenaToken)return;
    arenaLoading=false;showCamera('2d');
    put('arena-status','3D kunne ikke åbnes. Taktisk visning er aktiv.');
  });
}
function render(){
  stop();controls?.dispose();controls=null;radar=null;observer?.disconnect();
  document.body.classList.remove('match-on-top');
  arenaToken++;arenaLoading=false;
  arena?.dispose();arena=null;
  renderedEvent=-1;renderedStats='';renderedPhase='';
  if(view==='match')prepare();
  const content=({overview,match:matchMarkup,tactics:tactical,squad,club:clubView,scenarios:scenarioMenu})[view]();
  const tabs=scenario?[['scenarios','Til situationer'],['match','Kamp'],['tactics','Taktik'],['squad','Trup']]:nav;
  const active=view==='overview'||view==='scenarios'&&!scenario?'match':view;
  container.dataset.view=view;
  container.innerHTML=`<nav class="app-nav" aria-label="Klubmenu">${tabs.map(([id,label])=>{
    const href=id==='match'&&!match?'overview':id;
    return `<a href="#${href}" ${id===active?'aria-current="page"':''}>${label}</a>`;
  }).join('')}</nav><div class="cockpit-screen" tabindex="-1">${scenario?`<div class="scenario-context"><b>${scenario.title}</b> · ${scenario.target}</div>`:''}${content}</div>`;
  if(view==='club'&&document.getElementById('legacy-entry')){
    container.querySelector('.cockpit-screen').append(document.getElementById('legacy-entry').content.cloneNode(true));
  }
  if(view==='match'){
    const canvas=document.querySelector('#pitch');
    if(manual){
      controls=bindControls(container,()=>!paused&&!container.querySelector('dialog[open]')&&(match.phase===PHASE.PLAYING||playerRestart(match)));
      radar=matchRadar(container.querySelector('#mini-pitch'));
    }
    pitch=pitchView(canvas);
    const layout=()=>{
      if(arena&&arenaMode!=='2d'){if(arena.layout())drawPitch(null);}
      else if(pitch.layout())drawPitch(null);
    };
    if(typeof ResizeObserver==='function'){observer=new ResizeObserver(layout);observer.observe(canvas.parentElement);}
    document.querySelector('#pitch3d').addEventListener('webglcontextlost',event=>{
      event.preventDefault();arena?.dispose();arena=null;showCamera('2d');
      put('arena-status','3D-forbindelsen blev afbrudt. Taktisk visning er aktiv.');
    });
    showCamera(arenaMode);
    paintHUD();
  }
}
function go(next){
  if(scenario&&!['match','tactics','squad'].includes(next)){scenario=null;match=club.active;manual=match?.controlMode!=='simulation';arenaMode='2d';speed=1;}
  notice='';view=next;
  if(!demo)history.replaceState(null,'','#'+(scenario?'scenarios':next));
  render();save();
}
function onFrame(now){
  const input=manual?controls.sample(arenaMode==='2d'?null:arena):null;
  const alpha=loop.advance(now,speed,input);
  drawPitch(loop.previous,alpha,true);
  if(now-lastPaint>145){paintHUD();lastPaint=now;}
  const latest=match.events[0];
  if(latest?.id>lastEvent){
    lastEvent=latest.id;
    if(['goal','half','full'].includes(latest.kind))audio.whistle(latest.kind);
  }
  if(now-savedTime>4000){save();savedTime=now;}
  if(match.phase===PHASE.PLAYING||match.phase===PHASE.DEAD_BALL){frame=requestAnimationFrame(onFrame);return;}
  stop();save();paintHUD();
  if(match.events[0]?.kind==='goal'&&arena&&arenaMode!=='2d'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const until=now+1000;
    const ripple=time=>{drawPitch(null);if(time<until)presentationFrame=requestAnimationFrame(ripple);};
    presentationFrame=requestAnimationFrame(ripple);
  }
  if(match.phase===PHASE.FULL_TIME){expandMatch(false);document.querySelector('#match-report').innerHTML=reportMarkup();}
}
function start(){
  if(paused||!frame){cancelAnimationFrame(presentationFrame);paused=false;loop.reset();frame=requestAnimationFrame(onFrame);}
  paintHUD();
}
container.addEventListener('click',event=>{
  const button=event.target.closest('button');
  const link=event.target.closest('.app-nav a');
  if(link){event.preventDefault();go(link.hash.slice(1));return;}
  if(!button)return;
  if(button.dataset.mode){
    if(button.dataset.scenario){
      scenario=SCENARIOS.find(item=>item.id===button.dataset.scenario);
      if(!scenario)return;
      match=scenarioMatch(scenario);
    }else if(!match)match=nextMatch(club);
    match.controlMode=button.dataset.mode;
    manual=match.controlMode==='manual';
    speed=1;arenaMode=manual?'tv':'2d';
    go('match');
    if(manual&&matchMedia('(orientation:landscape)').matches)expandMatch(true);
    return;
  }
  if(button.dataset.camera){showCamera(button.dataset.camera);return;}
  if(button.dataset.speed&&!manual){
    speed=Number(button.dataset.speed);
    for(const item of container.querySelectorAll('[data-speed]'))item.setAttribute('aria-pressed',String(Number(item.dataset.speed)===speed));
    return;
  }
  const action=button.dataset.action;
  if(action==='stats'){container.querySelector('#match-data').showModal();return;}
  if(action==='quick-sub'){
    const sheet=container.querySelector('#quick-change');
    controls?.reset();
    sheet.querySelector('.subs')?.remove();
    const template=document.createElement('template');template.innerHTML=squad();
    sheet.append(template.content.querySelector('.subs'));
    const form=sheet.querySelector('#subs');
    form.elements.slot.value=String(match.teams[0].players.find(p=>p.slot>0&&!p.red)?.slot??0);
    const compatible=()=>{
      const goal=Number(form.elements.slot.value)===0;
      const reserves=match.teams[0].bench.filter(p=>(p.role==='MÅL')===goal);
      form.elements.bench.replaceChildren(...reserves.map(p=>new Option(p.name+' · '+p.role,p.id)));
      form.querySelector('button').disabled=!reserves.length||match.teams[0].subs>=5||match.phase===PHASE.FULL_TIME;
    };
    form.elements.slot.onchange=compatible;compatible();sheet.showModal();return;
  }
  if(action==='broadcast-menu'){
    const open=button.closest('.match-sheet').classList.toggle('desk-open');
    button.setAttribute('aria-expanded',String(open));
  }else if(action==='expand'){
    expandMatch(button.getAttribute('aria-pressed')!=='true');
  }else if(action==='play'){
    if(kickOff(match)){
      lastEvent=match.eventId;void audio.enable(club.sound).then(()=>audio.whistle('kickoff'));
      save();start();
    }else if(paused)start();
    else{stop();save();paintHUD();}
  }else if(action==='sound'){
    club.sound=!club.sound;void audio.enable(club.sound);
    button.textContent=club.sound?'Lyd til':'Lyd fra';button.setAttribute('aria-pressed',String(club.sound));save();
  }
  else if(['overview','match','tactics','squad','scenarios'].includes(action)){go(action);}
  else if(action==='settle'){
    if(scenario){match=scenarioMatch(scenario);go('match');return;}
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
    if(!demo&&!scenario)club.formation=match.teams[0].formation;
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
    if(!demo&&!scenario&&match.phase===PHASE.PRE_KICKOFF){
      const rosterById=new Map(club.roster.map(p=>[p.id,p]));
      const team=match.teams[0];
      club.roster=[...team.players,...team.bench].map(p=>rosterById.get(p.id));
    }
    save();
  }
  if(view==='match'){
    if(changed){container.querySelector('#quick-change').close();paintHUD();}
    else put('notice',notice);
  }else render();
});
bindSwipe(container,delta=>{
  if(document.querySelector('dialog[open]')||document.body.classList.contains('match-on-top'))return;
  const links=[...container.querySelectorAll('.app-nav a')];
  const current=links.findIndex(link=>link.hasAttribute('aria-current'));
  if(links[current+delta])go(links[current+delta].hash.slice(1));
},'.arena,.tactic-board');
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();save();if(view==='match')paintHUD();}});
window.addEventListener('pagehide',()=>{stop();save();});
window.addEventListener('hashchange',()=>{if(!demo&&view!==initialView())go(initialView());});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!document.querySelector('dialog[open]')&&document.body.classList.contains('match-on-top')){
    expandMatch(false);container.querySelector('[data-action="expand"]')?.focus();
  }
});
render();
