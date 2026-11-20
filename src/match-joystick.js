// The joystick does not move during a captured gesture. Cache its rectangle
// until release/resize so thumb writes cannot cause repeated layout reads.
export function createJoystickProjector(){
 let owner=null,bounds=null;
 return{
  begin(element){owner=element;bounds=element.getBoundingClientRect();},
  reset(){owner=null;bounds=null;},
  project(element,clientX,clientY){
   if(!bounds||owner!==element){owner=element;bounds=element.getBoundingClientRect();}
   if(!(bounds.width>0&&bounds.height>0))return{x:0,y:0};
   const dx=(clientX-bounds.left-bounds.width/2)/(bounds.width*.36),dy=(clientY-bounds.top-bounds.height/2)/(bounds.height*.36),length=Math.max(1,Math.hypot(dx,dy));
   return{x:dx/length,y:dy/length};
  }
 };
}
