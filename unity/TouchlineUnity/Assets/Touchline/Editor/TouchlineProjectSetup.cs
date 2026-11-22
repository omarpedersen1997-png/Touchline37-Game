#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Touchline.Editor
{
    public static class TouchlineProjectSetup
    {
        private const string Root="Assets/Touchline/Resources/Touchline/";
        [InitializeOnLoadMethod]
        private static void Schedule(){EditorApplication.delayCall+=Ensure;}
        [MenuItem("Touchline/Klargør Unity-projekt")]
        public static void Ensure()
        {
            if(EditorApplication.isCompiling||EditorApplication.isUpdating){EditorApplication.delayCall+=Ensure;return;}
            foreach(string folder in new[]{"Rendering","Materials","Controllers"})Directory.CreateDirectory(Root+folder);
            AssetDatabase.Refresh();ConfigurePipeline();ConfigureMaterials();ConfigureControllers();
            PlayerSettings.companyName="OPNext Games";PlayerSettings.productName="Touchline UNITY TEST";PlayerSettings.bundleVersion="0.1.0-unity66";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android,"dk.touchline.footballidle.unitytest");
            PlayerSettings.Android.bundleVersionCode=1001;PlayerSettings.Android.minSdkVersion=AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion=AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.optimizedFramePacing=true;PlayerSettings.colorSpace=ColorSpace.Linear;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android,false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,new[]{GraphicsDeviceType.Vulkan,GraphicsDeviceType.OpenGLES3});
            var settingsObject=AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").FirstOrDefault();
            if(settingsObject!=null){var settings=new SerializedObject(settingsObject);var input=settings.FindProperty("activeInputHandler");if(input!=null&&input.intValue!=2){input.intValue=2;settings.ApplyModifiedPropertiesWithoutUndo();Debug.Log("Touchline: begge input-backends er valgt. Genstart editoren, hvis Unity beder om det.");}}
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            PlayerSettings.defaultInterfaceOrientation=UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait=true;PlayerSettings.allowedAutorotateToPortraitUpsideDown=false;
            PlayerSettings.allowedAutorotateToLandscapeLeft=true;PlayerSettings.allowedAutorotateToLandscapeRight=true;
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Touchline/Scenes/Touchline.unity",true)};
            AssetDatabase.SaveAssets();
        }
        private static void ConfigurePipeline()
        {
            string rendererPath=Root+"Rendering/TouchlineRenderer.asset",pipelinePath=Root+"Rendering/TouchlineURP.asset";
            var renderer=AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
            if(renderer==null){renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,rendererPath);}
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if(pipeline==null){pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,pipelinePath);}
            pipeline.renderScale=1;pipeline.msaaSampleCount=2;pipeline.supportsHDR=false;pipeline.shadowDistance=55;pipeline.mainLightShadowmapResolution=1024;pipeline.additionalLightsRenderingMode=LightRenderingMode.Disabled;
            pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;GraphicsSettings.useScriptableRenderPipelineBatching=true;
            EditorUtility.SetDirty(pipeline);
        }
        private static Material Make(string name,Color color,bool unlit=false,string texture=null)
        {
            string path=Root+"Materials/"+name+".mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(material==null){material=new Material(Shader.Find(unlit?"Universal Render Pipeline/Unlit":"Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(material,path);}
            material.SetColor("_BaseColor",color);material.enableInstancing=true;
            if(!unlit){material.SetFloat("_Smoothness",name=="White"?.32f:.18f);material.SetFloat("_Metallic",0);}
            if(texture!=null)material.SetTexture("_BaseMap",AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Textures/"+texture));
            EditorUtility.SetDirty(material);return material;
        }
        private static void ConfigureMaterials()
        {
            var grass=Make("Grass",new Color(.3f,.52f,.27f),false,"grass-color-2048.png");grass.mainTextureScale=new Vector2(8.5f,13.125f);grass.EnableKeyword("_NORMALMAP");grass.SetTexture("_BumpMap",AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Textures/grass-normal-2048.png"));grass.SetFloat("_BumpScale",.35f);
            foreach(var kit in new[]{("Home",new Color(.7f,.94f,.35f)),("Away",new Color(.14f,.41f,.82f)),("Keeper",new Color(.97f,.67f,.12f))})
            {var material=Make(kit.Item1,kit.Item2,false,"kit-fabric-1024.png");material.EnableKeyword("_NORMALMAP");material.SetTexture("_BumpMap",AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Textures/kit-normal-1024.png"));material.SetFloat("_BumpScale",.25f);}
            Make("Shorts",new Color(.055f,.09f,.14f));Make("Boots",new Color(.25f,.3f,.32f),false,"boot-leather-1024.png");Make("Skin",new Color(.75f,.57f,.43f));
            Make("White",new Color(.95f,.97f,.9f),true);Make("Lime",new Color(.73f,.96f,.4f),true);Make("Structure",new Color(.14f,.22f,.28f));Make("Surround",new Color(.07f,.13f,.12f));
        }
        private static void ConfigureControllers()
        {
            foreach(string model in new[]{"player-auto","player-detail","keeper-auto","keeper-detail"})
            {
                string path=Root+"Controllers/"+model+".controller";
                if(AssetDatabase.LoadAssetAtPath<AnimatorController>(path)!=null)continue;
                var clips=AssetDatabase.LoadAllAssetsAtPath(Root+"Models/"+model+".fbx").OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview")).ToArray();
                if(clips.Length==0){Debug.LogWarning("FBX-animationer er endnu ikke importeret: "+model);continue;}
                var controller=AnimatorController.CreateAnimatorControllerAtPath(path);var machine=controller.layers[0].stateMachine;
                foreach(string action in new[]{"idle","walk","run","sprint","turn","pass","shoot","tackle","dive","cheer","strafe_left","strafe_right"})
                {
                    var clip=clips.FirstOrDefault(c=>c.name.IndexOf(action,StringComparison.OrdinalIgnoreCase)>=0);if(clip==null)throw new InvalidDataException("Animationsklippet mangler: "+model+"/"+action);
                    var state=machine.AddState(action);state.motion=clip;if(action=="idle")machine.defaultState=state;
                }
                EditorUtility.SetDirty(controller);
            }
        }
        [MenuItem("Touchline/Byg separat Android-test-APK")]
        public static void BuildAndroidTest()
        {
            Ensure();
            foreach(string name in new[]{"player-auto","keeper-auto"})if(AssetDatabase.LoadAssetAtPath<AnimatorController>(Root+"Controllers/"+name+".controller")==null)throw new InvalidDataException("Unity-importen er ufuldstændig. Ingen APK blev bygget.");
            // New identity + Unity's development signing. No original keystore,
            // production app, Capacitor test certificate or old APK is touched.
            PlayerSettings.Android.useCustomKeystore=false;Directory.CreateDirectory("Builds/Android");
            var options=new BuildPlayerOptions{scenes=EditorBuildSettings.scenes.Select(s=>s.path).ToArray(),locationPathName="Builds/Android/Touchline-Unity-0.1.0.apk",target=BuildTarget.Android,options=BuildOptions.Development};
            var report=BuildPipeline.BuildPlayer(options);if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new InvalidOperationException("Unity Android-build fejlede: "+report.summary.result);
        }
    }
}
#endif
