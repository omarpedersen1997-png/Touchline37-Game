import * as THREE from 'three';
import{batchStaticStadium}from'./static-stadium-batch.js';
import{buildStadiumCrowd}from'./stadium-crowd.js';

function bannerTexture(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle='#102336';c.fillRect(0,0,1024,128);c.fillStyle='#b9f56c';c.fillRect(0,116,1024,12);c.fillStyle='#f0f4ef';c.font='italic bold 51px sans-serif';c.textAlign='center';c.fillText('TOUCHLINE  •  FOOTBALL',512,82);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function buildProStadium(scene,field,quality='auto'){
 const w=field.width/2,l=field.length/2,concrete=new THREE.MeshStandardMaterial({color:0x46515b,roughness:1}),seats=new THREE.MeshStandardMaterial({color:0x526b86,roughness:.8}),rail=new THREE.MeshStandardMaterial({color:0xd5dce1,metalness:.4,roughness:.65}),roof=new THREE.MeshStandardMaterial({color:0xc6cdd3,metalness:.15,roughness:.6});
 const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;};
 add(new THREE.PlaneGeometry(field.width+60,field.length+60),new THREE.MeshStandardMaterial({color:0x334332,roughness:1}),0,-.03,0).rotation.x=-Math.PI/2;
 // Two continuous tiers, tunnels and stadium furniture at adult human scale.
 const crowds=[],seatPoints=[];
 for(const side of[-1,1])for(let tier=0;tier<2;tier++)for(let row=0;row<10;row++){
  const depth=8+tier*10+row*.9,y=.5+tier*8+row*.65;
  add(new THREE.BoxGeometry(.95,.65,field.length+18),concrete,side*(w+depth),y,0);
  add(new THREE.BoxGeometry(field.width+17,.65,.95),concrete,0,y,side*(l+depth));
  for(let along=-(field.length+14)/2;along<(field.length+14)/2;along+=(quality==='auto'?2.4:1.5))if(!(tier===0&&row<5&&Math.abs(along)<3))seatPoints.push([side*(w+depth),y+.45,along]);
  for(let across=-(field.width+13)/2;across<(field.width+13)/2;across+=(quality==='auto'?2.4:1.5))if(!(tier===0&&row<4&&Math.abs(across)<2))seatPoints.push([across,y+.45,side*(l+depth)]);
 }
 const audience=buildStadiumCrowd(scene,seatPoints,quality,field);crowds.push(...audience.batches);
 for(const side of[-1,1]){
  add(new THREE.BoxGeometry(18,.55,field.length+30),roof,side*(w+24),22,0);
  add(new THREE.BoxGeometry(field.width+27,.55,18),roof,0,22,side*(l+24));
  for(let z=-l-12;z<=l+12;z+=12)add(new THREE.CylinderGeometry(.18,.25,22,6),rail,side*(w+30),11,z);
  add(new THREE.BoxGeometry(1.2,1.8,field.length+10),concrete,side*(w+5.5),.8,0);
  add(new THREE.BoxGeometry(field.width+11,1.8,1.2),concrete,0,.8,side*(l+5.5));
 }
 const boardMap=bannerTexture(),boardMat=new THREE.MeshBasicMaterial({map:boardMap});
 for(const side of[-1,1]){
  for(let z=-l;z<l;z+=24){const span=Math.min(22,l-z-1),board=add(new THREE.PlaneGeometry(span,1.2),boardMat,side*(w+4.8),.9,z+span/2);board.rotation.y=side<0?Math.PI/2:-Math.PI/2;}
  for(let x=-w;x<w;x+=24){const span=Math.min(22,w-x-1),board=add(new THREE.PlaneGeometry(span,1.2),boardMat,x+span/2,.9,side*(l+4.8));board.rotation.y=side<0?0:Math.PI;}
 }
 // Benches and technical zones beside the touchline.
 for(const z of[-14,14]){add(new THREE.BoxGeometry(2,2.4,9),new THREE.MeshPhysicalMaterial({color:0x536d80,transparent:true,opacity:.55,roughness:.3}),-(w+3.5),1.2,z);add(new THREE.BoxGeometry(1,.55,8),rail,-(w+3.5),.45,z);}
 const planes=[new THREE.Plane(new THREE.Vector3(-1,0,0),w+2),new THREE.Plane(new THREE.Vector3(0,0,-1),l+2)],materials=new Set();
 // Cut away camera-side stadium structures, never the pitch or its surround.
 scene.traverse(o=>{if(!o.isMesh)return;if(o.geometry.type==='PlaneGeometry'&&o.rotation.x===-Math.PI/2)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){m.clippingPlanes=planes;materials.add(m);}});
 const savedDraws=batchStaticStadium(scene);scene.updateMatrixWorld(true);const structures=[];scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material.clippingPlanes){const box=new THREE.Box3().setFromObject(o);structures.push({mesh:o,center:box.getCenter(new THREE.Vector3()),half:box.getSize(new THREE.Vector3()).multiplyScalar(.5)});}});
 return{crowds,savedDraws,clippingPlanes:planes,setCameraView(eye,target){audience.setCameraView(eye,target);const dx=eye.x-target.x,dz=eye.z-target.z;planes[0].normal.set(dx>=0?-1:1,0,0);planes[0].constant=Math.abs(dx)<.1?1e6:w+2;planes[1].normal.set(0,0,dz>=0?-1:1);planes[1].constant=Math.abs(dz)<.1?1e6:l+2;for(const{mesh,center,half}of structures)mesh.visible=planes.every(p=>p.distanceToPoint(center)+Math.abs(p.normal.x)*half.x+Math.abs(p.normal.y)*half.y+Math.abs(p.normal.z)*half.z>=0);}};
}
