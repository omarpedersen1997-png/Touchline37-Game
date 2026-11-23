import {BufferGeometry,BufferAttribute,Line,LineBasicMaterial} from 'three';
// One optional draw, 16 fixed samples. No new scene objects in the frame loop.
export function createBallTrail(scene){
 const capacity=16,positions=new Float32Array(capacity*3),colours=new Float32Array(capacity*4),history=new Float64Array(capacity*4);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('color',new BufferAttribute(colours,4));geometry.setDrawRange(0,0);
 const material=new LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false}),line=new Line(geometry,material);line.name='R3 ball flight trace';line.frustumCulled=false;line.visible=false;scene.add(line);
 let count=0,lastContact=-1;
 return {line,update(point,state,now,{reset=false,reducedMotion=false}={}){
  const contact=state.lastContact?.tick??-1,speed=Math.hypot(state.ball.vx,state.ball.vy);
  const flight=state.engineRevision>=6&&point.z>.53;
  const lifetime=flight ? .18 : .10;
  const active=!reset&&!reducedMotion&&!state.freeze&&!state.replayHold&&!state.ball.owner&&speed>(flight?8:14)&&!state.goalSequence;
  if(!active||contact!==lastContact){count=0;line.visible=false;}lastContact=contact;
  if(!active)return;
  if(count===capacity){history.copyWithin(0,4);count--;}
  history[count*4]=point.x;history[count*4+1]=point.z;history[count*4+2]=point.y;history[count*4+3]=now;count++;
  let start=0;while(start<count&&now-history[start*4+3]>lifetime)start++;
  if(start){history.copyWithin(0,start*4,count*4);count-=start;}
  for(let i=0;i<count;i++){
   positions[i*3]=history[i*4];positions[i*3+1]=history[i*4+1];positions[i*3+2]=history[i*4+2];const age=Math.max(0,now-history[i*4+3]);
   colours[i*4]=.89;colours[i*4+1]=.98;colours[i*4+2]=flight ? .8 : .62;
   colours[i*4+3]=Math.max(0,1-age/lifetime)*(flight ? .39 : .19);
  }
  geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;line.visible=count>1;
 },dispose(){scene.remove(line);geometry.dispose();material.dispose();}};
}
