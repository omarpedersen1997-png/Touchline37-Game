import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildPitchDetails} from '../src/pitch-details.js';

const dispose=root=>{const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
test('match details add exactly five static submissions with a bounded geometry budget in every quality mode',()=>{
 for(const quality of['auto','sharp','4k']){const scene=new THREE.Scene(),details=buildPitchDetails(scene,{width:60,length:96},quality);assert.equal(details.drawCalls,5);assert(details.triangles>1000&&details.triangles<8000);assert.equal(scene.children.length,1);assert(!details.root.userData.update);assert.equal(details.root.children.filter(o=>o.isInstancedMesh).length,2);details.root.traverse(o=>{assert(!o.castShadow,'small props should not add another shadow-map pass');if(o.geometry)assert(Object.values(o.geometry.attributes).every(a=>Array.from(a.array).every(Number.isFinite)));});dispose(scene);}
});
test('corner flags, penalty spots and technical areas line up with the existing field and dugouts',()=>{
 const scene=new THREE.Scene(),d=buildPitchDetails(scene,{width:60,length:96});assert.deepEqual(d.landmarks.cornerFlags,[[-30,-48],[-30,48],[30,-48],[30,48]]);assert.deepEqual(d.landmarks.penaltySpots,[[0,-37],[0,37]]);assert.equal(d.landmarks.technicalAreas.length,2);
 for(const [i,box]of d.landmarks.technicalAreas.entries()){assert(box.x1<-30&&box.x0<-33.5);assert(box.z0<[-14,14][i]-4.5&&box.z1>[-14,14][i]+4.5);}
 assert.equal(d.landmarks.cameras.length,4);assert.equal(d.landmarks.staff.length,6);for(const [x,z]of [...d.landmarks.cameras,...d.landmarks.staff]){assert(Math.abs(x)>30.5);assert(Math.abs(z)<48);}
 scene.updateMatrixWorld(true);const flags=d.root.getObjectByName('Corner flag poles'),matrix=new THREE.Matrix4();for(let i=0;i<4;i++){flags.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix);assert(Math.abs(p.y-.78)<1e-6);assert.deepEqual([p.x,p.z],d.landmarks.cornerFlags[i]);}dispose(scene);
});
test('props stay below adult height and wear lies underneath the white field markings',()=>{
 const scene=new THREE.Scene(),d=buildPitchDetails(scene,{width:60,length:96});scene.updateMatrixWorld(true);const equipment=new THREE.Box3().setFromObject(d.root.getObjectByName('Touchline equipment and match staff'));assert(equipment.max.y<1.85);assert(equipment.min.x>-36);assert(equipment.max.x<35);assert(equipment.max.z<48&&equipment.min.z>-48);
 const wear=d.root.getObjectByName('Goal mouth and centre wear'),positions=wear.geometry.attributes.position;for(let i=0;i<positions.count;i++){assert(Math.abs(positions.getY(i)-.043)<1e-6);assert(Math.abs(positions.getX(i))<30);assert(Math.abs(positions.getZ(i))<=48);}
 assert.equal(wear.geometry.attributes.color.itemSize,4);assert.equal(wear.material.depthWrite,false);assert(wear.material.transparent);const colors=wear.geometry.attributes.color;assert(Array.from({length:colors.count},(_,i)=>colors.getW(i)).some(a=>a===0),'feather edges without a hard decal boundary');dispose(scene);
});
