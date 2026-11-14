import bpy, math, json, os
from mathutils import Vector
base='/workspace/football-asset-research/'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=base+'out/touchline_footballer.glb')
# Texture budget: retain photographed skin and eyes; kit uses clean, recolorable PBR colours.
for mat in bpy.data.materials:
 if not mat.use_nodes: continue
 bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs:continue
 if any(x in mat.name for x in ['Football','Sneaker']):
  for inp in ['Base Color','Normal','Roughness']:
   for l in list(bs.inputs[inp].links):mat.node_tree.links.remove(l)
  if 'Shirt' in mat.name or 'Socks' in mat.name:bs.inputs['Base Color'].default_value=(0.015,0.13,0.73,1)
  elif 'Shorts' in mat.name:bs.inputs['Base Color'].default_value=(0.83,0.88,0.96,1)
  elif 'midsole' in mat.name or 'laces' in mat.name:bs.inputs['Base Color'].default_value=(0.7,0.8,0.95,1)
  else:bs.inputs['Base Color'].default_value=(0.009,0.015,0.035,1)
  bs.inputs['Roughness'].default_value=0.78
 if mat.name=='Skin':
  for l in list(bs.inputs['Roughness'].links):mat.node_tree.links.remove(l)
  bs.inputs['Roughness'].default_value=0.65
for im in bpy.data.images:
 limit=1024 if 'skin_young' in im.name else 256 if any(x in im.name for x in ['eyes_','eyebrows','hair']) else 512
 w,h=im.size
 if w>limit or h>limit:
  s=limit/max(w,h);im.scale(round(w*s),round(h*s))
# Split by material to preserve the face while reducing shoes and scalp.
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=mesh;mesh.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
info=[]
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 if not len(o.data.materials):
  bpy.data.objects.remove(o,do_unlink=True);continue
 bpy.context.view_layer.objects.active=o
 name=o.data.materials[0].name
 ratio=0.16 if 'Buzz' in name else 0.20 if 'Sneaker' in name else 0.43 if 'Socks' in name else 0.65 if 'Shirt' in name else 0.8 if name=='Skin' else 1
 if ratio<1:
  mod=o.modifiers.new('Mobile topology','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=True
 o.name=name.replace(' ','_')
 info.append({'name':o.name,'material':name,'vertices':len(o.data.vertices),'triangles':sum(len(f.vertices)-2 for f in o.data.polygons)})
# Remove source cameras/lights before export.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=base+'touchline-footballer.glb',export_format='GLB',use_selection=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=88,export_yup=True,export_materials='EXPORT',export_extras=True)
open(base+'footballer-mesh-info.json','w').write(json.dumps(info,indent=2))
print('FOOTBALL_ASSET_STATS',json.dumps(info),'BYTES',os.path.getsize(base+'touchline-footballer.glb'))
bpy.ops.wm.save_as_mainfile(filepath=base+'touchline-footballer.blend')
# Render the final fully clothed model for visual inspection.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False
for vl in scene.view_layers:vl.cycles.use_denoising=False
scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.world.color=(0.12,0.12,0.12)
def light(name,loc,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=((Vector((0,0,1))-o.location).to_track_quat('-Z','Y')).to_euler()
light('Key',(2,-3,4),420,4);light('Fill',(-3,-1,2.5),250,3);light('Rim',(1,2,3),350,2)
camd=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',camd);scene.collection.objects.link(cam);cam.location=(2.1,-4.5,1.8);target=Vector((0,0,0.96));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=2.25;scene.camera=cam
scene.render.image_settings.file_format='PNG';scene.render.filepath=base+'footballer-preview.png';scene.render.film_transparent=False
bpy.ops.render.render(write_still=True)
