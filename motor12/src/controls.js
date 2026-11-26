export function bindControls(root,active){
  const stick=root.querySelector('.field-stick'), knob=stick.firstElementChild;
  const state={x:0,y:0,slot:-1,sprint:false,action:''};
  const abort=new AbortController(),options={signal:abort.signal};
  const keys=new Set(),sprintPointers=new Set();
  let pointer=null, bounds=null,dx=0,dy=0;
  const actions={KeyJ:'pass',KeyK:'shoot',KeyL:'through',KeyE:'switch',KeyF:'tackle'};
  function axis(e){
    const radius=bounds.width/2;
    const x=(e.clientX-bounds.left-radius)/radius,y=(e.clientY-bounds.top-radius)/radius;
    const length=Math.max(1,Math.hypot(x,y));
    dx=x/length;dy=y/length;
    knob.style.transform='translate('+dx*radius*.54+'px,'+dy*radius*.54+'px)';
  }
  function reset(){
    pointer=null;dx=dy=0;keys.clear();sprintPointers.clear();
    knob.style.transform='';state.action='';state.sprint=false;
    for(const b of root.querySelectorAll('.field-actions .held'))b.classList.remove('held');
  }
  stick.addEventListener('pointerdown',e=>{
    if(!active()||pointer!==null)return;
    pointer=e.pointerId;bounds=stick.getBoundingClientRect();stick.setPointerCapture(pointer);axis(e);
  },options);
  stick.addEventListener('pointermove',e=>{if(pointer===e.pointerId)axis(e);},options);
  stick.addEventListener('lostpointercapture',e=>{
    if(pointer===e.pointerId){pointer=null;dx=dy=0;knob.style.transform='';}
  },options);
  for(const button of root.querySelectorAll('[data-field]')){
    const command=button.dataset.field;
    button.addEventListener('pointerdown',e=>{
      if(!active())return;
      button.setPointerCapture(e.pointerId);button.classList.add('held');
      if(command==='sprint')sprintPointers.add(e.pointerId);
      else state.action=command;
    },options);
    button.addEventListener('lostpointercapture',e=>{
      button.classList.remove('held');sprintPointers.delete(e.pointerId);
    },options);
    button.addEventListener('click',e=>{if(active()&&e.detail===0&&command!=='sprint')state.action=command;},options);
  }
  window.addEventListener('keydown',e=>{
    if(!active()||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea'))return;
    if(actions[e.code]){if(!e.repeat)state.action=actions[e.code];}
    else if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))return;
    e.preventDefault();keys.add(e.code);
  },options);
  window.addEventListener('keyup',e=>keys.delete(e.code),options);
  window.addEventListener('blur',reset,options);
  return {state,reset,dispose(){reset();abort.abort();},sample(arena){
    const key=(a,b)=>Number(keys.has(a)||keys.has(b));
    const x=dx+key('KeyD','ArrowRight')-key('KeyA','ArrowLeft');
    const y=dy+key('KeyS','ArrowDown')-key('KeyW','ArrowUp');
    const length=Math.max(1,Math.hypot(x,y));
    state.x=x/length;state.y=y/length;state.sprint=sprintPointers.size>0||!!key('ShiftLeft','ShiftRight');
    arena?.mapAxes(state);
    return state;
  }};
}
