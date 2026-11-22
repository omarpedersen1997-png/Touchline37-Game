#if UNITY_INCLUDE_TESTS
using System.Linq;
using NUnit.Framework;
using Touchline.Editor;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Touchline.Tests
{
    public sealed class AndroidReadyTests
    {
        [OneTimeSetUp]
        public void Prepare() { TouchlineProjectSetup.Ensure(); }

        [Test] public void BootstrapIsTheOnlyEnabledFirstScene()
        {
            var scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).ToArray();
            Assert.That(scenes.Length,Is.EqualTo(1));Assert.That(scenes[0].path,Is.EqualTo(TouchlineProjectSetup.BootstrapScene));
            Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>(scenes[0].path),Is.Not.Null);
            Assert.That(UnityEditor.SceneManagement.EditorSceneManager.playModeStartScene.path,Is.EqualTo(scenes[0].path));
        }
        [Test] public void AndroidHasSeparateIdentityArm64AndIl2Cpp()
        {
            Assert.That(PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android),Is.EqualTo("dk.touchline.footballidle.unitytest"));
            Assert.That(PlayerSettings.Android.targetArchitectures,Is.EqualTo(AndroidArchitecture.ARM64));
            Assert.That(PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android),Is.EqualTo(ScriptingImplementation.IL2CPP));
            Assert.That((int)PlayerSettings.Android.minSdkVersion,Is.EqualTo(26));
        }
        [Test] public void UrpAndAllImportedResourcesAreReady() { TouchlineProjectSetup.ValidatePreparedProject(); }
        [Test] public void MainAndQualityPipelinesAgree()
        {
            Assert.That(GraphicsSettings.defaultRenderPipeline,Is.InstanceOf<UniversalRenderPipelineAsset>());
            Assert.That(QualitySettings.renderPipeline,Is.SameAs(GraphicsSettings.defaultRenderPipeline));
        }
        [Test] public void ImportedCharactersHaveSkinnedMeshesNormalsAndUvs()
        {
            foreach(string model in new[]{"player-auto","player-detail","keeper-auto","keeper-detail"})
            {
                var asset=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Touchline/Resources/Touchline/Models/"+model+".fbx");
                var skins=asset.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                Assert.That(skins.Length,Is.GreaterThan(0),model);
                foreach(var skin in skins)
                {
                    Assert.That(skin.bones.Length,Is.GreaterThan(0),model);
                    Assert.That(skin.sharedMesh,Is.Not.Null,model);
                    Assert.That(skin.sharedMesh.normals.Length,Is.EqualTo(skin.sharedMesh.vertexCount),model);
                    Assert.That(skin.sharedMesh.uv.Length,Is.EqualTo(skin.sharedMesh.vertexCount),model);
                }
            }
        }
        [Test] public void AssetPreparationIsRepeatableWithoutDuplicateStates()
        {
            TouchlineProjectSetup.Ensure();TouchlineProjectSetup.Ensure();
            foreach(string model in new[]{"player-auto","player-detail","keeper-auto","keeper-detail"})
            {
                var controller=AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>("Assets/Touchline/Resources/Touchline/Controllers/"+model+".controller");
                Assert.That(controller.layers[0].stateMachine.states.Select(s=>s.state.name).Distinct().Count(),Is.EqualTo(12));
                Assert.That(controller.animationClips.Length,Is.EqualTo(12));
            }
        }
    }
}
#endif
