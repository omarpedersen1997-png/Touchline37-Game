// Reads layout only at ResizeObserver boundaries. A HUD DOM update must not
// force a synchronous clientHeight measurement on every rendered match frame.
export function createMatchViewport(container){
 const size={width:1,height:1};
 return{
  get width(){return size.width;},get height(){return size.height;},
  refresh(){size.width=Math.max(1,container.clientWidth||1);size.height=Math.max(1,container.clientHeight||1);return size;}
 };
}
