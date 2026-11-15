import React,{useEffect,useRef,useState}from'react';
import{X,ArrowUpRight,Camera,RotateCcw,Settings2,Smartphone,MoveUpRight}from'lucide-react';
import{playingTime,PLAY_MS}from'../shared/football-halves.js';
import{matchResolutionLabel}from'./match-quality.js';
import{createMatchFramePacer}from'./match-frame-pacer.js';
import{matchRenderBudget}from'./match-render-budget.js';
import{createIdleMatchSave}from'./match-scheduling.js';
import{CLUB_COLORS,ClubBadge}from'./ClubStudio.jsx';
import{createManualSession}from'./manual-session.js';
import{localMatchStorage,readMatchPreferences,saveMatchPreferences,matchControlMask,isMatchShortcut}from'./manual-preferences.js';
import{enterMatchDisplay,exitMatchDisplay}from'./match-display.js';
import{saveManualRecording,manualRetryDelay}from'./manual-save.js';
import{commandForTactic,commandForFormation}from'../shared/football-tactics.js';
import{createGoalReplayBuffer,replayFrame}from'./goal-replay.js';
import MatchStatistics from'./MatchStatistics.jsx';
import GoalMoment from'./GoalMoment.jsx';
import{goalInputLocked,goalHudState}from'./goal-hud.js';

