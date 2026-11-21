// Clone before grading: the imported asset library and legacy paths keep their
// original materials. Colour maps/UVs are retained, never baked or downloaded.
export function broadcastSurfaceMaterial(source){
 if(Array.isArray(source))return source.map(broadcastSurfaceMaterial);
 const material=source.clone();
 switch(material.name){
  case 'Goal powder coat':
   material.color.setHex(0xf1f5ed);material.metalness=.06;material.roughness=.3;break;
  case 'Woven goal net':
   material.color.setHex(0xd4dfd2);material.roughness=.95;material.transparent=true;material.opacity=.72;material.depthWrite=false;material.forceSinglePass=true;break;
  case 'Concrete aggregate':
   material.color.setHex(0xa5b5bd);material.roughness=.94;break;
  case 'Brushed steel':
   material.metalness=.45;material.roughness=.42;break;
  case 'Stadium navy':
   material.color.setHex(0x274656);material.roughness=.82;break;
 }
 return material;
}
