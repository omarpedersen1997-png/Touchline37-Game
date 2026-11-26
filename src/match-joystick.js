// The joystick does not move during a captured gesture. Cache its rectangle
// until release/resize so thumb writes cannot cause repeated layout reads.
export function createJoystickProjector({responsive=false}={}){
 let owner=null,bounds=null,engaged=false;
 return{
  begin(element){owner=element;bounds=element.getBoundingClientRect();},
  invalidate(){bounds=null;},
  reset(){owner=null;bounds=null;engaged=false;},
  project(element,clientX,clientY){
   if(!bounds||owner!==element){owner=element;bounds=element.getBoundingClientRect();}
   if(!(bounds.width>0&&bounds.height>0))return{x:0,y:0};
   const dx=(clientX-bounds.left-bounds.width/2)/(bounds.width*.36),dy=(clientY-bounds.top-bounds.height/2)/(bounds.height*.36),length=Math.max(1,Math.hypot(dx,dy));
   if(!responsive)return{x:dx/length,y:dy/length};
   const radius=Math.hypot(dx,dy);
   // A smaller, hysteretic thumb dead zone reaches the existing engine's
   // first speed band promptly without changing its 32 directions/axes.
   if(radius<(engaged?.09:.14)){engaged=false;return{x:0,y:0};}
   engaged=true;const magnitude=.2+.8*Math.min(1,(radius-.09)/.91);
   return{x:dx/radius*magnitude,y:dy/radius*magnitude};
  }
 };
}
