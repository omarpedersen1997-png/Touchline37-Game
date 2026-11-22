#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Touchline.Editor
{
    public static class TouchlineProjectSetup
    {
        private const string Root="Assets/Touchline/Resources/Touchline/";
        public const string BootstrapScene="Assets/Touchline/Scenes/Touchline.unity";
        public const string AndroidAppId="dk.touchline.footballidle.unitytest";
        public static readonly string[] AnimationNames={"idle","walk","run","sprint","turn","pass","shoot","tackle","dive","cheer","strafe_left","strafe_right"};
        [InitializeOnLoadMethod]
        public static void Schedule(){EditorApplication.delayCall-=RunScheduled;EditorApplication.delayCall+=RunScheduled;}
        private static void RunScheduled()
        {
            if(EditorApplication.isPlayingOrWillChangePlaymode||BuildPipeline.isBuildingPlayer)return;
            if(EditorApplication.isCompiling||EditorApplication.isUpdating){Schedule();return;}
            try{Ensure();}catch(Exception error){Debug.LogException(error);}
        }
        [MenuItem("Touchline/Klargør Unity-projekt")]
        public static void Ensure()
        {
            if(EditorApplication.isCompiling||EditorApplication.isUpdating)throw new InvalidOperationException("Unity-importen er stadig i gang. Build-menuen venter automatisk.");
            foreach(string folder in new[]{"Rendering","Materials","Controllers"})if(!AssetDatabase.IsValidFolder(Root+folder))AssetDatabase.CreateFolder(Root.TrimEnd('/'),folder);
            ConfigurePipeline();ConfigureMaterials();ConfigureControllers();
            PlayerSettings.companyName="OPNext Games";PlayerSettings.productName="Touchline UNITY TEST";PlayerSettings.bundleVersion="0.1.0-unity66";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android,AndroidAppId);
            PlayerSettings.Android.bundleVersionCode=Math.Max(1001,PlayerSettings.Android.bundleVersionCode);PlayerSettings.Android.minSdkVersion=AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion=(AndroidSdkVersions)35;
            PlayerSettings.Android.optimizedFramePacing=true;PlayerSettings.colorSpace=ColorSpace.Linear;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android,false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,new[]{GraphicsDeviceType.Vulkan,GraphicsDeviceType.OpenGLES3});
            var settingsObject=AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").FirstOrDefault();
            if(settingsObject!=null){var settings=new SerializedObject(settingsObject);var input=settings.FindProperty("activeInputHandler");if(input!=null&&input.intValue!=1){input.intValue=1;settings.ApplyModifiedPropertiesWithoutUndo();}}
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android,ScriptingImplementation.IL2CPP);
            PlayerSettings.SetApiCompatibilityLevel(NamedBuildTarget.Android,ApiCompatibilityLevel.NET_Standard);
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            PlayerSettings.defaultInterfaceOrientation=UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait=true;PlayerSettings.allowedAutorotateToPortraitUpsideDown=false;
            PlayerSettings.allowedAutorotateToLandscapeLeft=true;PlayerSettings.allowedAutorotateToLandscapeRight=true;
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(BootstrapScene,true)};
            EditorSceneManager.playModeStartScene=AssetDatabase.LoadAssetAtPath<SceneAsset>(BootstrapScene);
            AssetDatabase.SaveAssets();
        }
        private static void ConfigurePipeline()
        {
            string rendererPath=Root+"Rendering/TouchlineRenderer.asset",pipelinePath=Root+"Rendering/TouchlineURP.asset";
            var renderer=AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
            if(renderer==null){renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,rendererPath);}
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if(pipeline==null){pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,pipelinePath);}
            pipeline.renderScale=1;pipeline.msaaSampleCount=2;pipeline.supportsHDR=false;pipeline.shadowDistance=55;pipeline.mainLightShadowmapResolution=1024;pipeline.additionalLightsRenderingMode=LightRenderingMode.Disabled;pipeline.supportsMainLightShadows=true;pipeline.supportsSoftShadows=true;pipeline.useSRPBatcher=true;
            pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;GraphicsSettings.useScriptableRenderPipelineBatching=true;
            EditorUtility.SetDirty(pipeline);
        }
        private static Material Make(string name,Color color,bool unlit=false,string texture=null)
        {
            string path=Root+"Materials/"+name+".mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);
            var shader=Shader.Find(unlit?"Universal Render Pipeline/Unlit":"Universal Render Pipeline/Lit");
            if(shader==null)throw new InvalidDataException("URP-shaderen mangler: "+name+". Ingen APK blev bygget.");
            if(material==null){material=new Material(shader);AssetDatabase.CreateAsset(material,path);}else material.shader=shader;
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
                var clips=AssetDatabase.LoadAllAssetsAtPath(Root+"Models/"+model+".fbx").OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview")).ToArray();
                foreach(string action in AnimationNames)if(!clips.Any(c=>c.name.IndexOf(action,StringComparison.OrdinalIgnoreCase)>=0))throw new InvalidDataException("Animationsklippet mangler: "+model+"/"+action);
                var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(path)??AnimatorController.CreateAnimatorControllerAtPath(path);var machine=controller.layers[0].stateMachine;
                foreach(string action in AnimationNames)
                {
                    var clip=clips.First(c=>c.name.IndexOf(action,StringComparison.OrdinalIgnoreCase)>=0);
                    var state=machine.states.Select(s=>s.state).FirstOrDefault(s=>s.name==action)??machine.AddState(action);state.motion=clip;if(action=="idle")machine.defaultState=state;
                }
                EditorUtility.SetDirty(controller);
            }
        }
        [MenuItem("Touchline/Byg separat Android-test-APK")]
        public static void BuildAndroidTest()
        {
            TouchlineAndroidBuild.Request();
        }
        public static void ValidatePreparedProject()
        {
            if(AssetDatabase.LoadAssetAtPath<SceneAsset>(BootstrapScene)==null)throw new InvalidDataException("Startscenen mangler.");
            if(EditorBuildSettings.scenes.Count(s=>s.enabled)!=1||EditorBuildSettings.scenes.First(s=>s.enabled).path!=BootstrapScene)throw new InvalidDataException("Forkert startscene/rækkefølge.");
            if(PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android)!=AndroidAppId)throw new InvalidDataException("Forkert test-app-id.");
            if(PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android)!=ScriptingImplementation.IL2CPP||PlayerSettings.Android.targetArchitectures!=AndroidArchitecture.ARM64)throw new InvalidDataException("Android skal bruge ARM64/IL2CPP.");
            if(!(GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset))throw new InvalidDataException("URP-pipeline mangler.");
            foreach(string name in new[]{"Grass","Home","Away","Keeper","Shorts","Boots","Skin","White","Lime","Structure","Surround"})
            {
                var material=AssetDatabase.LoadAssetAtPath<Material>(Root+"Materials/"+name+".mat");
                if(material==null||material.shader==null||!material.shader.name.StartsWith("Universal Render Pipeline/",StringComparison.Ordinal))throw new InvalidDataException("URP-materiale mangler: "+name);
            }
            foreach(string model in new[]{"player-auto","player-detail","keeper-auto","keeper-detail","stadium-kit"})
            {
                string path=Root+"Models/"+model+".fbx";var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if(asset==null||asset.GetComponentsInChildren<Renderer>(true).Length==0)throw new InvalidDataException("FBX-modellen mangler: "+model);
                if(model=="stadium-kit")continue;
                var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(Root+"Controllers/"+model+".controller");
                foreach(string action in AnimationNames)if(controller==null||!controller.animationClips.Any(c=>c.name.IndexOf(action,StringComparison.OrdinalIgnoreCase)>=0))throw new InvalidDataException("Animator-klippet mangler: "+model+"/"+action);
            }
            foreach(string file in new[]{"grass-color-2048.png","grass-normal-2048.png","kit-fabric-1024.png","kit-normal-1024.png","boot-leather-1024.png"})
                if(AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Textures/"+file)==null)throw new InvalidDataException("Tekstur mangler: "+file);
        }
    }
}
#endif
