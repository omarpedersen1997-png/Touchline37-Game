"""Blender 4.3+: derive Unity-native FBX; never modify the source GLBs."""
import bpy,sys,json,hashlib,shutil
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];repo=Path(args[0]).resolve();project=repo/'unity/TouchlineUnity';source=repo/'public/match-assets55';resources=project/'Assets/Touchline/Resources/Touchline';originals=project/'Assets/Touchline/SourceAssets55'
for d in [resources/'Models',resources/'Textures',resources/'Audio',originals]:d.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text());records=[]
for item in manifest['files']:
 path=source/item['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']
 target=(resources/'Textures'/path.name if path.suffix=='.png' else resources/'Audio'/path.name if path.suffix=='.wav' else originals/path.name)
 shutil.copyfile(path,target);records.append({'source':str(path.relative_to(repo)),'target':str(target.relative_to(project)),'sha256':item['sha256'],'bytes':path.stat().st_size})
shutil.copyfile(source/'manifest.json',originals/'manifest.json')
regions={'Hips':(1.07,.025),'Spine':(1.10,.03),'Spine1':(1.13,.035),'Spine2':(1.13,.035),'LeftArm':(1.24,.035),'RightArm':(1.24,.035),'LeftForeArm':(1.18,.027),'RightForeArm':(1.18,.027),'LeftUpLeg':(1.28,.04),'RightUpLeg':(1.28,.04),'LeftLeg':(1.26,.035),'RightLeg':(1.26,.035),'LeftFoot':(1.12,.022),'RightFoot':(1.12,.022),'LeftHand':(1.16,.018),'RightHand':(1.16,.018)}
derived=[]
for filename in ['player-auto.glb','player-detail.glb','keeper-auto.glb','keeper-detail.glb','stadium-kit.glb']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source/filename));armatures=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];changed=0
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH' or not armatures:continue
  arm=next((m.object for m in obj.modifiers if m.type=='ARMATURE' and m.object),None)
  if not arm:continue
  transform=arm.matrix_world.inverted()@obj.matrix_world;inverse=transform.inverted();group={g.index:g.name for g in obj.vertex_groups}
  for vertex in obj.data.vertices:
   point=transform@vertex.co;delta=Vector((0,0,0))
   for influence in vertex.groups:
    name=group.get(influence.group);region=regions.get(name);bone=arm.data.bones.get(name)
    if not region or not bone:continue
    axis=(bone.tail_local-bone.head_local).normalized();offset=point-bone.head_local;radial=offset-axis*offset.dot(axis)
    if radial.length>1e-7:delta+=radial*influence.weight*min(region[0]-1,region[1]/radial.length)
   if delta.length>1e-7:changed+=1;vertex.co=inverse@(point+delta)
  obj.data.update()
 actions=[a.name for a in bpy.data.actions]
 out=resources/'Models'/(Path(filename).stem+'.fbx')
 # glTF's armature-display helper (Icosphere) is not a player part.
 selected={o for o in bpy.context.scene.objects if o.type=='ARMATURE' or o.type=='MESH' and (not armatures or any(m.type=='ARMATURE' for m in o.modifiers) or o.parent_type=='BONE')}
 for obj in list(selected):
  ancestor=obj.parent
  while ancestor is not None:selected.add(ancestor);ancestor=ancestor.parent
 bpy.ops.object.select_all(action='DESELECT')
 for obj in selected:obj.select_set(True)
 bpy.ops.export_scene.fbx(filepath=str(out),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,apply_unit_scale=True,apply_scale_options='FBX_SCALE_UNITS',axis_forward='-Z',axis_up='Y',bake_anim=bool(armatures),bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,embed_textures=False,path_mode='STRIP',mesh_smooth_type='FACE')
 assert out.stat().st_size>10000
 derived.append({'source':filename,'target':str(out.relative_to(project)),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceActions':actions,'bones':sum(len(a.data.bones) for a in armatures),'modifiedVertices':changed,'unityImported':False})
 for item in records:
  if item['source'].endswith('/'+filename):assert hashlib.sha256((source/filename).read_bytes()).hexdigest()==item['sha256']
(project.parent/'Evidence/asset-transfer.json').write_text(json.dumps({'tool':'Blender '+bpy.app.version_string,'originalFiles':records,'derivedFbx':derived,'unityEditorImportVerified':False},indent=2)+'\n')
print('Unity asset transfer complete:',len(records),'original files;',len(derived),'derived FBX files. Unity import remains unverified.')
