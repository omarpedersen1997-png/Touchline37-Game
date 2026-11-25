using System;
using System.Collections;
using System.IO;
using Touchline.Core;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Touchline.Runtime
{
    public sealed class TouchlineBootstrap : MonoBehaviour
    {
        public SandboxSave Data { get; private set; }
        public MatchInputRouter Input { get; } = new MatchInputRouter();
        public bool OwnsBall => simulation != null && simulation.State.Ball.Owner == simulation.State.Controlled;
        private static TouchlineBootstrap instance;
        private SaveStore store;
        private SaveWriter writer;
        private TouchlineUI ui;
        private MatchAudio audioFeed;
        private FootballWorld world;
        private Camera matchCamera;
        private BroadcastCamera cameraRig;
        private RenderPipelineAsset originalPipeline;
        private UniversalRenderPipelineAsset runtimePipeline;
        private MatchSimulation simulation;
        private MatchStepper stepper;
        private bool inMatch,preparing,paused,background;
        private float lastHud,lastSave;
        private ScreenOrientation previousOrientation;
        private Func<MatchInput> consumeInput;
        private Action<MatchSimulation> afterStep;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBootstrap(){if(FindAnyObjectByType<TouchlineBootstrap>()==null)new GameObject("Touchline Unity").AddComponent<TouchlineBootstrap>();}
        private void Awake()
        {
            if(instance!=null&&instance!=this){Destroy(gameObject);return;}instance=this;DontDestroyOnLoad(gameObject);
            var codec=new UnityCodec();store=new SaveStore(Path.Combine(Application.persistentDataPath,"touchline-unity-sandbox-v1"),codec);
            if(!store.TryLoad(out var data)){var seed=Resources.Load<TextAsset>("Touchline/Seeds/sandbox-club");if(seed==null)throw new InvalidDataException("Unity-klubskabelonen mangler.");data=new SandboxSave{Club=codec.Decode<ClubProfile>(seed.text)};}
            Data=data;writer=new SaveWriter(store,codec);long earned=ClubRules.AccrueIdle(Data.Club,DateTime.UtcNow.Ticks);
            previousOrientation=Screen.orientation;
            var cameraObject=new GameObject("Broadcast-kamera");cameraObject.transform.SetParent(transform,false);matchCamera=cameraObject.AddComponent<Camera>();cameraObject.tag="MainCamera";cameraObject.AddComponent<AudioListener>();matchCamera.clearFlags=CameraClearFlags.SolidColor;matchCamera.backgroundColor=new Color(.047f,.106f,.153f);matchCamera.nearClipPlane=.1f;matchCamera.farClipPlane=240;cameraRig=new BroadcastCamera(matchCamera);
            var sunObject=new GameObject("Stadionlys");sunObject.transform.SetParent(transform,false);var sun=sunObject.AddComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(1,.95f,.85f);sun.intensity=2.1f;sun.shadows=LightShadows.Soft;sun.shadowBias=.025f;sunObject.transform.rotation=Quaternion.Euler(48,-35,0);
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.45f,.57f,.72f);RenderSettings.ambientEquatorColor=new Color(.28f,.36f,.31f);RenderSettings.ambientGroundColor=new Color(.12f,.18f,.1f);QualitySettings.shadowDistance=55;
            world=new FootballWorld(transform);audioFeed=gameObject.AddComponent<MatchAudio>();audioFeed.Initialize(Data.Preferences.Sound);ui=gameObject.AddComponent<TouchlineUI>();ui.Initialize(this);
            ui.ShowClub(store.Warning.Length>0?store.Warning:earned>0?"Mens du var væk: "+earned.ToString("N0",System.Globalization.CultureInfo.GetCultureInfo("da-DK"))+" kr.":"");if(Data.Preferences.Splash)ui.Splash();
            if(GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset source){originalPipeline=QualitySettings.renderPipeline;runtimePipeline=Instantiate(source);runtimePipeline.renderScale=Application.isMobilePlatform?.85f:1;QualitySettings.renderPipeline=runtimePipeline;}
            ApplyFrameRate();consumeInput=()=>Input.Consume(matchCamera);afterStep=HandleStep;Save();
        }
        public void ApplyFrameRate(){QualitySettings.vSyncCount=0;Application.targetFrameRate=Data.Preferences.TargetFps;}
        public void Save()
        {
            if(Data==null||writer==null)return;
            if(inMatch&&simulation!=null)Data.ActiveMatch=simulation.State;
            try{writer.Request(Data);}catch(Exception error){Debug.LogError("Unity-klubben kunne ikke gemmes: "+error.Message);}
        }
        public void BeginMatch(){if(preparing||inMatch)return;StartCoroutine(PrepareMatch());}
        private IEnumerator PrepareMatch()
        {
            preparing=true;paused=false;Input.Reset();ui.ShowPreparing();
            if(Application.isMobilePlatform)Screen.orientation=ScreenOrientation.LandscapeLeft;
            foreach(string name in new[]{"player-auto","keeper-auto"}){var request=Resources.LoadAsync<GameObject>("Touchline/Models/"+name);yield return request;}
            if(Data.Preferences.Sound)yield return audioFeed.Prepare();
            Exception failure=null;
            try
            {
                simulation=Data.ActiveMatch!=null?new MatchSimulation(Data.ActiveMatch):new MatchSimulation(Data.Club,(uint)(DateTime.UtcNow.Ticks&0xffffffff));
                stepper=new MatchStepper(simulation);
                world.Start(simulation.State);
                cameraRig.Reset();
                Vector3 shownBall=world.Present(simulation.State,1,matchCamera);
                cameraRig.Present(simulation.State,shownBall,1,Data.Preferences.ReducedMotion,Time.unscaledDeltaTime);
                ui.ShowMatch();
            }
            catch(Exception error){failure=error;}
            if(failure!=null){preparing=false;world.Root.SetActive(false);Screen.orientation=previousOrientation;ui.ShowClub("Banen kunne ikke klargøres: "+failure.Message);yield break;}
            yield return null; // one prepared scene frame before the new local match clock runs
            inMatch=true;preparing=false;audioFeed.SetMatch(true);lastSave=Time.realtimeSinceStartup;lastHud=0;Save();
        }
        private void HandleStep(MatchSimulation match)
        {
            bool finished=false;foreach(var e in match.Events){ui.Event(e);audioFeed.Event(e);world.Event(e,match.State);if(e.Cue==MatchCue.FullTime)finished=true;if(e.Cue==MatchCue.Goal||e.Cue==MatchCue.HalfTime||e.Cue==MatchCue.FullTime)Input.Reset();}
            if(match.Events.Count>0)lastHud=0;
            if(finished)Save();
        }
        private void Update()
        {
            if(Data==null)return;ui.Resize();
            if(inMatch&&!paused&&!background&&simulation.State.Phase!=MatchPhase.FullTime)
            {
                Input.Poll(Time.unscaledDeltaTime,OwnsBall);stepper.Advance(Time.unscaledDeltaTime,consumeInput,afterStep);
                if(Keyboard.current!=null&&Keyboard.current.escapeKey.wasPressedThisFrame)TogglePause();
                if(Time.realtimeSinceStartup-lastSave>5){Save();lastSave=Time.realtimeSinceStartup;}
            }
            if(Time.realtimeSinceStartup-lastHud>.12f){ui.Refresh(simulation?.State,paused,writer.Busy,writer.LastError,world.FallbackPlayers);lastHud=Time.realtimeSinceStartup;}
        }
        private void LateUpdate()
        {
            if(!inMatch||background)return;
            float interpolation=paused?1:stepper.Alpha;
            Vector3 shown=world.Present(simulation.State,interpolation,matchCamera,paused);
            cameraRig.Present(simulation.State,shown,interpolation,Data.Preferences.ReducedMotion,Time.unscaledDeltaTime);
        }
        public void TogglePause(){if(!inMatch)return;paused=!paused;Input.Reset();stepper.ResetClock();audioFeed.SetPaused(paused||background);lastHud=0;Save();}
        public void ToggleSound(bool enabled){Data.Preferences.Sound=enabled;audioFeed.SetEnabled(enabled);if(enabled)StartCoroutine(PrepareSound());Save();lastHud=0;}
        private IEnumerator PrepareSound(){yield return audioFeed.Prepare();audioFeed.SetMatch(inMatch);}
        public void CycleTactic(){if(simulation==null)return;string next=simulation.State.Tactic=="balanced"?"attacking":simulation.State.Tactic=="attacking"?"defensive":"balanced";simulation.State.Tactic=Data.Club.Tactic=next;ui.Event(new MatchEvent(MatchCue.Skill,0,-1,"Taktik: "+(next=="balanced"?"Balance":next=="attacking"?"Angreb":"Forsvar")));Save();lastHud=0;}
        public void ReturnToClub()
        {
            if(preparing)return;Input.Reset();if(inMatch&&simulation!=null)Data.ActiveMatch=simulation.State;
            inMatch=false;paused=false;world.Root.SetActive(false);audioFeed.SetMatch(false);Screen.orientation=previousOrientation;Save();ui.ShowClub("Unity-kampen er gemt og kan genoptages.");
        }
        public void FinishMatch()
        {
            if(simulation==null||simulation.State.Phase!=MatchPhase.FullTime)return;
            ClubRules.Settle(Data.Club,simulation.State);Data.ActiveMatch=null;inMatch=false;paused=false;Input.Reset();world.Root.SetActive(false);audioFeed.SetMatch(false);Screen.orientation=previousOrientation;Save();ui.ShowClub("Kampen er afsluttet. Belønningen er føjet til Unity-klubben.");
        }
        private void OnApplicationPause(bool value)
        {
            background=value;Input.Reset();stepper?.ResetClock();cameraRig?.Reset();if(audioFeed!=null)audioFeed.SetPaused(value||paused);
            if(value&&Data!=null){Save();try{writer.Flush().Wait(TimeSpan.FromSeconds(2));}catch(Exception error){Debug.LogWarning(error.Message);}}
        }
        private void OnApplicationFocus(bool value){if(!value)Input.Reset();}
        private void OnApplicationQuit(){if(Data!=null){Save();try{writer.Flush().Wait(TimeSpan.FromSeconds(2));}catch{}}}
        private void OnDestroy(){if(instance!=this)return;instance=null;if(world!=null)world.Dispose();if(runtimePipeline!=null){QualitySettings.renderPipeline=originalPipeline;Destroy(runtimePipeline);}Screen.orientation=previousOrientation;}
    }
}