export default function ManualMatch({match,club,clubStyle,now,live=true,onClose,onFinish,busy}){
 const version=match.manual?.version||match.manual?.config.matchVersion||1,modern=version>=3,duration=(match.manual?.duration||60000)/1000;
 const[preferences]=useState(()=>readMatchPreferences(undefined,version));
 const canvas=useRef(null),sceneRef=useRef(null),dialog=useRef(null),session=useRef(null),controls=useRef({x:0,y:0,shoot:false,pass:false,sprint:false}),keys=useRef(new Set()),camera=useRef(preferences.view),thumb=useRef(null),clock=useRef({now,at:0}),sending=useRef(false);
 const settingsButton=useRef(null),settingsPanel=useRef(null),helpPanel=useRef(null),rotatePanel=useRef(null),inputBlocked=useRef(false),overlayState=useRef({});
 const commands=useRef([]),saveWork=useRef(null),replays=useRef(null);if(!replays.current)replays.current=createGoalReplayBuffer();
 const[clips,setClips]=useState([]),[replayClip,setReplayClip]=useState(null),[replayRun,setReplayRun]=useState(0);
 const[resolution,setResolution]=useState(null),[frameStats,setFrameStats]=useState(null),[saveState,setSaveState]=useState({phase:'idle',attempt:0,retryAt:0});
 const[view,setView]=useState(preferences.view),[quality,setQuality]=useState(preferences.quality),[mode,setMode]=useState('3d'),[sceneLoading,setSceneLoading]=useState(live),[hud,setHud]=useState({home:0,away:0,seconds:duration,energy:100,radar:[],controlled:0,ball:{x:0,y:0},possession:'home'}),[showField]=useState(live),[complete,setComplete]=useState(false),[error,setError]=useState(''),[goal,setGoal]=useState(''),[help,setHelp]=useState(false),[settingsOpen,setSettingsOpen]=useState(false);
 const[portrait,setPortrait]=useState(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(orientation: portrait)').matches);
 const goalPhase=hud.goalMoment?.stage||null,halftime=hud.pause>0,blocked=portrait||settingsOpen||help||sceneLoading||halftime||complete||!!goalPhase;
 inputBlocked.current=blocked;
 overlayState.current={portrait,settingsOpen,help,replay:!!replayClip};
 const resetControls=()=>{keys.current.clear();controls.current={x:0,y:0,shoot:false,pass:false,sprint:false};if(thumb.current)thumb.current.style.transform='translate(0px,0px)';};
 useEffect(()=>{saveMatchPreferences({view,quality},undefined,version);},[view,quality]);
 const previousScore=useRef({home:0,away:0});
 useEffect(()=>{const previous=previousScore.current;previousScore.current={home:hud.home,away:hud.away};if(version>=10||hud.home===previous.home&&hud.away===previous.away)return;setGoal(hud.home>previous.home?'MÅL!':'Mål til modstanderen');const timer=setTimeout(()=>setGoal(''),1800);return()=>clearTimeout(timer);},[hud.home,hud.away]);
 const full=match.manual?.config.matchVersion>=2;
 const gameClock=Math.max(0,Math.min(5400,Math.floor(version>=6?playingTime((duration-hud.seconds)*1000)/PLAY_MS*5400:(60-hud.seconds)*90))),formattedClock=String(Math.floor(gameClock/60)).padStart(2,'0')+':'+String(gameClock%60).padStart(2,'0');
 const actionDown=kind=>{if(inputBlocked.current)return;const s=session.current?.state,owns=s?.ball.owner?.team==='home'&&s.ball.owner.index===s.controlled;if(modern&&owns)controls.current[kind+'Held']=true;else controls.current[kind]=true;};
 const actionUp=(kind,cancel=false)=>{if(!inputBlocked.current&&controls.current[kind+'Held']&&!cancel)controls.current[kind]=true;controls.current[kind+'Held']=false;};
 const personal=!!match.manual?.config.personalPosition,keeper=match.manual?.config.personalPosition==='MÅL',passLabel=version>=5?(hud.owns?'Aflever':personal?'Kald':'Skift'):personal?'Aflever / kald':'Aflever / skift';
 useEffect(()=>{clock.current={now,at:performance.now()};},[now]);
 const time=()=>clock.current.now+performance.now()-clock.current.at;
 useEffect(()=>{if(!showField)return;void enterMatchDisplay().catch(()=>{});return()=>{void exitMatchDisplay().catch(()=>{});};},[match.id,showField]);
 useEffect(()=>{
  const media=window.matchMedia?.('(orientation: portrait)');
  const update=()=>{const next=media?media.matches:window.innerHeight>window.innerWidth;resetControls();setPortrait(next);if(next){setSettingsOpen(false);setHelp(false);}};
  update();media?.addEventListener?.('change',update);window.addEventListener('resize',update);
  return()=>{media?.removeEventListener?.('change',update);window.removeEventListener('resize',update);};
 },[match.id]);
 useEffect(()=>{
  resetControls();
  if(portrait&&showField)rotatePanel.current?.focus();
  else if(help)helpPanel.current?.querySelector('button')?.focus();
  else if(settingsOpen)settingsPanel.current?.querySelector('button')?.focus();
 },[portrait,settingsOpen,help,sceneLoading,halftime,complete,goalPhase]);
 const closeSettings=()=>{setSettingsOpen(false);setHelp(false);settingsButton.current?.focus();};
 useEffect(()=>{
  const prior=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.focus();
  const reset=()=>{resetControls();if(saveWork.current)saveWork.current.flush();else session.current?.save();};
  const back=e=>{e.preventDefault();const ui=overlayState.current;if(ui.replay){setReplayClip(null);}else if(ui.help){setHelp(false);}else if(ui.settingsOpen){setSettingsOpen(false);settingsButton.current?.focus();}else onClose();};
  const down=e=>{
   if(e.key==='Escape'){e.preventDefault();back(e);return;}
   if(e.key==='Tab'){
    const ui=overlayState.current,root=ui.portrait&&showField?rotatePanel.current:ui.help?helpPanel.current:ui.settingsOpen?settingsPanel.current:dialog.current;
    const all=[...root.querySelectorAll('button:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=all[0],last=all.at(-1);
    if(!all.length){e.preventDefault();root.focus();}else if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement)||document.activeElement===root)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first.focus();}
    return;
   }
   if(inputBlocked.current)return;
   if(isMatchShortcut(e)&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Shift','w','a','s','d','e','W','A','S','D','E','q','Q','r','R'].includes(e.key)){e.preventDefault();keys.current.add(e.key.toLowerCase());if(!e.repeat&&e.key===' ')actionDown('shoot');if(!e.repeat&&e.key.toLowerCase()==='e')actionDown('pass');}
   if(version>=4&&!e.repeat&&e.key.toLowerCase()==='q'&&isMatchShortcut(e)){e.preventDefault();controls.current.skill=true;}
   if(version>=5&&!e.repeat&&e.key.toLowerCase()==='r'&&isMatchShortcut(e)){e.preventDefault();controls.current.through=true;}
  };
  const up=e=>{keys.current.delete(e.key.toLowerCase());if(e.key===' ')actionUp('shoot');if(e.key.toLowerCase()==='e')actionUp('pass');};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);window.addEventListener('touchline:back',back);
  return()=>{reset();document.body.style.overflow=overflow;window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);window.removeEventListener('touchline:back',back);prior?.focus();};
 },[match.id]);
 useEffect(()=>{
  if(!match.manual||!showField)return;
  let disposed=false,raf=0,lastHud=0,lastSave=0,lastHudCount=-1,lastSavedCount=-1,lastGoalPhase=null,lastGoalTick=null,scene;
  const host=canvas.current,drawDue=createMatchFramePacer(matchRenderBudget(version,quality).targetFps||30),saves=createIdleMatchSave({save:()=>session.current?.save()});saveWork.current=saves;
  const lost=e=>{e.preventDefault();setQuality('simple');};
  setSceneLoading(true);setError('');setResolution(null);setFrameStats(null);
  const start=async()=>{
   try{
    session.current||=createManualSession(match,{storage:localMatchStorage(),now:time()});
    const {createMatchScene,prepareMatchSceneAssets}=await import('./manual-scene.js');
    await prepareMatchSceneAssets({version,quality});
    if(disposed)return;
    scene=createMatchScene(host,{version,quality,initialState:session.current.state,getMatchTime:()=>time()-match.started,onPerformance:r=>{if(!disposed)setFrameStats(r);},onResolution:r=>{if(!disposed)setResolution(r);},pattern:clubStyle?.pattern,stage:match.manual.config.stadiumStage??2,field:session.current.state.field,players:session.current.state.home.length,color:CLUB_COLORS[clubStyle?.color||'lime']});sceneRef.current=scene;
    setMode(scene.mode);if(scene.mode==='simple'&&quality!=='simple')setQuality('simple');setSceneLoading(false);host.addEventListener('webglcontextlost',lost,true);
    const frame=t=>{
     if(disposed)return;
     const s=session.current,c=controls.current,command=version>=8&&!overlayState.current.portrait&&!overlayState.current.help?commands.current[0]:null,mask=command??(inputBlocked.current||goalInputLocked(s.state)?0:matchControlMask(keys.current,c,scene.mode==='3d'?camera.current:'stadium',version)),before=s.count;
     if(live)s.advance(time(),document.hidden?0:mask);
     if(s.count>before&&command&&!document.hidden)commands.current.shift();
     const nextGoalPhase=s.state.goalSequence?.stage||null,nextGoalTick=s.state.lastGoal?.tick??null,goalChanged=nextGoalPhase!==lastGoalPhase||nextGoalTick!==lastGoalTick;
     if(goalChanged)resetControls();
     lastGoalPhase=nextGoalPhase;lastGoalTick=nextGoalTick;
     if(replays.current.capture(s.state))setClips([...replays.current.clips]);
     if(s.complete&&replays.current.finish(s.state))setClips([...replays.current.clips]);
     if(s.count>before){c.shoot=false;c.pass=false;c.skill=false;c.through=false;}
     if(s.count!==lastHudCount&&(t-lastHud>180||s.complete||goalChanged)){
      setHud({home:s.state.homeScore,away:s.state.awayScore,goalMoment:goalHudState(s.state),stats:{...s.state.stats},tactic:s.state.tactic,formation:s.state.formation,seconds:Math.max(0,duration-s.count*s.inputMs/1000),energy:s.state.home[s.state.controlled].energy,charge:Math.max(s.state.shotCharge||0,s.state.passCharge||0)/18,half:s.state.half||1,pause:s.state.intermissionRemaining||0,skillCooldown:s.state.skillCooldown||0,chargeKind:s.state.passCharge>0?'Løftet aflevering':'Skudkraft',restart:s.state.restart&&s.state.tick-s.state.restart.tick<22?s.state.restart.kind:null,controlled:s.state.controlled,radar:['home','away'].flatMap(team=>s.state[team].map((p,i)=>({x:p.x,y:p.y,team,active:team==='home'&&i===s.state.controlled}))),ball:{x:s.state.ball.x,y:s.state.ball.y},possession:s.state.ball.owner?.team,owns:s.state.ball.owner?.team==='home'&&s.state.ball.owner.index===s.state.controlled});
      setComplete(s.complete);lastHud=t;lastHudCount=s.count;
     }
     if(s.count!==lastSavedCount&&(t-lastSave>1500||s.complete)){if(s.complete)saves.flush();else saves.request();lastSave=t;lastSavedCount=s.count;}
     if(!document.hidden&&!overlayState.current.replay&&drawDue(t,s.complete)){scene.render(s.state,camera.current,s.complete);}
     if(live&&!s.complete)raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
   }catch(e){if(!disposed){setSceneLoading(false);setError(e.message||'Kampvisningen kunne ikke åbnes. Prøv enkel grafik.');}}
  };
  start();
  return()=>{disposed=true;cancelAnimationFrame(raf);saves.flush();saves.dispose();if(saveWork.current===saves)saveWork.current=null;host?.removeEventListener('webglcontextlost',lost,true);if(sceneRef.current===scene)sceneRef.current=null;scene?.dispose();};
 },[match.id,quality,live]);
 const submit=async(manual=false)=>{
  if(sending.current||busy||!live||!session.current?.complete)return;
  sending.current=true;setError('');const attempt=(manual?0:saveState.attempt)+1;setSaveState({phase:'sending',attempt,retryAt:0});
  try{await saveManualRecording({session:session.current,finish:onFinish,matchId:match.id,personal});setSaveState({phase:'saved',attempt,retryAt:0});}
  catch(e){const retryable=e.retryable!==false&&(!e.status||![400,401,403,404,413].includes(e.status)||e.retryable===true),retry=retryable&&attempt<6;setError(e.message||'Forbindelsen blev afbrudt. Prøv igen.');setSaveState({phase:retry?'retry':'failed',attempt,retryAt:retry?Date.now()+manualRetryDelay(attempt):0,retryable});}
  finally{sending.current=false;}
 };
 useEffect(()=>{
  if(!complete||!live||busy||!['idle','retry'].includes(saveState.phase))return;
  const timer=setTimeout(()=>{void submit();},saveState.phase==='retry'?Math.max(0,saveState.retryAt-Date.now()):0);
  return()=>clearTimeout(timer);
 },[complete,live,busy,saveState.phase,saveState.retryAt]);
 useEffect(()=>{const retry=()=>{if(!document.hidden&&complete&&live&&saveState.retryable)setSaveState({phase:'idle',attempt:0,retryAt:0});};window.addEventListener('online',retry);document.addEventListener('visibilitychange',retry);return()=>{window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);};},[complete,live,saveState.retryable]);
 useEffect(()=>{if(replayClip)dialog.current?.querySelector('.match-replay-controls button')?.focus();},[replayClip]);
 useEffect(()=>{
  if(!replayClip||sceneLoading)return;let raf=0,origin=0,stopped=false;const due=createMatchFramePacer(matchRenderBudget(version,quality).targetFps||30);
  const play=t=>{if(stopped)return;if(!origin)origin=t;const elapsed=Math.min(replayClip.durationMs,t-origin),frame=replayFrame(replayClip,elapsed);if(frame&&due(t))sceneRef.current?.render(frame,camera.current,true);if(elapsed<replayClip.durationMs)raf=requestAnimationFrame(play);};
  raf=requestAnimationFrame(play);return()=>{stopped=true;cancelAnimationFrame(raf);if(session.current)sceneRef.current?.render(session.current.state,camera.current,true);};
 },[replayClip,replayRun,sceneLoading,quality]);
 const chooseTactic=command=>{if(!command||!live||complete)return;commands.current.push(command);};
 const gameStats=live?hud.stats:match.manualStats||hud.stats;
 const joystick=e=>{if(inputBlocked.current)return;const r=e.currentTarget.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.36),dy=(e.clientY-r.top-r.height/2)/(r.height*.36),len=Math.max(1,Math.hypot(dx,dy));controls.current.x=dx/len;controls.current.y=dy/len;if(thumb.current)thumb.current.style.transform=`translate(${dx/len*30}px,${dy/len*30}px)`;};
 const release=()=>{controls.current.x=0;controls.current.y=0;if(thumb.current)thumb.current.style.transform='translate(0px,0px)';};
 const changeCamera=()=>{camera.current=(modern?{pro:'follow',follow:'broadcast',broadcast:'stadium',stadium:'pro'}:{follow:'broadcast',broadcast:'stadium',stadium:'follow'})[view];setView(camera.current);if(session.current?.complete)sceneRef.current?.render(session.current.state,camera.current,true);};
 const radarScale=full?1:1.5;
 return <div className="manual-backdrop game-match-backdrop"><section ref={dialog} tabIndex={-1} className="manual-match game-match" style={{'--match-home-color':CLUB_COLORS[clubStyle?.color||'lime']}} data-replay={!!replayClip} data-modern={modern} data-skills={version>=4} data-through={version>=5} data-live={live&&!complete} data-active={showField} data-portrait={portrait} data-input-blocked={blocked} data-goal-stage={goalPhase||undefined} role="dialog" aria-modal="true" aria-labelledby="manual-title">
  <header className="game-match-header"><div className="manual-title-block"><span className="eyebrow">SPIL SELV · {full?'11 MOD 11':'5 MOD 5'}</span><h2 id="manual-title">{personal?'Din plads på banen':'Kampdag'}</h2></div><div className="manual-header-actions">{showField&&<button ref={settingsButton} onClick={()=>{resetControls();setSettingsOpen(!settingsOpen);setHelp(false);}} aria-label="Kampindstillinger" aria-controls="manual-settings" aria-expanded={settingsOpen}><Settings2 size={19}/></button>}<button onClick={onClose} aria-label="Luk kampvisning"><X size={21}/></button></div></header>
  <div className="manual-score" aria-live="off"><span title={club}><ClubBadge style={clubStyle} name={club} size={26}/><em className="score-team-name">{club}</em></span><b>{replayClip?replayClip.homeScore:live?hud.home:match.home} : {replayClip?replayClip.awayScore:live?hud.away:match.away}</b><span title={match.opponent}><em className="score-team-name">{match.opponent}</em><ClubBadge style={{color:clubStyle?.color==='orange'?'blue':'orange',crest:'round'}} name={match.opponent} size={26}/></span><small>{replayClip?'REPLAY':!live?'SLUT':complete?'SLUTFLØJT':version>=5?formattedClock:`${Math.min(90,Math.floor((60-hud.seconds)*1.5))}′ · ${Math.ceil(hud.seconds)} SEK.`}</small></div>
  {showField&&<div className="manual-viewport"><div className="manual-field" ref={canvas} tabIndex={blocked?-1:0} onPointerDown={event=>{if(!inputBlocked.current)event.currentTarget.focus();}} aria-disabled={blocked} aria-label={mode==='3d'?'Spilbar 3D-fodboldbane':'Spilbar bane med enkel grafik'}/><div className="manual-radar-wrap"><svg className="manual-radar" viewBox="0 0 108 70" role="img" aria-label="Minikort over spillere og bold"><rect x="4" y="4" width="100" height="62" rx="1"/><path d="M54 4v62M4 20h15v30H4M104 20H89v30h15M4 27h6v16H4M104 27h-6v16h6"/><circle cx="54" cy="35" r="8" className="radar-circle"/>{hud.radar.map((p,i)=><circle key={i} cx={54-p.y*radarScale} cy={35+p.x*radarScale} r={p.active?2.2:1.6} className={p.active?'active':p.team}/>)}<circle cx={54-hud.ball.y*radarScale} cy={35+hud.ball.x*radarScale} r="1.7" className="ball"/></svg></div><div className="manual-player-indicator"><i aria-hidden="true"/><span>{personal?'Din spiller':`Spiller ${hud.controlled+1}`}<small>{hud.possession==='home'?'I boldbesiddelse':hud.possession==='away'?'Forsvar':'Fri bold'}</small></span><b aria-hidden="true">{String(hud.controlled+1).padStart(2,'0')}</b><progress value={hud.energy} max="100" aria-label="Spillerens energi"/></div></div>}
  {modern&&live&&!complete&&hud.charge>0&&<div className="manual-power" role="status"><span>{hud.chargeKind}</span><progress value={hud.charge} max="1" aria-label={hud.chargeKind}/><small>Slip knappen</small></div>}
  {modern&&live&&hud.restart&&<div className="manual-restart" role="status">{{'throw-in':'INDKAST',corner:'HJØRNESPARK','goal-kick':'MÅLSPARK'}[hud.restart]}</div>}
  {sceneLoading&&showField&&<p className="manual-loading" role="status"><i aria-hidden="true"/>Banen gøres klar…</p>}
  {showField&&<><div className="manual-menu-scrim" hidden={!settingsOpen} onClick={closeSettings}/><div id="manual-settings" ref={settingsPanel} tabIndex={-1} className="manual-settings" hidden={!settingsOpen||help} role="dialog" aria-modal={settingsOpen?true:undefined} aria-labelledby="manual-settings-title"><div className="manual-panel-heading"><div><span className="eyebrow">KAMPVISNING</span><h3 id="manual-settings-title">Indstillinger</h3></div><button onClick={closeSettings} aria-label="Luk kampindstillinger"><X size={19}/></button></div><div className="manual-toolbar"><label><span>Kamera</span><button disabled={mode==='simple'} onClick={changeCamera} aria-label="Skift kampkamera"><Camera size={18}/>{view==='pro'?'TV Pro':view==='broadcast'?'TV-kamera':view==='follow'?'Nærkamera':'Hele banen'}<RotateCcw size={14}/></button></label><label><span>Grafik</span><select aria-label="Grafikkvalitet" value={quality} onChange={e=>setQuality(e.target.value)}><option value="auto">Automatisk 3D</option><option value="sharp">Skarp 3D</option><option value="4k">4K · Ultra</option><option value="simple">Enkel</option></select></label><button className="manual-help-toggle" onClick={()=>setHelp(true)} aria-expanded={help}>Styring og kampregler<ArrowUpRight size={18}/></button></div>{version>=8&&live&&!complete&&<section className="match-tactics" aria-label="Kampplan"><h4>Din kampplan</h4><p>Kampuret fortsætter. Valgene gælder denne kamp.</p><div className="match-tactic-options">{[['balanced','Balanceret'],['attacking','Offensiv'],['defensive','Defensiv']].map(([key,label])=><button type="button" key={key} aria-pressed={(hud.tactic||match.manual.config.tactic||'balanced')===key} onClick={()=>chooseTactic(commandForTactic(key))}>{label}</button>)}</div><label>Formation<select aria-label="Skift formation under kampen" value={hud.formation||match.manual.config.formation||'4-3-3'} onChange={e=>chooseTactic(commandForFormation(e.target.value))}>{['4-3-3','4-4-2','3-5-2','4-5-1'].map(shape=><option key={shape}>{shape}</option>)}</select></label><small>Aktiv plan: {{balanced:'Balanceret',attacking:'Offensiv',defensive:'Defensiv'}[hud.tactic||match.manual.config.tactic||'balanced']} · {hud.formation||match.manual.config.formation||'4-3-3'}</small></section>}{gameStats&&<details className="match-live-statistics"><summary>Kampstatistik</summary><MatchStatistics stats={gameStats} club={club} opponent={match.opponent} personal={personal}/></details>}{resolution&&<p className="manual-render-status" role="status">{matchResolutionLabel(resolution)}{frameStats&&<span aria-live="off"> · {frameStats.fps} FPS</span>}</p>}<p className="manual-menu-clock">Kampuret fortsætter, mens menuen er åben.</p><button className="manual-return" onClick={closeSettings}>Tilbage på banen<ArrowUpRight size={17}/></button></div></>}
  {version>=6&&hud.pause>0&&live&&<div className="manual-halftime" role="status"><b>PAUSE · 45:00</b><span>Anden halvleg starter om {Math.ceil(hud.pause/1000)} sek.</span><small>Hver halvleg varer to minutter.</small>{version>=8&&<button className="match-half-plan" onClick={()=>setSettingsOpen(true)}>Tilpas kampplan</button>}</div>}
  {version>=10&&live&&!complete&&!halftime&&!settingsOpen&&!help&&!replayClip&&<GoalMoment goal={hud.goalMoment} home={hud.home} away={hud.away} club={club} opponent={match.opponent}/>}
  {goal&&live&&<div className="manual-goal" role="status"><span>{goal}</span><b>{hud.home} – {hud.away}</b></div>}
  <div ref={helpPanel} tabIndex={-1} className="manual-help" hidden={!help} role="dialog" aria-modal={help?true:undefined} aria-labelledby="manual-help-title"><div className="manual-panel-heading"><div><span className="eyebrow">SPIL SELV</span><h3 id="manual-help-title">Tag kontrollen</h3></div><button onClick={()=>setHelp(false)} aria-label="Tilbage til kampindstillinger"><X size={19}/></button></div><p>{['broadcast','pro'].includes(view)&&mode==='3d'?'Angrib mod højre.':'Angrib mod det øverste mål.'} Bevæg dig med cirklen til venstre. A skyder med bolden og tackler uden bolden. B afleverer eller skifter spiller. Hold C nede for at sprinte. Sprint bruger energi. {version>=4?'Finte sender spilleren forbi sin modstander, bruger energi og har fem sekunders nedkøling.':''} {version>=5?'Stikning spiller bolden frem i en medspillers løbebane.':''}</p><p>{personal?'Du styrer kun din egen spiller. B kalder på bolden, når en medspiller har den.':'Medspillerne finder selv plads. B skifter til den nærmeste spiller, når du ikke har bolden.'} {keeper?'Som målmand bruger du A til at kaste dig.':''} {full?'Der er elleve spillere på hvert hold. Din formation og taktik følger med på banen.':'Denne tidligere kamp bruger fem pladser.'}</p><p>Tastatur: WASD/piletaster, mellemrum til A, E til B, Shift til C. {version>=4?'Q til finte. ':''}{version>=5?'R til en stikning i dybden. ':''}{version>=6?'Kampen har to halvlege på hver 2 minutter og en pause på 10 sekunder.':'Kampen er en forenklet kamp på 60 sekunder,'} {modern?'uden offside.':'uden offside og indkast.'} {modern?'Hold A og slip for at dosere skuddet. Hold B og slip for en løftet aflevering. Indkast, hjørnespark og målspark sættes automatisk op. ':''}Kampuret fortsætter også, mens styringen er åben, eller hvis du lukker visningen. Resultatet forsøges gemt automatisk. Ved afbrudt forbindelse kan optagelsen afleveres inden for {version>=6?'24 timer':'tre minutter'} efter slutfløjt.</p><p>Skarp 3D holder en høj, fast opløsning og prioriterer modeldetaljer tæt på bolden. 4K renderer op til 3840 pixels på den lange led, hvis enheden understøtter det. Automatisk tilpasser opløsningen og hæver den igen, når der er overskud.</p>{mode==='simple'&&<p>Enkel grafik er aktiv. Styring og resultat fungerer på samme måde.</p>}<button className="manual-return" onClick={closeSettings}>Tilbage på banen<ArrowUpRight size={16}/></button></div>
  {live&&!complete&&<p className="manual-direction"><MoveUpRight size={13} aria-hidden="true"/>{['broadcast','pro'].includes(view)&&mode==='3d'?'Angrib mod højre →':'Angrib mod det øverste mål ↑'}</p>}
  {live&&!complete&&<div className="manual-controls" aria-hidden={portrait||settingsOpen||help?true:undefined}><div className="manual-joystick" role="group" aria-label="Bevæg spiller med berøring eller tastatur" onPointerDown={e=>{if(inputBlocked.current)return;e.currentTarget.setPointerCapture(e.pointerId);joystick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))joystick(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><i ref={thumb}/><span aria-hidden="true">＋</span></div><div className="manual-actions">{version>=4&&<button className="manual-skill" aria-label="Lav en finte med bolden" disabled={blocked||hud.skillCooldown>0} onPointerDown={e=>{e.preventDefault();if(!inputBlocked.current)controls.current.skill=true;}} onClick={e=>{if(e.detail===0&&!inputBlocked.current)controls.current.skill=true;}}><b className="control-letter" aria-hidden="true">{version>=5?'Q':'D'}</b><span>{hud.skillCooldown>0?`${Math.ceil(hud.skillCooldown/20)} sek.`:'Finte'}</span></button>}{version>=5&&<button className="manual-through" disabled={blocked} aria-label="Spil en stikning i dybden" onPointerDown={e=>{e.preventDefault();if(!inputBlocked.current)controls.current.through=true;}} onClick={e=>{if(e.detail===0&&!inputBlocked.current)controls.current.through=true;}}><b className="control-letter" aria-hidden="true">R</b><span>Stikning</span></button>}<button className="manual-pass" disabled={blocked} aria-label={version>=5?(hud.owns?'Aflever':personal?'Kald på bolden':'Skift til nærmeste spiller'):personal?'Aflever eller kald på bolden':'Aflever eller skift spiller'} onPointerDown={e=>{e.preventDefault();if(inputBlocked.current)return;e.currentTarget.setPointerCapture(e.pointerId);actionDown('pass');}} onPointerUp={()=>actionUp('pass')} onPointerCancel={()=>actionUp('pass',true)} onLostPointerCapture={()=>actionUp('pass',true)} onClick={e=>{if(e.detail===0&&!inputBlocked.current)controls.current.pass=true;}}><b className="control-letter" aria-hidden="true">B</b><span>{passLabel}</span></button><button className="manual-shoot" disabled={blocked} aria-label={keeper?'Skyd eller kast dig':'Skyd eller tackl'} onPointerDown={e=>{e.preventDefault();if(inputBlocked.current)return;e.currentTarget.setPointerCapture(e.pointerId);actionDown('shoot');}} onPointerUp={()=>actionUp('shoot')} onPointerCancel={()=>actionUp('shoot',true)} onLostPointerCapture={()=>actionUp('shoot',true)} onClick={e=>{if(e.detail===0&&!inputBlocked.current)controls.current.shoot=true;}}><b className="control-letter" aria-hidden="true">A</b><span>{version>=5?(hud.possession==='home'?'Skyd':keeper?'Kast dig':'Tackl'):keeper?'Skyd / kast dig':'Skyd / tackl'}</span></button><button className="manual-sprint" disabled={blocked} aria-label="Hold nede for at sprinte" onPointerDown={e=>{if(inputBlocked.current)return;e.currentTarget.setPointerCapture(e.pointerId);controls.current.sprint=true;}} onPointerUp={()=>controls.current.sprint=false} onPointerCancel={()=>controls.current.sprint=false} onLostPointerCapture={()=>controls.current.sprint=false} onKeyDown={e=>{if(!inputBlocked.current&&(e.key===' '||e.key==='Enter'))controls.current.sprint=true;}} onKeyUp={()=>controls.current.sprint=false} onBlur={()=>controls.current.sprint=false}><b className="control-letter" aria-hidden="true">C</b><span>Sprint</span><progress value={hud.energy} max="100" aria-label="Sprintenergi"/></button></div></div>}
  {!replayClip&&(error||complete||!live)&&<div className="game-result-layer">{error&&<p className="manual-error" role="alert">{error}</p>}{complete&&live&&<div className="manual-save"><span className="eyebrow">SLUTFLØJT</span><h3>{hud.home} – {hud.away}</h3><p>{saveState.phase==='sending'?'Gemmer kampen…':saveState.phase==='retry'?'Optagelsen er beholdt. Resultatet forsøges gemt igen automatisk.':saveState.phase==='failed'?'Optagelsen er beholdt på denne enhed. Se fejlen ovenfor, og prøv at gemme igen.':'Slutfløjt. Dit resultat bliver gemt automatisk.'}</p><button className="primary" disabled={busy||saveState.phase==='sending'} onClick={()=>submit(true)}><RotateCcw size={18}/>Gem kampresultat</button></div>}{!live&&<div className="manual-save"><p>{match.forfeited?'Kampen blev ikke gemt inden fristen og er registreret som et 0–3-nederlag uden kampbelønning.':`Resultatet er gemt. ${match.reward??match.salary??0} kr. optjent.`}{match.penalties&&` Straffespark: ${match.penalties.home}–${match.penalties.away}.`}</p><button className="primary" onClick={onClose}>Tilbage til klubben</button></div>}{(complete||!live)&&<div className="match-result-details">{clips.length>0&&<div className="match-replay-list"><h4>Seneste målreplays</h4><p className="match-replay-note">Kan ses, mens denne kampvisning er åben.</p>{clips.map((clip,i)=><button key={clip.id} disabled={sceneLoading} onClick={()=>{setSettingsOpen(false);setReplayClip(clip);}}>{clip.minute}′ · {clip.homeScore}–{clip.awayScore} · {clip.hasGoalFrame?'Målreplay':'Optakt'}</button>)}</div>}<MatchStatistics stats={gameStats} club={club} opponent={match.opponent} personal={personal}/></div>}</div>}
  {replayClip&&<div className="match-replay-controls" role="region" aria-label="Målreplay"><span>REPLAY · {replayClip.minute}′ · {replayClip.homeScore}–{replayClip.awayScore}</span><button onClick={()=>setReplayRun(n=>n+1)}>Se igen</button><button onClick={()=>setReplayClip(null)}>Tilbage til resultat</button></div>}
  {showField&&<div ref={rotatePanel} tabIndex={-1} className="manual-rotate" role="region" aria-labelledby="manual-rotate-title"><div className="manual-rotate-content"><div className="manual-rotate-icon" aria-hidden="true"><Smartphone size={43}/><RotateCcw size={21}/></div><span className="eyebrow">SPIL SELV · LANDSKAB</span><h3 id="manual-rotate-title">Vend skærmen for at spille</h3><p>Drej telefonen for en bredere bane. På computer skal vinduet være bredere end det er højt.</p><small>Kampuret fortsætter, efter kampen er startet.</small><button onClick={onClose}>Tilbage til klubben<ArrowUpRight size={17}/></button></div></div>}
  <footer>{personal?'Én spiller. Dine beslutninger.':'Du styrer holdet. Medspillerne finder plads.'}<span>{full?'11 mod 11':'5 mod 5'} · {version>=6?'2 × 2 minutter':'60 sekunders kamp'}</span></footer>
 </section></div>;
}
