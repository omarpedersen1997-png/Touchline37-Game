// Leave pitch controls, form fields and vertically scrolling panels in charge of their gestures.
export function bindSwipe(surface, navigate, excluded=''){
  let finger=null;
  const blocked='button,a,select,input,dialog,[contenteditable=true]'+(excluded?','+excluded:'');
  surface.addEventListener('touchstart',event=>{
    finger=null;
    if(event.touches.length!==1||event.target.closest(blocked))return;
    const touch=event.changedTouches[0];
    finger={id:touch.identifier,x:touch.clientX,y:touch.clientY};
  },{passive:true});
  surface.addEventListener('touchend',event=>{
    if(!finger)return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===finger.id);
    if(!touch)return;
    const dx=touch.clientX-finger.x,dy=touch.clientY-finger.y;
    finger=null;
    if(Math.abs(dx)>48&&Math.abs(dx)>1.5*Math.abs(dy))navigate(dx<0?1:-1);
  },{passive:true});
  surface.addEventListener('touchcancel',()=>{finger=null;},{passive:true});
}

