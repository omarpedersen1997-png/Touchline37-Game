// Pointer ownership and feedback are independent of React HUD cadence and ticks.
// They never execute simulation, rewrite recordings or read layout.
export function createInputOwnership(){
 const owners=new Map();
 return {
  claim(kind,id,element){if(owners.has(kind))return false;owners.set(kind,{id,element});if(element)element.dataset.inputDown='true';return true;},
  clear(kind){const owner=owners.get(kind);if(owner?.element)delete owner.element.dataset.inputDown;owners.delete(kind);},
  owns(kind,id){const owner=owners.get(kind);return !!owner&&owner.id===id;},
  release(kind,id){const owner=owners.get(kind);if(!owner||owner.id!==id)return false;if(owner.element)delete owner.element.dataset.inputDown;owners.delete(kind);return true;},
  reset(){for(const owner of owners.values())if(owner.element)delete owner.element.dataset.inputDown;owners.clear();}
 };
}
export function createInputLatencyTracker(){
 const pending=new Map();let count=0,total=0,maximum=0;
 return {
  mark(kind,time){if(Number.isFinite(time)&&!pending.has(kind))pending.set(kind,time);},
  applied(time){if(!Number.isFinite(time))return;for(const at of pending.values()){const age=Math.max(0,time-at);count++;total+=age;maximum=Math.max(maximum,age);}pending.clear();},
  cancel(kind){pending.delete(kind);},
  reset(){pending.clear();},
  report(){return {inputSamples:count,inputMeanMs:count?Math.round(total/count*10)/10:0,inputMaxMs:Math.round(maximum*10)/10};}
 };
}
export function createChargeFeedback(){
 let panel=null,meter=null,label=null,match=null,lastValue=-1,lastKind='',lastVisible=null;
 return {paint(root,value,kind,visible){
  if(!root)return;if(root!==panel){panel=root;match=root.closest?.('.game-match');meter=root.querySelector('progress');label=root.querySelector('span');lastValue=-1;lastKind='';lastVisible=null;}
  value=Math.max(0,Math.min(1,Number(value)||0));
  if(lastVisible!==visible){panel.hidden=!visible;if(match)match.dataset.charging=visible?'true':'false';lastVisible=visible;}
  if(lastValue!==value){if(meter)meter.value=value;lastValue=value;}
  if(lastKind!==kind){if(label)label.textContent=kind;if(meter)meter.setAttribute('aria-label',kind);lastKind=kind;}
 }};
}
// Full HUD updates on ownership/control/availability changes, not every charge tick.
export function createCriticalHudGate(){
 let controlled,team,index,available,setup,period,initialized=false;
 return state=>{
  const nextTeam=state.ball.owner?.team,nextIndex=state.ball.owner?.index,nextAvailable=!(state.skillCooldown>0);
  const changed=!initialized||controlled!==state.controlled||team!==nextTeam||index!==nextIndex||available!==nextAvailable||setup!==!!(state.openingKickoff&&state.freeze>0)||period!==state.period;
  controlled=state.controlled;team=nextTeam;index=nextIndex;available=nextAvailable;setup=!!(state.openingKickoff&&state.freeze>0);period=state.period;initialized=true;return changed;
 };
}
export function consumeDirectOneShots(controls,applied,command,allowed,owners){
 if(!applied||command||!allowed)return false;
 owners?.clear('skill');owners?.clear('through');
 controls.shoot=false;controls.pass=false;controls.skill=false;controls.through=false;
 return true;
}
