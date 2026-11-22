"""Structural checks against committed native Unity settings, not an Editor build."""
from pathlib import Path
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1] / 'TouchlineUnity'


def asset(path):
    text = (ROOT / path).read_text()
    text = re.sub(r'^%.*\n', '', text, flags=re.M)
    text = re.sub(r'^--- !u!\d+ &\d+', '---', text, flags=re.M)
    return list(yaml.safe_load_all(text))


def guid(path):
    return re.search(r'guid: ([a-f0-9]{32})', (ROOT / (path + '.meta')).read_text())[1]


class AndroidReadyTests(unittest.TestCase):
    def test_only_bootstrap_scene_starts_with_the_existing_bootstrap_script(self):
        settings = asset('ProjectSettings/EditorBuildSettings.asset')[0]['EditorBuildSettings']
        scenes = [s for s in settings['m_Scenes'] if s['enabled']]
        self.assertEqual(len(scenes), 1)
        self.assertEqual(scenes[0]['guid'], guid(scenes[0]['path']))
        scene = asset(scenes[0]['path'])
        scripts = [x['MonoBehaviour']['m_Script']['guid'] for x in scene if 'MonoBehaviour' in x]
        self.assertEqual(scripts, [guid('Assets/Touchline/Runtime/TouchlineBootstrap.cs')])

    def test_apk_is_side_by_side_and_has_native_android_settings(self):
        p = asset('ProjectSettings/ProjectSettings.asset')[0]['PlayerSettings']
        self.assertEqual(p['applicationIdentifier']['Android'], 'dk.touchline.footballidle.unitytest')
        self.assertEqual(p['scriptingBackend']['Android'], 1)
        self.assertEqual(p['AndroidTargetArchitectures'], 2)
        self.assertEqual(p['AndroidMinSdkVersion'], 26)
        self.assertEqual(p['AndroidTargetSdkVersion'], 35)
        self.assertEqual(p['androidUseCustomKeystore'], 0)
        self.assertFalse(p['AndroidKeystoreName'])
        self.assertFalse(p['AndroidKeyaliasName'])

    def test_portrait_and_both_landscape_directions_are_permitted(self):
        p = asset('ProjectSettings/ProjectSettings.asset')[0]['PlayerSettings']
        self.assertEqual(p['defaultScreenOrientation'], 4)
        for direction in ['Portrait', 'LandscapeLeft', 'LandscapeRight']:
            self.assertEqual(p['allowedAutorotateTo' + direction], 1)
        self.assertEqual(p['allowedAutorotateToPortraitUpsideDown'], 0)

    def test_input_and_frame_pacing_do_not_require_an_editor_restart(self):
        p = asset('ProjectSettings/ProjectSettings.asset')[0]['PlayerSettings']
        self.assertEqual(p['activeInputHandler'], 1)
        self.assertEqual(p['androidUseSwappy'], 1)
        self.assertEqual(p['m_ActiveColorSpace'], 1)
        self.assertEqual(p['AndroidValidateAppBundleSize'], 0)

    def test_urp_graphics_and_every_quality_level_point_to_committed_pipeline(self):
        folder = 'Assets/Touchline/Resources/Touchline/Rendering/'
        pipeline = guid(folder + 'TouchlineURP.asset')
        graphics = asset('ProjectSettings/GraphicsSettings.asset')[0]['GraphicsSettings']
        self.assertEqual(graphics['m_CustomRenderPipeline']['guid'], pipeline)
        settings = asset('ProjectSettings/QualitySettings.asset')[0]['QualitySettings']
        for level in settings['m_QualitySettings']:
            self.assertEqual(level['customRenderPipeline']['guid'], pipeline)
        urp = asset(folder + 'TouchlineURP.asset')[0]['MonoBehaviour']
        self.assertEqual(urp['m_RendererDataList'][0]['guid'], guid(folder + 'TouchlineRenderer.asset'))
        self.assertEqual(urp['m_DefaultRendererIndex'], 0)
        self.assertEqual(urp['m_RequireDepthTexture'], 0)
        self.assertEqual(urp['m_RequireOpaqueTexture'], 0)

    def test_global_urp_resources_and_default_volume_profile_are_not_missing(self):
        folder = 'Assets/Touchline/Resources/Touchline/Rendering/'
        graphics = asset('ProjectSettings/GraphicsSettings.asset')[0]['GraphicsSettings']
        global_settings = graphics['m_RenderPipelineGlobalSettingsMap']['UnityEngine.Rendering.Universal.UniversalRenderPipeline']
        self.assertEqual(global_settings['guid'], guid(folder + 'TouchlineGlobalSettings.asset'))
        self.assertIn(guid(folder + 'DefaultVolumeProfile.asset'), (ROOT / (folder + 'TouchlineGlobalSettings.asset')).read_text())

    def test_models_textures_ui_and_text_rendering_are_present(self):
        import json
        resources = ROOT / 'Assets/Touchline/Resources/Touchline'
        self.assertEqual(sorted(p.stem for p in (resources / 'Models').glob('*.fbx')),
                         ['keeper-auto', 'keeper-detail', 'player-auto', 'player-detail', 'stadium-kit'])
        for model in (resources / 'Models').glob('*.fbx'):
            self.assertGreater(model.stat().st_size, 1000)
        for name in ['grass-color-2048.png', 'grass-normal-2048.png', 'kit-fabric-1024.png', 'kit-normal-1024.png', 'boot-leather-1024.png']:
            self.assertTrue((resources / 'Textures' / name).is_file())
        self.assertTrue((resources / 'UI/TouchlineTheme.tss').is_file())
        packages = json.loads((ROOT / 'Packages/manifest.json').read_text())['dependencies']
        self.assertIn('com.unity.modules.textrendering', packages)
        self.assertIn('com.unity.modules.textcoretextengine', packages)


if __name__ == '__main__':
    unittest.main()
