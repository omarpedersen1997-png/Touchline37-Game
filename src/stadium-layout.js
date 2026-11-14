// Metres, with x across the pitch, z along it, and y above the playing surface.
// Both renderers consume the same stand plan; no structure sits outside its plinth.
export function stadiumLayout(stage=2,field={width:68,length:105}){
 stage=Math.max(0,Math.min(3,Math.floor(Number(stage)||0)));
 const {width,length}=field,rows=3+stage*2,rowDepth=1.35,rise=.65;
 const boxes=[],add=(x,y,z,w,h,d,kind)=>boxes.push({x,y,z,w,h,d,kind});
 const edgeX=width/2+5,edgeZ=length/2+6,depth=rows*rowDepth;
 const base={width:(edgeX+depth+4)*2,length:(edgeZ+depth+4)*2};
 add(0,-.8,0,base.width,1.5,base.length,'base');
 add(0,-.04,0,base.width-1,.12,base.length-1,'walkway');
 for(const sign of [-1,1])for(let row=0;row<rows;row++){
  const height=(row+1)*rise;
  add(sign*(edgeX+(row+.5)*rowDepth),height/2,0,rowDepth,height,length+7,'seating');
  add(0,height/2,sign*(edgeZ+(row+.5)*rowDepth),width+7,height,rowDepth,'seating');
 }
 if(stage>=1){
  const roofY=rows*rise+3.2,roofX=-edgeX-depth/2;
  add(roofX,roofY,0,depth+1,.35,length+8,'roof');
  for(const z of[-length/2+2,-length/4,0,length/4,length/2-2]){
   add(-edgeX-depth+.5,roofY/2,z,.3,roofY,.3,'post');
   add(roofX,roofY-.5,z,depth,.22,.22,'post');
  }
 }
 const poles=stage>=2?[-1,1].flatMap(x=>[-1,1].map(z=>({x:x*(edgeX+depth+1.5),z:z*(edgeZ+depth+1.5),height:18}))):[];
 return{field,rows,boxes,poles,base,edgeX,edgeZ,pitchY:.03};
}
export function stadiumProjection(points,angle=-.9,view='overview'){
 const sine=Math.sin(angle),cosine=Math.cos(angle),elevation=view==='tribune'?.44:.76;
 const raw=([x,y,z])=>[x*cosine-z*sine,(x*sine+z*cosine)*elevation-y*1.22];
 const values=points.map(raw),xs=values.map(p=>p[0]),ys=values.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(728/(maxX-minX||1),328/(maxY-minY||1));
 const project=p=>{const[x,y]=raw(p);return[400+(x-(minX+maxX)/2)*scale,202+(y-(minY+maxY)/2)*scale];};
 const depth=ps=>ps.reduce((sum,[x,y,z])=>sum+x*sine+z*cosine+y*elevation,0)/ps.length;
 return{project,depth,scale};
}
export function boxCorners({x,y,z,w,h,d}){return[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>[x+a*w/2,y+b*h/2,z+c*d/2])));}
