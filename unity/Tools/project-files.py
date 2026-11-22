from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]/'TouchlineUnity';assets=root/'Assets'
def guid(path):return hashlib.sha256(('TouchlineUnity66:'+str(path.relative_to(root))).encode()).hexdigest()[:32]
script=assets/'Touchline/Runtime/TouchlineBootstrap.cs';scene=assets/'Touchline/Scenes/Touchline.unity'
scene.write_text('''%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1 &100000
GameObject:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  serializedVersion: 6
  m_Component:
  - component: {fileID: 400000}
  - component: {fileID: 11400000}
  m_Layer: 0
  m_Name: Touchline Unity
  m_TagString: Untagged
  m_IsActive: 1
--- !u!4 &400000
Transform:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: 100000}
  serializedVersion: 2
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_ConstrainProportionsScale: 0
  m_Children: []
  m_Father: {fileID: 0}
--- !u!114 &11400000
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: 100000}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: SCRIPT_GUID, type: 3}
  m_Name:
  m_EditorClassIdentifier:
'''.replace('SCRIPT_GUID',guid(script)))
(root/'ProjectSettings/EditorBuildSettings.asset').write_text('''%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1045 &1
EditorBuildSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_Scenes:
  - enabled: 1
    path: Assets/Touchline/Scenes/Touchline.unity
    guid: SCENE_GUID
  m_configObjects: {}
'''.replace('SCENE_GUID',guid(scene)))
for path in sorted(assets.rglob('*')):
 if path.suffix=='.meta':continue
 target=path.with_name(path.name+'.meta')
 text='fileFormatVersion: 2\nguid: '+guid(path)+'\n'+('folderAsset: yes\n' if path.is_dir() else '')
 if target.exists():assert 'guid: '+guid(path) in target.read_text(),target
 else:target.write_text(text)
print('Scene, build-scene and stable asset GUIDs written. Unity Editor import remains unverified.')
