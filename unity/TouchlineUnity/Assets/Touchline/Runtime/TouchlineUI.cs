using System;
using System.Globalization;
using Touchline.Core;
using UnityEngine;
using UnityEngine.UIElements;

namespace Touchline.Runtime
{
    public sealed class TouchlineUI : MonoBehaviour
    {
        private TouchlineBootstrap app;
        private UIDocument document;
        private PanelSettings panel;
        private VisualElement root,screen,result,controlArea;
        private Label score,clock,focus,live,charge,saveStatus;
        private Button sound,pause;
        private Rect lastSafe;
        private int lastWidth,lastHeight;
        private bool match;
        private string lastEvent="Find pladsen. Skab næste chance.";
        private static string Money(long n)=>n.ToString("N0",CultureInfo.GetCultureInfo("da-DK"))+" kr.";
        public void Initialize(TouchlineBootstrap owner)
        {
            app=owner;panel=ScriptableObject.CreateInstance<PanelSettings>();panel.scaleMode=PanelScaleMode.ConstantPixelSize;
            panel.themeStyleSheet=Resources.Load<ThemeStyleSheet>("Touchline/UI/TouchlineTheme");
            document=gameObject.AddComponent<UIDocument>();document.panelSettings=panel;root=document.rootVisualElement;root.pickingMode=PickingMode.Ignore;
            root.style.width=Length.Percent(100);root.style.height=Length.Percent(100);root.styleSheets.Add(Resources.Load<StyleSheet>("Touchline/UI/Touchline"));
            Resize();
        }
        public void Resize()
        {
            Rect safe=Screen.safeArea;if(lastWidth==Screen.width&&lastHeight==Screen.height&&lastSafe==safe)return;
            lastWidth=Screen.width;lastHeight=Screen.height;lastSafe=safe;bool portrait=Screen.height>Screen.width;
            float scale=Mathf.Min(Screen.width/(portrait?390f:915f),Screen.height/(portrait?844f:412f));if(!Application.isMobilePlatform)scale=Mathf.Clamp(scale,.75f,1.4f);panel.scale=Mathf.Max(.5f,scale);
            root.style.paddingLeft=safe.x/panel.scale;root.style.paddingRight=(Screen.width-safe.xMax)/panel.scale;
            root.style.paddingTop=(Screen.height-safe.yMax)/panel.scale;root.style.paddingBottom=safe.y/panel.scale;
            root.EnableInClassList("portrait",portrait);
        }
        private static Label Text(string value,string style="body"){var label=new Label(value);label.AddToClassList(style);return label;}
        private static Button Button(string text,Action action,string style="secondary"){var b=new Button(action){text=text};b.AddToClassList(style);return b;}
        private static void Set(Label label,string value){if(label!=null&&label.text!=value)label.text=value;}
        private VisualElement Row(string style="row"){var row=new VisualElement();row.AddToClassList(style);return row;}
        private void Clear(bool isMatch)
        {
            match=isMatch;root.Clear();screen=new VisualElement();screen.AddToClassList(isMatch?"match-screen":"club-screen");screen.pickingMode=isMatch?PickingMode.Ignore:PickingMode.Position;root.Add(screen);
        }
        public void ShowClub(string notice="")
        {
            Clear(false);var club=app.Data.Club;var header=Row("header");var identity=new VisualElement();identity.Add(Text("touchline","brand"));identity.Add(Text("UNITY · LOKAL TEST","eyebrow"));header.Add(identity);header.Add(Text(Money(club.Money),"balance"));screen.Add(header);
            var scroll=new ScrollView(ScrollViewMode.Vertical);scroll.horizontalScrollerVisibility=ScrollerVisibility.Hidden;scroll.AddToClassList("club-scroll");screen.Add(scroll);
            scroll.Add(Text(club.Name,"title"));scroll.Add(Text("Dit hold. Dit næste træk.","subtitle"));
            if(!string.IsNullOrEmpty(notice))scroll.Add(Text(notice,"notice"));
            var summary=Row();summary.Add(Text("Holdstyrke "+ClubRules.Strength(club)+" / 99","metric"));summary.Add(Text("Kampe "+club.Played,"metric"));summary.Add(Text("XP "+club.Experience,"metric"));scroll.Add(summary);
            var fixture=new VisualElement();fixture.AddToClassList("card");fixture.Add(Text("NÆSTE TESTKAMP","eyebrow"));fixture.Add(Text(club.Name+" · Havneby IF","heading"));fixture.Add(Text("11 mod 11 · 2 × 2 minutter · isolerede, lokale regler","body"));fixture.Add(Button(app.Data.ActiveMatch!=null?"Genoptag Unity-kampen":"Spil Unity-testkamp",app.BeginMatch,"primary"));scroll.Add(fixture);
            var formations=Row("wrap-row");foreach(string formation in ClubRules.Formations){string selected=formation;var button=Button(formation,()=>{club.Formation=selected;app.Save();ShowClub();});button.EnableInClassList("selected",club.Formation==formation);button.SetEnabled(app.Data.ActiveMatch==null);formations.Add(button);}scroll.Add(Text("Opstilling & taktik","heading"));scroll.Add(formations);
            var tactics=Row("wrap-row");foreach(var pair in new[]{("balanced","Balance"),("attacking","Angreb"),("defensive","Forsvar")}){string key=pair.Item1;var button=Button(pair.Item2,()=>{club.Tactic=key;if(app.Data.ActiveMatch!=null)app.Data.ActiveMatch.Tactic=key;app.Save();ShowClub();});button.EnableInClassList("selected",club.Tactic==key);tactics.Add(button);}scroll.Add(tactics);
            foreach(var p in club.Players)
            {
                int index=club.Players.IndexOf(p);var line=Row("player-row");var labels=new VisualElement();labels.Add(Text(p.Number+" · "+p.Name,"player-name"));labels.Add(Text(p.Position+" · styrke "+ClubRules.EffectiveRating(p,club.Training)+" · energi "+Mathf.RoundToInt(p.Energy)+" %","hint"));line.Add(labels);
                var train=Button("Træn · 100 kr.",()=>{ClubRules.Train(club,index,out var message);app.Save();ShowClub(message);});train.SetEnabled(app.Data.ActiveMatch==null);line.Add(train);scroll.Add(line);
            }
            if(app.Data.ActiveMatch!=null)scroll.Add(Text("Opstilling og træning ændres mellem kampene. Taktikken kan justeres undervejs.","hint"));
            var settings=new VisualElement();settings.AddToClassList("card");settings.Add(Text("Dine lokale valg","heading"));
            var audio=new Toggle("Kamplyd"){value=app.Data.Preferences.Sound};audio.RegisterValueChangedCallback(e=>app.ToggleSound(e.newValue));settings.Add(audio);
            var splash=new Toggle("Vis startskærm ved opstart"){value=app.Data.Preferences.Splash};splash.RegisterValueChangedCallback(e=>{app.Data.Preferences.Splash=e.newValue;app.Save();});settings.Add(splash);settings.Add(Text("Kan altid springes over med et tryk.","hint"));
            var reduced=new Toggle("Reduceret kamerabevægelse"){value=app.Data.Preferences.ReducedMotion};reduced.RegisterValueChangedCallback(e=>{app.Data.Preferences.ReducedMotion=e.newValue;app.Save();});settings.Add(reduced);
            settings.Add(Button("Billedmål: "+app.Data.Preferences.TargetFps+" FPS",()=>{app.Data.Preferences.TargetFps=app.Data.Preferences.TargetFps==60?120:60;app.ApplyFrameRate();app.Save();ShowClub("Billedmålet er valgt. Faktisk FPS afhænger af enheden.");}));scroll.Add(settings);
            scroll.Add(Text("Unity-testen bruger sin egen lokale klub. Eksisterende Touchline-konti, optagelser og hjemmeside er ikke forbundet.","hint"));saveStatus=Text("","hint");scroll.Add(saveStatus);
        }
        public void ShowPreparing(){Clear(false);screen.Add(Text("touchline","brand"));screen.Add(Text("Banen gøres klar…","title"));screen.Add(Text("Modeller, animationer og kamplyd forberedes, før kampuret starter.","body"));}
        public void ShowMatch()
        {
            Clear(true);lastEvent="Klar ved midterpletten.";result=null;
            var top=Row("match-top");var board=new VisualElement();board.AddToClassList("score-card");score=Text("","score");clock=Text("","clock");board.Add(score);board.Add(clock);top.Add(board);
            var tools=Row();tools.Add(Button("KLUB",app.ReturnToClub));sound=Button("LYD",()=>app.ToggleSound(!app.Data.Preferences.Sound));tools.Add(sound);pause=Button("PAUSE",()=>app.TogglePause());tools.Add(pause);tools.Add(Button("TAKTIK",app.CycleTactic));top.Add(tools);screen.Add(top);
            live=Text(lastEvent,"live");screen.Add(live);focus=Text("","focus-player");screen.Add(focus);charge=Text("","charge");screen.Add(charge);
            var controls=Row("controls");controlArea=controls;controls.pickingMode=PickingMode.Ignore;controls.Add(Joystick());var actions=Row("actions");
            actions.Add(Held("FINTE",()=>app.Input.QueueSkill(),cancel=>{},"skill"));
            actions.Add(Held("STIKNING",()=>app.Input.QueueThrough(),cancel=>{},"through"));
            actions.Add(Held("INDLÆG",()=>app.Input.QueueLoft(),cancel=>{},"loft"));
            actions.Add(Held("SKYD / TACKL",()=>app.Input.ShootDown(app.OwnsBall),cancel=>{if(cancel)app.Input.CancelShot();else app.Input.ShootUp();},"shoot"));
            actions.Add(Held("AFLEVER / SKIFT",()=>app.Input.QueuePass(app.OwnsBall),cancel=>{},"pass"));
            actions.Add(Held("SPRINT",()=>app.Input.SprintHeld=true,cancel=>app.Input.SprintHeld=false,"sprint"));controls.Add(actions);screen.Add(controls);
        }
        private VisualElement Held(string text,Action down,Action<bool> up,string name)
        {
            var control=new VisualElement(){name=name,focusable=true,tooltip=text};control.AddToClassList("action");control.Add(Text(text,"action-label"));int owner=-1;
            control.RegisterCallback<PointerDownEvent>(e=>{if(owner!=-1)return;owner=e.pointerId;control.CapturePointer(owner);control.AddToClassList("down");down();e.StopPropagation();});
            Action<int,bool> end=(id,cancel)=>{if(id!=owner)return;int was=owner;owner=-1;control.RemoveFromClassList("down");up(cancel);if(control.HasPointerCapture(was))control.ReleasePointer(was);};
            control.RegisterCallback<PointerUpEvent>(e=>end(e.pointerId,false));control.RegisterCallback<PointerCancelEvent>(e=>end(e.pointerId,true));control.RegisterCallback<PointerCaptureOutEvent>(e=>end(e.pointerId,true));return control;
        }
        private VisualElement Joystick()
        {
            var stick=new VisualElement(){name="joystick",focusable=true,tooltip="Bevæg spilleren"};stick.AddToClassList("joystick");var thumb=new VisualElement();thumb.AddToClassList("thumb");thumb.pickingMode=PickingMode.Ignore;stick.Add(thumb);int owner=-1;Vector2 center=Vector2.zero;
            Action<Vector2> move=point=>{Vector2 raw=Vector2.ClampMagnitude((point-center)/42,1);app.Input.Thumb=new Vector2(raw.x,-raw.y);thumb.style.translate=new Translate(new Length(raw.x*34),new Length(raw.y*34),0);};
            stick.RegisterCallback<PointerDownEvent>(e=>{if(owner!=-1)return;owner=e.pointerId;center=stick.worldBound.center;stick.CapturePointer(owner);stick.AddToClassList("down");move(new Vector2(e.position.x,e.position.y));e.StopPropagation();});
            stick.RegisterCallback<PointerMoveEvent>(e=>{if(e.pointerId==owner)move(new Vector2(e.position.x,e.position.y));});
            Action<int> end=id=>{if(id!=owner)return;int was=owner;owner=-1;app.Input.Thumb=Vector2.zero;thumb.style.translate=new Translate();stick.RemoveFromClassList("down");if(stick.HasPointerCapture(was))stick.ReleasePointer(was);};
            stick.RegisterCallback<GeometryChangedEvent>(e=>{if(owner!=-1)end(owner);});
            stick.RegisterCallback<PointerUpEvent>(e=>end(e.pointerId));stick.RegisterCallback<PointerCancelEvent>(e=>end(e.pointerId));stick.RegisterCallback<PointerCaptureOutEvent>(e=>end(e.pointerId));return stick;
        }
        public void Event(MatchEvent e){lastEvent=e.Text;}
        public void Refresh(MatchState state,bool paused,bool busy,string error,int fallback)
        {
            if(!match){Set(saveStatus,error!=null?"Kunne ikke gemme: "+error:busy?"Gemmer Unity-klubben…":"Unity-klubben er gemt lokalt.");return;}
            controlArea?.SetEnabled(state.Phase==MatchPhase.Playing&&!paused);
            Set(score,"PRBK  "+state.HomeScore+" : "+state.AwayScore+"  HAIF");
            int seconds=(int)(state.HalfSeconds/MatchRules.HalfDuration*45*60)+(state.Half-1)*45*60;
            string phase=state.Phase==MatchPhase.KickOff?"KLAR TIL AFSPARK":state.Phase==MatchPhase.HalfTime?"PAUSE":state.Phase==MatchPhase.FullTime?"SLUTFLØJT":"";
            Set(clock,seconds/60+":"+(seconds%60).ToString("00")+" · "+state.Half+". halvleg "+phase);
            var p=state.Players[state.Controlled];Set(focus,p.Number+" · "+p.Name+"  · energi "+Mathf.RoundToInt(p.Energy)+" %");
            float total=state.HomePossession+state.AwayPossession;string possession=total>0?(state.HomePossession/total*100).ToString("0.0",CultureInfo.GetCultureInfo("da-DK"))+" %":"—";
            Set(live,(paused?"Kampen er sat på pause. ":lastEvent+" ")+"Skud "+state.HomeShots+"–"+state.AwayShots+" · Bold "+possession+(fallback>0?" · Reservemodeller: "+fallback:""));
            Set(charge,app.Input.ShootHeld?"SKUDKRAFT "+Mathf.RoundToInt(app.Input.Charge*100)+" %":"");sound.text=app.Data.Preferences.Sound?"LYD TIL":"LYD FRA";pause.text=paused?"FORTSÆT":"PAUSE";
            if(state.Phase==MatchPhase.FullTime&&result==null)
            {
                result=new VisualElement();result.AddToClassList("result");result.Add(Text("SLUTFLØJT","eyebrow"));result.Add(Text(state.HomeScore+" – "+state.AwayScore,"title"));result.Add(Text("Kampbelønning: "+Money(ClubRules.Reward(state)),"body"));result.Add(Button("Tilbage til klubben",app.FinishMatch,"primary"));screen.Add(result);
            }
        }
        public void Splash()
        {
            var cover=new VisualElement();cover.AddToClassList("splash");cover.Add(Text("touchline","brand"));cover.Add(Text("UNITY · FOOTBALL IDLE","eyebrow"));cover.Add(Text("Tryk for at springe over","hint"));root.Add(cover);cover.RegisterCallback<PointerDownEvent>(e=>cover.RemoveFromHierarchy());cover.schedule.Execute(()=>cover.RemoveFromHierarchy()).StartingIn(1100);
        }
        private void OnDestroy(){if(panel!=null)Destroy(panel);}
    }
}
