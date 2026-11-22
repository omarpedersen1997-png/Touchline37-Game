import bpy,sys,json
from pathlib import Path
repo=Path(sys.argv[sys.argv.index('--')+1]).resolve();folder=repo/'unity/TouchlineUnity/Assets/Touchline/Resources/Touchline/Models';results=[]
for path in sorted(folder.glob('*.fbx')):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(path));objects=list(bpy.context.scene.objects);meshes=[o for o in objects if o.type=='MESH'];arms=[o for o in objects if o.type=='ARMATURE'];clips=[a.name for a in bpy.data.actions]
 assert meshes and all(len(o.data.uv_layers)>0 for o in meshes),path
 if path.name!='stadium-kit.fbx':
  assert sum(len(a.data.bones) for a in arms)==26,(path,'bones')
  for key in ['idle','walk','run','sprint','turn','pass','shoot','tackle','dive','cheer','strafe_left','strafe_right']:assert any(key in name.lower() for name in clips),(path,key,clips)
  assert all(any(m.type=='ARMATURE' for m in o.modifiers) or o.parent_type=='BONE' for o in meshes),(path,'skin',[(o.name,o.parent_type,o.parent_bone) for o in meshes if not any(m.type=='ARMATURE' for m in o.modifiers)])
 results.append({'file':path.name,'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'bones':sum(len(a.data.bones) for a in arms),'clips':clips,'uvMaps':True,'skinning':bool(arms),'readable':True})
(repo/'unity/Evidence/fbx-structure.json').write_text(json.dumps({'tool':'Blender '+bpy.app.version_string,'results':results,'unityImportVerified':False},indent=2)+'\n');print('Five FBX files reimported; mesh/UV/skin/12-clip structure verified. Unity import not executed.')
